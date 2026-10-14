import { ACTIVITIES } from '../activity.js';
import { INDOOR_SIGHTSEEING, SKIING } from '../activity-definitions.js';
import { findDefinition, requiredSources } from '../definition-lookup.js';

describe('findDefinition', () => {
  it('finds the definition of every activity', () => {
    for (const activity of ACTIVITIES) {
      expect(findDefinition(activity).name).toBe(activity);
    }
  });

  it('fails for an unknown activity', () => {
    expect(() => findDefinition('CURLING' as never)).toThrow('CURLING');
  });

  it('fails for an activity missing from the given table', () => {
    expect(() => findDefinition('SURFING', [SKIING])).toThrow('SURFING');
  });

  it('rejects two definitions for the same activity', () => {
    expect(() => findDefinition('SKIING', [SKIING, SKIING])).toThrow('SKIING');
  });
});

describe('requiredSources', () => {
  it('requires weather and waves for surfing and skiing', () => {
    expect([...requiredSources(['SURFING', 'SKIING'])].sort()).toEqual(['WAVES', 'WEATHER']);
  });

  it('requires weather only for skiing', () => {
    expect(requiredSources(['SKIING'])).toEqual(['WEATHER']);
  });

  it('requires weather only for both sightseeing activities', () => {
    expect(requiredSources(['OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING'])).toEqual(['WEATHER']);
  });

  it('takes the sources of the definition an inverted one is based on', () => {
    expect(requiredSources(['INDOOR_SIGHTSEEING'], [INDOOR_SIGHTSEEING])).toEqual(['WEATHER']);
  });

  it('requires nothing for no activities', () => {
    expect(requiredSources([])).toEqual([]);
  });

  it('fails when a requested activity is unknown', () => {
    expect(() => requiredSources(['CURLING' as never])).toThrow('CURLING');
  });
});
