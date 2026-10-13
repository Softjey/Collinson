import base from './jest.int.config.mjs';

export default {
  ...base,
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
};
