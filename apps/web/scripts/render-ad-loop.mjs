#!/usr/bin/env node
/**
 * Renders the placeholder video ad loop, apps/web/public/placeholders/video-placeholder.webm,
 * from our own 3D ad stage (a perfume turning on the marble pedestal). No stock footage and no
 * network: headless Chromium draws the frames and its WebCodecs VP9 encoder compresses them.
 *
 * Needs playwright-core and a Chromium binary. Neither is a dependency of this repo:
 *   - playwright-core: `npm i playwright-core` in any folder, then point PLAYWRIGHT_CORE at
 *     <folder>/node_modules/playwright-core (or make it resolvable through NODE_PATH);
 *   - Chromium: CHROMIUM_PATH=/path/to/chrome (default: Playwright's own download, if installed).
 *
 * Run it against the web app with the dev pages on (it records /dev/ads?loop):
 *   pnpm --filter @hb/web dev
 *   PLAYWRIGHT_CORE=… CHROMIUM_PATH=… node apps/web/scripts/render-ad-loop.mjs --url http://localhost:3000
 * Options: --out <file.webm> · --kind perfume|jar|lipstick|compact · --shade '#RRGGBB'
 *          --quantizer <0–63, lower = sharper and bigger> (default 16)
 *
 * How it stays smooth and seamless on a software GPU: a virtual clock takes over
 * requestAnimationFrame and performance.now, so every frame is rendered at an exact 1/30 s step
 * however long it takes. The stage turns exactly half a turn and floats two cycles per 8 s
 * (packages/three/src/ads/turntable.ts) and the perfume looks the same after 180°, so frame 240
 * equals frame 0. Every frame, key frame included, is encoded at the same constant quantizer, so
 * the wrap from the last frame to the first shows no jump in sharpness (a MediaRecorder starts
 * with a soft key frame while its rate control warms up). The frames go into a WebM written here.
 *
 * The backdrop is the one the poster placeholders are drawn on (a blush-50 → pink-100 diagonal
 * across the frame and a soft white glow behind the product), which is also the ad media box's
 * backdrop, so the video shown whole in the wider in-feed box meets it without an edge.
 *
 * No .mp4: that would need H.264, which open-source Chromium builds cannot encode (VP9 in MP4
 * would not help the browsers that cannot play this WebM).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const WIDTH = 480;
const HEIGHT = 600;
const FPS = 30;
/** Must match turntable.ts: 8 s = half a turn + two float cycles. */
const LOOP_SECONDS = 8;
/** Frames rendered and thrown away first, so shaders and shadows have settled. */
const WARMUP_FRAMES = 15;
const MAX_BYTES = 1.5 * 1024 * 1024;
/** VP9 profile 0, level 3.1, 8-bit 4:2:0. */
const CODEC = 'vp09.00.31.08';

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    out: {
      type: 'string',
      default: path.join(ROOT, 'apps/web/public/placeholders/video-placeholder.webm'),
    },
    kind: { type: 'string', default: 'perfume' },
    // Product shade (catalogue data, like the fixtures): a warm apricot liquid.
    shade: { type: 'string', default: '#F2A07B' },
    quantizer: { type: 'string', default: '16' },
  },
});

const log = (line) => process.stdout.write(`${line}\n`);

/** Brand tokens straight from the theme, so the backdrop never drifts from the site. */
async function themeColors() {
  const css = await readFile(path.join(ROOT, 'packages/config/tailwind/theme.css'), 'utf8');
  const colors = Object.fromEntries(
    [...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
  for (const name of ['white', 'blush-50', 'pink-100']) {
    if (!colors[name]) throw new Error(`theme.css has no --color-${name}`);
  }
  return colors;
}

/**
 * Runs in the page before any app code. Installs the virtual clock, the compositor and the
 * encoder. Everything here is browser code; it talks to Node only through page.evaluate.
 */
function pageRuntime() {
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  const realNow = performance.now.bind(performance);
  const queue = new Map();
  let nextId = 1e9;
  let now = null; // null = real time

  window.requestAnimationFrame = (cb) => {
    if (now === null) return realRaf(cb);
    nextId += 1;
    queue.set(nextId, cb);
    return nextId;
  };
  window.cancelAnimationFrame = (id) => {
    if (!queue.delete(id)) realCancel(id);
  };
  performance.now = () => (now === null ? realNow() : now);

  // Count WebGL draw calls, to know that a tick really rendered the stage.
  let draws = 0;
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const name of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
    ]) {
      const original = proto[name];
      if (!original) continue;
      proto[name] = function countDraw(...params) {
        draws += 1;
        return original.apply(this, params);
      };
    }
  }

  /** Runs one frame at virtual time; true when the scene was drawn. */
  const tick = (ms) => {
    const before = draws;
    now += ms;
    const callbacks = [...queue.values()];
    queue.clear();
    for (const cb of callbacks) cb(now);
    return draws > before;
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const state = {
    canvas: null,
    ctx: null,
    source: null,
    fps: 0,
    quantizer: 0,
    colors: {},
    encoder: null,
    frames: 0,
    chunks: [],
    colorSpace: null,
    error: null,
  };

  /** The posters' backdrop (public/placeholders/*.svg), then the stage on top. */
  const composite = () => {
    const { ctx, canvas, colors } = state;
    const w = canvas.width;
    const h = canvas.height;
    // Diagonal across the frame's own box, like the SVGs' objectBoundingBox gradient and the
    // media box's CSS `to bottom right`: the three meet without a seam.
    ctx.setTransform(w, 0, 0, h, 0, 0);
    const wash = ctx.createLinearGradient(0, 0, 1, 1);
    wash.addColorStop(0, colors['blush-50']);
    wash.addColorStop(1, colors['pink-100']);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 1, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // The posters' white glow: centre (50 %, 42.7 %), radius 41.25 % of the width, 90 % → 0.
    const glow = ctx.createRadialGradient(w / 2, h * 0.427, 0, w / 2, h * 0.427, w * 0.4125);
    glow.addColorStop(0, `${colors.white}e6`);
    glow.addColorStop(1, `${colors.white}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(state.source, 0, 0, w, h);
  };

  window.__adLoop = {
    async start({ width, height, fps, warmup, colors, codec, quantizer }) {
      state.source = document.querySelector('[data-loop-ready] canvas');
      if (!state.source) throw new Error('stage canvas not found');
      state.fps = fps;
      state.quantizer = quantizer;
      state.colors = colors;
      state.canvas = document.createElement('canvas');
      state.canvas.width = width;
      state.canvas.height = height;
      state.ctx = state.canvas.getContext('2d');

      const config = {
        codec,
        width,
        height,
        framerate: fps,
        bitrateMode: 'quantizer',
        latencyMode: 'quality',
      };
      if (
        typeof VideoEncoder === 'undefined' ||
        !(await VideoEncoder.isConfigSupported(config)).supported
      ) {
        throw new Error(`this Chromium cannot encode ${codec} at a constant quantizer (WebCodecs)`);
      }
      state.encoder = new VideoEncoder({
        output: (chunk, meta) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          state.chunks.push({ key: chunk.type === 'key', timestamp: chunk.timestamp, data });
          if (meta?.decoderConfig?.colorSpace) state.colorSpace = meta.decoderConfig.colorSpace;
        },
        error: (error) => {
          state.error = error;
        },
      });
      state.encoder.configure(config);

      // Freeze time, then wait for the render loop's pending real frame to land in our queue (a
      // software GPU can take a while to reach it; other one-off callbacks may arrive first).
      now = realNow();
      for (let rendered = 0, waited = 0; rendered < warmup; ) {
        if (queue.size > 0) {
          if (tick(1000 / fps)) rendered += 1;
        } else if (waited > 20_000) {
          throw new Error('the render loop never reached the virtual clock');
        } else {
          await wait(50);
          waited += 50;
        }
      }
    },

    /** Renders and encodes `count` frames at exact steps (each composited as it is drawn). */
    async render(count) {
      const { encoder, fps } = state;
      for (let i = 0; i < count; i += 1) {
        if (state.error) throw state.error;
        if (!tick(1000 / fps)) throw new Error(`frame ${state.frames} did not render`);
        composite();
        const frame = new VideoFrame(state.canvas, {
          timestamp: Math.round((state.frames * 1e6) / fps),
          duration: Math.round(1e6 / fps),
        });
        encoder.encode(frame, {
          keyFrame: state.frames === 0,
          vp9: { quantizer: state.quantizer },
        });
        frame.close();
        state.frames += 1;
        while (encoder.encodeQueueSize > 4) await wait(5);
      }
      return state.frames;
    },

    /** Flushes the encoder; resolves to the frames (base64) and the stream's colour space. */
    async finish() {
      await state.encoder.flush();
      state.encoder.close();
      if (state.error) throw state.error;
      const toBase64 = (bytes) => {
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      };
      return {
        colorSpace: state.colorSpace,
        chunks: state.chunks.map((c) => ({ ...c, data: toBase64(c.data) })),
      };
    },
  };
}

// --- WebM writer ---------------------------------------------------------------------------
// The smallest WebM a browser plays and loops: EBML header, then a Segment with Info (the exact
// loop duration, so the last frame gets its full 1/30 s), one video track, Cues pointing at the
// first key frame, and one Cluster holding every frame as a SimpleBlock (8 s fits its 16-bit
// millisecond offsets).

const ID = {
  EBML: 0x1a45dfa3,
  EBMLVersion: 0x4286,
  EBMLReadVersion: 0x42f7,
  EBMLMaxIDLength: 0x42f2,
  EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282,
  DocTypeVersion: 0x4287,
  DocTypeReadVersion: 0x4285,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimecodeScale: 0x2ad7b1,
  Duration: 0x4489,
  MuxingApp: 0x4d80,
  WritingApp: 0x5741,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackUID: 0x73c5,
  TrackType: 0x83,
  FlagLacing: 0x9c,
  CodecID: 0x86,
  DefaultDuration: 0x23e383,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Colour: 0x55b0,
  MatrixCoefficients: 0x55b1,
  Range: 0x55b9,
  TransferCharacteristics: 0x55ba,
  Primaries: 0x55bb,
  Cues: 0x1c53bb6b,
  CuePoint: 0xbb,
  CueTime: 0xb3,
  CueTrackPositions: 0xb7,
  CueTrack: 0xf7,
  CueClusterPosition: 0xf1,
  Cluster: 0x1f43b675,
  Timecode: 0xe7,
  SimpleBlock: 0xa3,
};

// WebCodecs colour names → Matroska / ISO 23091-2 code points.
const MATRIX = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };
const TRANSFER = { bt709: 1, smpte170m: 6, linear: 8, 'iec61966-2-1': 13, pq: 16, hlg: 18 };
const PRIMARIES = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 };

/** Element size as an 8-byte EBML varint (always valid, keeps offsets easy to predict). */
function encodeSize(value) {
  const out = Buffer.alloc(8);
  let v = value;
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = v % 256;
    v = Math.floor(v / 256);
  }
  out[0] |= 0x01;
  return out;
}

function element(id, ...body) {
  const hex = id.toString(16);
  const data = Buffer.concat(body);
  return Buffer.concat([
    Buffer.from(hex.padStart(hex.length + (hex.length % 2), '0'), 'hex'),
    encodeSize(data.length),
    data,
  ]);
}

/** Unsigned integer element; `bytes` fixes the width (for offsets computed before writing). */
function uint(id, value, bytes = 0) {
  let hex = Math.round(value).toString(16);
  hex = hex.padStart(Math.max(bytes * 2, hex.length + (hex.length % 2)), '0');
  return element(id, Buffer.from(hex, 'hex'));
}

function float(id, value) {
  const data = Buffer.alloc(8);
  data.writeDoubleBE(value);
  return element(id, data);
}

const text = (id, value) => element(id, Buffer.from(value, 'ascii'));

function colourElement(colorSpace) {
  if (!colorSpace) return [];
  const fields = [
    [ID.MatrixCoefficients, MATRIX[colorSpace.matrix]],
    [
      ID.Range,
      typeof colorSpace.fullRange === 'boolean' ? (colorSpace.fullRange ? 2 : 1) : undefined,
    ],
    [ID.TransferCharacteristics, TRANSFER[colorSpace.transfer]],
    [ID.Primaries, PRIMARIES[colorSpace.primaries]],
  ].filter(([, value]) => value !== undefined);
  return fields.length ? [element(ID.Colour, ...fields.map(([id, value]) => uint(id, value)))] : [];
}

function muxWebm({ width, height, fps, durationMs, colorSpace, chunks }) {
  const app = 'Her Beauty render-ad-loop';
  const header = element(
    ID.EBML,
    uint(ID.EBMLVersion, 1),
    uint(ID.EBMLReadVersion, 1),
    uint(ID.EBMLMaxIDLength, 4),
    uint(ID.EBMLMaxSizeLength, 8),
    text(ID.DocType, 'webm'),
    uint(ID.DocTypeVersion, 4),
    uint(ID.DocTypeReadVersion, 2),
  );
  const info = element(
    ID.Info,
    uint(ID.TimecodeScale, 1_000_000), // 1 ms ticks
    float(ID.Duration, durationMs),
    text(ID.MuxingApp, app),
    text(ID.WritingApp, app),
  );
  const tracks = element(
    ID.Tracks,
    element(
      ID.TrackEntry,
      uint(ID.TrackNumber, 1),
      uint(ID.TrackUID, 1),
      uint(ID.TrackType, 1), // video
      uint(ID.FlagLacing, 0),
      text(ID.CodecID, 'V_VP9'),
      uint(ID.DefaultDuration, 1e9 / fps),
      element(
        ID.Video,
        uint(ID.PixelWidth, width),
        uint(ID.PixelHeight, height),
        ...colourElement(colorSpace),
      ),
    ),
  );
  const cues = (clusterPosition) =>
    element(
      ID.Cues,
      element(
        ID.CuePoint,
        uint(ID.CueTime, 0),
        element(
          ID.CueTrackPositions,
          uint(ID.CueTrack, 1),
          uint(ID.CueClusterPosition, clusterPosition, 8),
        ),
      ),
    );
  // Offsets are relative to the start of the Segment's data; the Cues' size does not depend on
  // the position it holds (fixed 8 bytes), so measure with 0 and fill in.
  const clusterPosition = info.length + tracks.length + cues(0).length;

  const blocks = chunks.map(({ key, timestamp, data }) => {
    const head = Buffer.alloc(4);
    head[0] = 0x81; // track 1
    head.writeInt16BE(Math.round(timestamp / 1000), 1); // ms from the cluster's start (0)
    head[3] = key ? 0x80 : 0x00;
    return element(ID.SimpleBlock, head, data);
  });
  const cluster = element(ID.Cluster, uint(ID.Timecode, 0), ...blocks);

  return Buffer.concat([header, element(ID.Segment, info, tracks, cues(clusterPosition), cluster)]);
}

// --- main ----------------------------------------------------------------------------------

async function main() {
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
  } catch {
    throw new Error('playwright-core not found: set PLAYWRIGHT_CORE (see the header comment)');
  }
  const quantizer = Number(args.quantizer);
  if (!Number.isInteger(quantizer) || quantizer < 0 || quantizer > 63) {
    throw new Error('--quantizer must be a whole number from 0 to 63');
  }

  const colors = await themeColors();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // Software WebGL: same pixels on every machine, and it works without a GPU.
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH / 2, height: HEIGHT / 2 },
      deviceScaleFactor: 2, // the high tier renders at DPR 2 → a WIDTH × HEIGHT canvas
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(pageRuntime);

    const url = new URL('/dev/ads', args.url);
    url.searchParams.set('loop', '');
    url.searchParams.set('kind', args.kind);
    url.searchParams.set('shade', args.shade);
    log(`Loading ${url.href}`);
    await page.goto(url.href, { waitUntil: 'load' });
    await page.waitForSelector('[data-loop-ready="true"] canvas', { timeout: 60_000 });
    if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);

    await page.evaluate((opts) => window.__adLoop.start(opts), {
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      warmup: WARMUP_FRAMES,
      colors,
      codec: CODEC,
      quantizer,
    });
    const total = FPS * LOOP_SECONDS;
    for (let done = 0; done < total; ) {
      done = await page.evaluate((n) => window.__adLoop.render(n), Math.min(FPS, total - done));
      log(`Rendered ${done}/${total} frames`);
    }
    const { colorSpace, chunks } = await page.evaluate(() => window.__adLoop.finish());
    if (chunks.length !== total) throw new Error(`encoded ${chunks.length} of ${total} frames`);

    const bytes = muxWebm({
      width: WIDTH,
      height: HEIGHT,
      fps: FPS,
      durationMs: LOOP_SECONDS * 1000,
      colorSpace,
      chunks: chunks.map((c) => ({ ...c, data: Buffer.from(c.data, 'base64') })),
    });
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, bytes);
    const kb = (bytes.length / 1024).toFixed(0);
    log(`Wrote ${path.relative(ROOT, args.out)} (${kb} KB, VP9 at quantizer ${quantizer})`);
    if (bytes.length > MAX_BYTES) log('Warning: over the 1.5 MB budget; raise --quantizer.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
