import { ACTIVITIES } from '../../entities/activity.js';
import { ALL_ACTIVITY_SCORERS, INDOOR_SIGHTSEEING, SKIING, SURFING } from '../activities.js';
import { ActivityCatalogue } from '../activity-catalogue.js';

describe('ActivityCatalogue', () => {
  const catalogue = new ActivityCatalogue(ALL_ACTIVITY_SCORERS);

  it('has a scorer for every activity', () => {
    for (const activity of ACTIVITIES) {
      expect(catalogue.scorerFor(activity).activity).toBe(activity);
    }
  });

  it('fails for an unknown activity', () => {
    expect(() => catalogue.scorerFor('CURLING' as never)).toThrow('CURLING');
  });

  it('fails for an activity it was not given a scorer for', () => {
    expect(() => new ActivityCatalogue([SKIING]).scorerFor('SURFING')).toThrow('SURFING');
  });

  it('rejects two scorers for the same activity', () => {
    expect(() => new ActivityCatalogue([SKIING, SKIING]).scorerFor('SKIING')).toThrow('SKIING');
  });

  describe('requiredSourcesOf', () => {
    it('requires weather and waves for surfing and skiing', () => {
      expect([...catalogue.requiredSourcesOf(['SURFING', 'SKIING'])].sort()).toEqual(['WAVES', 'WEATHER']);
    });

    it('requires weather only for skiing and for both sightseeing activities', () => {
      expect(catalogue.requiredSourcesOf(['SKIING'])).toEqual(['WEATHER']);
      expect(catalogue.requiredSourcesOf(['OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING'])).toEqual(['WEATHER']);
    });

    it('takes the sources of the scorer an opposite scorer is based on', () => {
      expect(new ActivityCatalogue([INDOOR_SIGHTSEEING]).requiredSourcesOf(['INDOOR_SIGHTSEEING'])).toEqual([
        'WEATHER',
      ]);
    });

    it('requires nothing for no activities', () => {
      expect(catalogue.requiredSourcesOf([])).toEqual([]);
    });

    it('fails when a requested activity is unknown', () => {
      expect(() => catalogue.requiredSourcesOf(['CURLING' as never])).toThrow('CURLING');
    });

    it('lists the sources of surfing without duplicates', () => {
      expect(catalogue.requiredSourcesOf(['SURFING', 'SURFING'])).toEqual(SURFING.requiredSources);
    });
  });
});
