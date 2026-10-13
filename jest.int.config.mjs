import base from './jest.config.mjs';

export default {
  ...base,
  testRegex: 'src/.*\\.int-spec\\.ts$',
  testTimeout: 120_000,
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  globalTeardown: '<rootDir>/test/support/global-teardown.ts',
};
