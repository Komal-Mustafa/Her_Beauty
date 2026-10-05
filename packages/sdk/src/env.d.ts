// Next.js inlines NEXT_PUBLIC_* at build time; server-only variables (STOREFRONT_API_KEY) are read
// at run time on the server. Declared here so the SDK needs no @types/node.
declare const process: { env: Record<string, string | undefined> };
