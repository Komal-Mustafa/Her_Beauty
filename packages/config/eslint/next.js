// Flat config for Next.js apps: shared rules + Next core-web-vitals.
import nextPlugin from '@next/eslint-plugin-next';
import base from './index.js';

export default [
  ...base,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
