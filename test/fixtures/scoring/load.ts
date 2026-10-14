import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WeatherDayFeatures } from '../../../src/scoring/utils/daily-features.js';

interface DatedEvent {
  place: string;
  date: string;
  features: WeatherDayFeatures;
}

export function loadEventFeatures(place: string, date: string): WeatherDayFeatures {
  const events = JSON.parse(
    readFileSync(join(process.cwd(), 'test/fixtures/scoring/events.json'), 'utf8'),
  ) as DatedEvent[];
  const event = events.find((candidate) => candidate.place === place && candidate.date === date);
  if (!event) throw new Error(`No fixture for ${place} on ${date}`);
  return event.features;
}
