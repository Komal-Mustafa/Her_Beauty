// Next.js inlines NEXT_PUBLIC_* at build time; declared here so the SDK needs no @types/node.
declare const process: { env: Record<string, string | undefined> };
