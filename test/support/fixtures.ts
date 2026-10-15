import { readFileSync } from 'node:fs';

export function loadFixture<Fixture = unknown>(path: string): Fixture {
  return JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8')) as Fixture;
}
