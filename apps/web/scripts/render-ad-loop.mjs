#!/usr/bin/env node
/**
 * Renders the placeholder video ad loop, apps/web/public/placeholders/video-placeholder.webm,
 * from our own 3D ad stage (a perfume turning on the marble pedestal). No stock footage and no
 * network: headless Chromium draws the frames and its MediaRecorder encodes them.
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
 *          --bitrate <bits/s> (default 900000)
 *
 * How it stays smooth and seamless on a software GPU: a virtual clock takes over
 * requestAnimationFrame and performance.now, so every frame is rendered at an exact 1/30 s step
 * however long it takes. Frames are laid over the brand backdrop, kept in memory, then replayed in
 * real time into canvas.captureStream() + MediaRecorder. The stage turns exactly half a turn and
 * floats two cycles per 8 s (packages/three/src/ads/turntable.ts) and the perfume looks the same
 * after 180°, so frame 240 equals frame 0. An .mp4 is written as well only if this Chromium can
 * record H.264 (open-source builds cannot; VP9-in-MP4 would not help Safari, so it is skipped).
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
    bitrate: { type: 'string', default: '900000' },
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
 * Runs in the page before any app code. Installs the virtual clock and the frame recorder.
 * Everything here is browser code; it talks to Node only through page.evaluate.
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

  const state = { frames: [], canvas: null, ctx: null, source: null, frameMs: 0, colors: {} };

  window.__adLoop = {
    async start({ width, height, fps, warmup, colors }) {
      state.source = document.querySelector('[data-loop-ready] canvas');
      if (!state.source) throw new Error('stage canvas not found');
      state.frameMs = 1000 / fps;
      state.canvas = document.createElement('canvas');
      state.canvas.width = width;
      state.canvas.height = height;
      state.ctx = state.canvas.getContext('2d');
      state.colors = colors;
      // Freeze time, then wait for the render loop's pending real frame to land in our queue (a
      // software GPU can take a while to reach it; other one-off callbacks may arrive first).
      now = realNow();
      for (let rendered = 0, waited = 0; rendered < warmup; ) {
        if (queue.size > 0) {
          if (tick(state.frameMs)) rendered += 1;
        } else if (waited > 20_000) {
          throw new Error('the render loop never reached the virtual clock');
        } else {
          await wait(50);
          waited += 50;
        }
      }
    },

    /** Renders `count` frames at exact steps; each is composited in the same task it is drawn. */
    render(count) {
      const { ctx, canvas, colors } = state;
      const w = canvas.width;
      const h = canvas.height;
      for (let i = 0; i < count; i += 1) {
        if (!tick(state.frameMs)) throw new Error(`frame ${state.frames.length} did not render`);
        // A soft pink halo behind the product fading to pure white edges: white survives the
        // YUV round trip exactly, so letterboxing on the white card shows no seam.
        ctx.fillStyle = colors.white;
        ctx.fillRect(0, 0, w, h);
        const glow = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, w * 0.6);
        glow.addColorStop(0, colors['pink-100']);
        glow.addColorStop(0.5, colors['blush-50']);
        glow.addColorStop(1, colors.white);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(state.source, 0, 0, w, h);
        state.frames.push(ctx.getImageData(0, 0, w, h));
      }
      return state.frames.length;
    },

    supports(mimeType) {
      return MediaRecorder.isTypeSupported(mimeType);
    },

    /** Replays the frames in real time into MediaRecorder; resolves to base64. */
    async record(mimeType, bitsPerSecond) {
      const { canvas, ctx, frames, frameMs } = state;
      const stream = canvas.captureStream(0);
      const [track] = stream.getVideoTracks();
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitsPerSecond });
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));

      ctx.putImageData(frames[0], 0, 0);
      recorder.start();
      const t0 = realNow();
      for (let i = 0; i < frames.length; i += 1) {
        const due = t0 + i * frameMs - realNow();
        if (due > 0) await wait(due);
        ctx.putImageData(frames[i], 0, 0);
        track.requestFrame();
      }
      await wait(Math.max(0, t0 + frames.length * frameMs - realNow()));
      recorder.stop();
      await stopped;

      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(binary);
    },
  };
}

// --- WebM duration -------------------------------------------------------------------------
// MediaRecorder stamps Duration with the last frame's time (7.967 s for 240 frames), so the last
// frame gets no screen time before the loop restarts: set it to the full 8 s. Older Chromium wrote
// "live" WebM with no Duration at all; then it is inserted (like the fix-webm-duration package),
// which is only safe while the Segment has an unknown size and no SeekHead offsets would shift.

const EBML_SEGMENT = 0x18538067;
const EBML_SEEK_HEAD = 0x114d9b74;
const EBML_INFO = 0x1549a966;
const EBML_TIMECODE_SCALE = 0x2ad7b1;
const EBML_DURATION = 0x4489;

function readId(buf, pos) {
  let length = 1;
  while (length <= 4 && !(buf[pos] & (0x80 >> (length - 1)))) length += 1;
  let id = 0;
  for (let i = 0; i < length; i += 1) id = id * 256 + buf[pos + i];
  return { id, length };
}

function readSize(buf, pos) {
  let length = 1;
  while (length <= 8 && !(buf[pos] & (0x80 >> (length - 1)))) length += 1;
  let value = buf[pos] & (0xff >> length);
  for (let i = 1; i < length; i += 1) value = value * 256 + buf[pos + i];
  return { length, value, unknown: value === 2 ** (7 * length) - 1 };
}

function readUint(buf, pos, length) {
  let value = 0;
  for (let i = 0; i < length; i += 1) value = value * 256 + buf[pos + i];
  return value;
}

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

/** First element with id `wanted` among the siblings in [from, to). */
function findElement(buf, from, to, wanted) {
  for (let pos = from; pos < to; ) {
    const id = readId(buf, pos);
    const size = readSize(buf, pos + id.length);
    const body = pos + id.length + size.length;
    if (id.id === wanted) return { start: pos, idLength: id.length, size, body };
    if (size.unknown) return null;
    pos = body + size.value;
  }
  return null;
}

function withDuration(input, durationMs) {
  const buf = Buffer.from(input);
  const segment = findElement(buf, 0, buf.length, EBML_SEGMENT);
  if (!segment) return null;
  const segmentEnd = segment.size.unknown ? buf.length : segment.body + segment.size.value;
  const info = findElement(buf, segment.body, segmentEnd, EBML_INFO);
  if (!info || info.size.unknown) return null;
  const infoEnd = info.body + info.size.value;

  const scale = findElement(buf, info.body, infoEnd, EBML_TIMECODE_SCALE);
  const nsPerTick = scale ? readUint(buf, scale.body, scale.size.value) : 1_000_000;
  const ticks = (durationMs * 1_000_000) / nsPerTick;

  const existing = findElement(buf, info.body, infoEnd, EBML_DURATION);
  if (existing) {
    if (existing.size.value === 4) buf.writeFloatBE(ticks, existing.body);
    else if (existing.size.value === 8) buf.writeDoubleBE(ticks, existing.body);
    else return null;
    return buf;
  }

  const seekHead = findElement(buf, segment.body, info.start, EBML_SEEK_HEAD);
  if (!segment.size.unknown || seekHead) return null;
  const duration = Buffer.alloc(11);
  duration.writeUInt16BE(EBML_DURATION, 0);
  duration[2] = 0x88; // size 8
  duration.writeDoubleBE(ticks, 3);
  return Buffer.concat([
    buf.subarray(0, info.start + info.idLength),
    encodeSize(info.size.value + duration.length),
    buf.subarray(info.body, infoEnd),
    duration,
    buf.subarray(infoEnd),
  ]);
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
    });
    const total = FPS * LOOP_SECONDS;
    for (let done = 0; done < total; ) {
      done = await page.evaluate((n) => window.__adLoop.render(n), Math.min(FPS, total - done));
      log(`Rendered ${done}/${total} frames`);
    }

    const outputs = [{ file: args.out, mime: 'video/webm;codecs=vp9', fixDuration: true }];
    if (await page.evaluate(() => window.__adLoop.supports('video/mp4;codecs=avc1.42E01E'))) {
      outputs.push({
        file: args.out.replace(/(\.webm)?$/, '.mp4'),
        mime: 'video/mp4;codecs=avc1.42E01E',
        fixDuration: false,
      });
    } else {
      log('This Chromium cannot record H.264, so no .mp4 (VP9-in-MP4 would not help Safari).');
    }

    for (const { file, mime, fixDuration } of outputs) {
      log(`Recording ${LOOP_SECONDS} s as ${mime}…`);
      const base64 = await page.evaluate(
        ([m, bits]) => window.__adLoop.record(m, bits),
        [mime, Number(args.bitrate)],
      );
      let bytes = Buffer.from(base64, 'base64');
      if (fixDuration) {
        const fixed = withDuration(bytes, LOOP_SECONDS * 1000);
        if (fixed) bytes = fixed;
        else log('Could not set the WebM duration; the last frame may be skipped when looping.');
      }
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      const kb = (bytes.length / 1024).toFixed(0);
      log(`Wrote ${path.relative(ROOT, file)} (${kb} KB)`);
      if (bytes.length > MAX_BYTES) log(`Warning: over the 1.5 MB budget; lower --bitrate.`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
