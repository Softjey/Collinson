# T02 Scoring

| | |
|---|---|
| Depends on | T01 |
| Unblocks | T05 |
| Wave | 2, parallel with T03 and T04 |

## Goal

The whole scoring model as pure, fully unit-tested classes: daily features from hourly data, the activities
declared as scorers, and the categories. No database, no HTTP, no import from `weather`. Each activity is a
declaration, so adding one is adding a declaration.

References: [technical spec](../technical-spec.md) sections 8 and 9;
[implementation plan](../implementation-plan.md) sections 3.3 and 2 (P8, P9).

Touches only `src/scoring/` and `test/fixtures/scoring/`.

## Scope

### 1. Core

- `utils/math.ts`: `clamp`, piecewise-linear interpolation through anchors (flat outside them), step-table lookup by
  lower bound (so the gaps between printed bands, such as 6.99 to 7, cannot fall through).
- `entities/`: only types. `day-features.ts` holds the plain types of the module: `DayConditions`, `DayOutcome`, the daily features and the
  hourly inputs, with descriptive names and units.
- `formulas/curves.ts`, `formulas/formula-parts.ts`: `Curve` (piecewise linear, step table, polynomial, peak
  normalised extreme value), `Condition`, `Combiner` and `DerivedFeature`, each with static factories.
- `activities/activity-scorers.ts`: `ActivityScorer`, `FormulaScorer` and `OppositeScorer`; `activities/activity-catalogue.ts`:
  `ActivityCatalogue`.
- `activities/activities.ts`: the four activities declared with every weight, threshold, table and anchor of spec
  section 8 in one place.
- `utils/score-scale.ts`: `ScoreScale` rounds the score to 2 decimals, then maps it to category index 1 to 8 and
  the category name (spec 8.6).
- `mappers/daily-features.mapper.ts`: groups hours into local calendar days by IANA time zone and computes the
  aggregates of spec 8.1. Nulls are skipped; a feature is null only when every hourly value of the day is null.
- `mappers/feature-values.mapper.ts`: flattens a `DayConditions` into the feature record the formulas read.
- `scoring.service.ts`: the only thing the module exports.

### 2. Outdoor sightseeing (spec 8.4)

- Humidex from `maxTemperatureC` and `meanRelativeHumidityPercent`, the four rating tables, `HCI = 4 TC + 2 A + 3 P + W`, clamp, then the two
  caps (0.5 from 6 mm; 0.2 from 60 km/h maximum wind or 25 mm).
- Indoor sightseeing is declared on top of this scorer.

### 3. Indoor sightseeing (spec 8.5)

- `0.5 + 0.5 * (1 - outdoor)` using the outdoor score after the caps.

### 4. Skiing (spec 8.2)

- `uSnow`, `uWind`, `uTemp`, `uCloud`, the weighted sum, then the rain and snow depth multipliers.
- `max(f)` of the temperature function is computed numerically once at module load, not hard-coded.

### 5. Surfing (spec 8.3)

- Three piecewise-linear factors and the geometric combination; 0 when any factor is 0.
- Requires both `WEATHER` (wind) and `WAVES`.

### 6. Fixtures

- The dated events of spec section 9 (Hong Kong, London, Beaver Creek). The spec does not list their humidity,
  so the daily values are re-read once from the Open-Meteo archive and committed as static JSON. Tests never
  call the network.

## Tests first

Core:

- `clamp` below, inside and above; interpolation on anchors, between them and outside; step table at every
  boundary.
- Category at every band edge: 0.09 / 0.10, 0.39 / 0.40, 0.49 / 0.50, 0.59 / 0.60, 0.69 / 0.70, 0.79 / 0.80,
  0.89 / 0.90, 1.00; a value such as 0.395 rounds before it is classified; values outside 0 to 1 are rejected.
- Daily features: a positive-offset zone, a negative-offset zone, and a DST change (23 and 25 hour days); each
  aggregate; nulls skipped; all-null gives a null feature; a date with no hours gives no entry.
- Registry: unknown activity fails; required sources for `[SURFING, SKIING]` are weather and waves, for
  `[SKIING]` weather only.

Outdoor and indoor:

- Humidex against hand-computed values, including 42 C at 25% (rating 0) and 32.8 C at 86% (50.9, rating 0).
- Each rating table at its edges, including precipitation -1 at 25 mm and wind -10 at 70 km/h.
- Score never leaves 0 to 1 when ratings are negative.
- Caps: 5.99 mm not capped, 6 mm capped at 0.5; 59.9 km/h not capped, 60 km/h capped at 0.2; 25 mm capped at
  0.2; a score already below a cap is unchanged.
- Fixtures: London 2022-02-18 is 0.63 before the caps and 0.20 after; Hong Kong 2023-09-02 is below 0.10.
- Missing weather features give `NO_DATA`.
- Indoor is in 0.5 to 1, falls as outdoor rises, and is `NO_DATA` only when outdoor is.

Skiing:

- `NO_SNOW` when depth and snowfall are both 0; scored when either is positive.
- `uSnow` at 0 hours, at 5 hours and 0 above 5; `uWind` with the km/h to m/s conversion; `uTemp` is 1 near
  3 C and 0 below about -12 C and above about 15 C; `uCloud` is 1 at 25% and 0 at 100%.
- Rain multiplier: 1 at 0 mm, 0 at 3 mm and above. Depth multiplier: linear to 0.3 m, 1 above.
- Fixtures: Beaver Creek 2022-12-02 is 0.45, 2023-12-01 is 0.13, 2023-12-02 is 0.14.
- Missing features give `NO_DATA`, checked before `NO_SNOW`.

Surfing:

- `NO_SEA` when `hasSea = false`, even when weather is missing.
- Each factor at every anchor and at one point between each pair of anchors.
- Score 0 when wave height is 0.3 m or less, period is 5 s or less, or wind is 55 km/h or more.
- A known combination checked against the exponents 0.35, 0.35, 0.30.
- `NO_DATA` when the sea exists but waves or wind are missing for the day.

## Done when

- `src/scoring` imports nothing outside itself and has no I/O.
- All four activities are records in the table and every test above passes.

## Out of scope

Fetching or storing data, mapping to GraphQL types, any change to the formulas.
