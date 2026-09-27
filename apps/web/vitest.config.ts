import { defineConfig } from 'vitest/config';

// Unit tests for the app's pure logic (client stores). Components are covered in @hb/ui.
export default defineConfig({ test: { environment: 'node', include: ['lib/**/*.test.ts'] } });
