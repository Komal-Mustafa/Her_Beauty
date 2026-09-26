import base from '@hb/config/eslint';

// Client components import "@hb/auth/client" (src/client). That entry must never pull in the
// server-only modules: core and index (next/headers, server-only), qr (Node Buffer), cookies and
// state (they only belong on the server). Types are fine.
const SERVER_ONLY = [
  '../core',
  '../index',
  '../qr',
  '../cookies',
  '../state-cookies',
  '../refresh',
  '../http',
  '../middleware',
  'server-only',
  'next/headers',
  '@hb/auth',
  '@hb/auth/middleware',
];

export default [
  ...base,
  {
    files: ['src/client/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: SERVER_ONLY,
              allowTypeImports: true,
              message: 'Client code: import pure modules or types only (see src/client/index.ts).',
            },
          ],
        },
      ],
    },
  },
];
