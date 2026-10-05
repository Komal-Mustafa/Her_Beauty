// Stand-in for the `server-only` marker package in unit tests (see vitest.config.ts): the real one
// throws outside the react-server condition, and the tests run in plain Node or jsdom.
export {};
