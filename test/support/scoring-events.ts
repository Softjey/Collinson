import type { WeatherDayFeatures } from '../../src/scoring/utils/daily-features.js';
import { loadFixture } from './fixtures.js';

interface DatedEvent {
  place: string;
  date: string;
  features: WeatherDayFeatures;
}

export function loadEventFeatures(place: string, date: string): WeatherDayFeatures {
  const event = loadFixture<DatedEvent[]>('scoring/events.json').find(
    (candidate) => candidate.place === place && candidate.date === date,
  );
  if (!event) throw new Error(`No fixture for ${place} on ${date}`);
  return event.features;
}
