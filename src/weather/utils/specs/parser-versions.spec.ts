import { PARSER_VERSIONS } from '../parser-versions.js';

describe('PARSER_VERSIONS', () => {
  it.each(['forecast', 'marine'] as const)('starts the %s parser at version 1', (source) => {
    expect(PARSER_VERSIONS[source]).toBe(1);
  });
});
