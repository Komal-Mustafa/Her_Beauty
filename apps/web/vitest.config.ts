import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the app's own logic: the client stores (Node) and the components that wire them
// to the UI (jsdom, chosen per file). The primitives themselves are covered in @hb/ui.
export default defineConfig({
  // tsconfig keeps JSX for Next ("preserve"); the tests compile it themselves.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // `server-only` throws outside the react-server condition; the tests run in Node / jsdom.
      'server-only': fileURLToPath(new URL('./lib/test-server-only.ts', import.meta.url)),
    },
  },
  test: { environment: 'node', include: ['lib/**/*.test.ts', 'components/**/*.test.{ts,tsx}'] },
});
