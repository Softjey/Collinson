# Session 11: t05 activity scores

Started 2026-10-15 14:09 UTC.

## User

Hi, do what is in T05, but if you have any questions before that, ask me.

## Claude

First I'll look at what T05 is.

> `Bash` : `ls && ls docs docs/tickets 2>/dev/null; cat DECISIONS.md | head -100`
> `Bash` : `cat docs/tickets/T05-activity-scores.md; sed -n 100,200p DECISIONS.md; git log --oneline | head -20; find src test contracts -type f | grep -v node_modules | he ...`
> `Bash` : `cat contracts/graphql/schema.graphql src/activity-scores/*.ts src/activity-scores/dto/*.ts src/scoring/scoring.service.ts src/scoring/scoring.module.ts src/weat ...`
> `Bash` : `grep -n "3.5\|^## \|^### " docs/implementation-plan.md | head -80; cat package.json | sed -n 1,60p`
> `Bash` : `sed -n 1,60p docs/implementation-plan.md; sed -n 57,262p docs/implementation-plan.md; grep -n "P4\|P7\|P8\|P10\|P11" docs/implementation-plan.md | head -20`
> `Bash` : `cat src/weather/repositories/location.repository.ts prisma/sql/findOrCreateLocation.sql; grep -n "elevation" -r src --include=*.ts -il | grep -v generated; cat  ...`
> `Bash` : `grep -rn "updateElevation\|elevationM" src prisma/schema.prisma --include=*.ts --include=*.prisma | grep -v generated | grep -v "specs/"; cat src/shared/graphql ...`

## Claude

I'm reading the code to formulate questions about T05. One more check on elevation.

> `Bash` : `grep -rn "updateElevation\|elevationM" src/weather src/shared prisma/schema.prisma | grep -v "generated\|specs/" ; ls node_modules | head -3; ls node_modules/.p ...`
> `AskUserQuestion`
>   - **How do we get `location.elevation` for the response? `resolveLocation` is called BEFORE the forecast is loaded, and `LocationRef` has no elevation (while the ticket says "from Location.elevationM").**
>     - New WeatherService method (Recommended): Add `getElevation(location)` to weather / reading Location.elevationM AFTER the forecast is loaded (repository + service method). A small change outside activity-scores, but it matches the ticket (even with too_old/stale, the elevation is taken from the DB).
>     - From the forecast result: Take `data.elevationM` from the forecast SourceResult (ok/stale). Zero changes in weather, but with `too_old` the elevation will be null although it is in the DB.
>     - Add elevationM to LocationRef: resolveLocation returns the elevation, but it is updated only after the fetch, so for the first request it will be null even when the forecast succeeds.
>   - **P4 (`@photostructure/tz-lookup`) is still a Proposal and the package is not in node_modules. Can I confirm it and add it with `pnpm add`?**
>     - Yes, add it (Recommended): pnpm add @photostructure/tz-lookup@11.7.0 and record the P4 decision in DECISIONS.md in your words.
>     - Another library: Name which one (e.g. geo-tz) in the Other field.

> **Answer:** The user answered: "How do we get `location.elevation` for the response? `resolveLocation` is called BEFORE the forecast is loaded, and `LocationRef` has no elevation (while the ticket says "from Location.elevationM")."="New WeatherService method (Recommended)", "P4 (`@photostructure/tz-lookup`) is still a Proposal and the package is not in node_modules. Can I confirm it and add it with `pnpm add`?"="Remind me why you need to detect the timezone?". Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.

## Claude

The timezone is needed for three reasons, and all of them depend on the coordinates:

1. **What "today" is.** Validation says: `fromDate >= today`, `toDate <= today + 7`. In Auckland and Honolulu the same moment has different calendar dates, so without a zone the range cannot be checked.
2. **Grouping hours into days.** Open-Meteo returns hours, while scoring is computed per calendar day. The day boundaries are defined by the IANA zone.
3. **The request to Open-Meteo.** We pass the same zone as `timezone=<tz>` in forecast and marine. Then the day boundaries match validation. With `timezone=auto` they could diverge near zone borders.

The zone has to be determined offline, because it is needed before any access to data, and validation must reject the request before we load anything. If the geocoder supplied it, `activityScores` would depend on search, while by decision the ranking accepts only coordinates.

This needs a library. Shall I add `@photostructure/tz-lookup@11.7.0` and record P4 in DECISIONS.md, or would you prefer another library?

## User

I considered returning everything in UTC and letting the client convert. Why is that worse here?

## Claude

Yes, technically it would work, but it changes a product decision, and the result gets worse.

**Why UTC is worse:**
- **The score is computed for the whole day, not for hours.** It takes the maximum temperature, the sum of precipitation, the maximum wave. These are daily aggregates. If the day is in UTC, then for Auckland (UTC+13) "today" would consist of part of yesterday's and part of today's local day. The client cannot recompute this into local time, because it only has the finished score, not the hours.
- **Days lose their meaning for the user.** A surfer in Sydney asks "what is the weather tomorrow" and gets data from 10:00 of one day to 10:00 of the next.
- **"Today" for validation.** The rules `fromDate >= today` and `toDate <= today + 7` work in UTC, but near midnight a user in Tokyo or Honolulu would get an error for a date that is still valid for them.

**What would change in the project:**
- In the contract, `ScoredLocation.timezone: String!` and the description "Days are calendar days in this zone" would become `UTC`. This changes the documented decision about "today in the location's time zone", which is recorded in DECISIONS.md and in the contract.
- The library is not needed, `TimeZoneService` disappears, the code is simpler.
- We would pass `timezone=UTC` to Open-Meteo.

**Options:**
1. Keep the zone local and add `@photostructure/tz-lookup`. This matches the contract, DECISIONS and the ticket (my recommendation).
2. Switch to UTC. Then I will update the contract, DECISIONS and the ticket, but you decide this as a change of decision.

Which option do you choose?

## User

So the plan is to determine the timezone from the coordinates?

## Claude

Yes. The plan is:

1. The coordinates arrive, `latitude` and `longitude`.
2. I round them to 2 decimals.
3. `TimeZoneService` takes the IANA zone (for example `Pacific/Auckland`) from the `@photostructure/tz-lookup` library. The library works offline: the zone boundaries are built in, there are no network requests.
4. With this zone I do four things:
   - compute "today" for date validation;
   - pass it to `resolveLocation` (the zone is stored in `Location`);
   - pass it to forecast and marine as `timezone=<tz>`;
   - group the hours into local days and return it in `location.timezone`.

There is no separate service or API for the zone. It is one function "coordinates → a string with the zone name", called once per request.

Do you confirm option 1 (local zone via tz-lookup)? Then I add the package, record P4 in DECISIONS.md and start with the tests.

## User

Okay, I looked, the library is fine, you can use it

> `Bash` : `pnpm add @photostructure/tz-lookup@11.7.0 2>&1 | tail -5; git diff --stat; cat test/support/builders/weather.ts test/support/builders/day.ts; cat src/weather/ma ...`
> `Bash` : `python3 - <<'E' p='DECISIONS.md' s=open(p).read() a="- **TypeScript, NestJS, GraphQL" s=s.replace(a,"- **The time zone is determined offline from the coordinate ...`

*[interrupted by the user]*

## User

Do not commit yet, commit after my review

> `Bash` : `git reset --soft HEAD~1 && git reset -q && git log --oneline | head -1 && git status --short`

## Claude

The commit is rolled back. `HEAD` is back at `e0942b8`, and the changes remain uncommitted:
- `DECISIONS.md`: a line about determining the zone offline via `@photostructure/tz-lookup`;
- `package.json` and `pnpm-lock.yaml`: the new dependency.

From now on I commit nothing until you review. I write the code and tests without commits, and you will tell me later when to make the commits. One clarification about the way: commit everything in one commit, or split by ticket steps (validation, orchestration, mapping)? Per AGENTS.md by steps, but you decide.

Shall I continue with tests first (TDD) for step 1 (time zone and date validation), or stop first so you can look at the changes above?

## User

continue with the whole of t05 and I will review everything afterwards

> `Bash` : `cat node_modules/@photostructure/tz-lookup/index.d.ts | head -30; cat src/shared/graphql/scalars/date-time.scalar.ts | head -30; cat src/scoring/activities/acti ...`
> `Bash` : `sed -n 1,30p src/weather/utils/specs/freshness.policy.spec.ts; cat src/scoring/activities/specs/activity-catalogue.spec.ts | head -30; sed -n 60,140p src/scorin ...`
> `Bash` : `mkdir -p src/shared/specs && cat > src/shared/specs/local-date.spec.ts <<'E' import { addDays, datesBetween, localDateOf } from '../local-date.js'; describe('lo ...`
> `Bash` : `python3 - <<'E' p='src/scoring/mappers/daily-features.mapper.ts' s=open(p).read() a=s.index(" const dateFormat = new Intl") b=s.index(" const hoursByDate") s=s[ ...`
> `Bash` : `cd src/activity-scores && mkdir -p specs utils entities mappers && git mv dto/activity-scores.input.ts enti ...`

## Claude

Writing the time zone and the date validator (the tests already fail, as intended), then orchestration.

> `Bash` : `cd src/activity-scores && cat > time-zone.service.ts <<'E' import { Injectable } from '@nestjs/common'; imp ...`
> `Bash` : `cd src && cat > shared/validation/deduplicate.decorator.ts <<'E' import { Transform } from 'class-transform ...`
> `Bash` : `cd src/activity-scores && mkdir -p utils/specs mappers/specs && cat > utils/specs/source-result-combiner.sp ...`
> `Bash` : `grep -n "locationRepository\|resolveLocation\|describe(" src/weather/specs/weather.service.spec.ts | head -30; sed -n 60,140p src/weather/specs/weather.service. ...`
> `Bash` : `sed -n 95,112p src/weather/repositories/specs/weather.repositories.int-spec.ts`
> `Bash` : `python3 - <<'E' p='src/weather/repositories/specs/weather.repositories.int-spec.ts' s=open(p).read() anchor=" expect(row.elevationM).toBe(33.5);\n });\n" new=an ...`
> `Bash` : `cd src/activity-scores && cat > entities/activity-scores.result.ts <<'E' import type { Activity } from '../ ...`
> `Bash` : `cd src/activity-scores && cat > mappers/specs/hourly-data.mapper.spec.ts <<'E' import { buildForecastData,  ...`
> `Bash` : `python3 - <<'E' p='activity-scores.service.ts' s=open(p).read() s=s.replace("\nexport type { DayOutcome };\n","") s=s.replace("import type { DataSource, DayCond ...`
> `Bash` : `git status --short; grep -rn "ACTIVITY_SCORES" test src | grep -v "queries.ts"; cat test/graphql.e2e-spec.ts | head -60; cat test/support/scoring-helpers.ts | h ...`
> `Bash` : `sed -n 56,140p test/graphql.e2e-spec.ts`
> `Bash` : `python3 - <<'E' p='test/graphql.e2e-spec.ts' s=open(p).read() a=s.index(" it('accepts valid input and reaches the resolver'") b=s.index(" describe('error format ...`
> `Bash` : `sed -i "s| it('serves a 10 hour old snapshot as stale with the original fetch time', async () => {\n await storeSnapshotThenFailForecast(10);||" test/activity-s ...`
> `Bash` : `python3 - <<'E' p='test/activity-scores.e2e-spec.ts' s=open(p).read() s=s.replace(" const response = await scores({ activities: ['OUTDOOR_SIGHTSEEING', 'SURFING ...`
> `Bash` : `python3 - <<'E' p='test/activity-scores.e2e-spec.ts' s=open(p).read() s=s.replace(" console.log(JSON.stringify(response.body.errors));\n","") s=s.replace("const ...`
> `Bash` : `sed -i "s|const barcelonaForecast = loadFixture('weather/forecast-barcelona.json');|const barcelonaForecast = loadFixture<{ hourly: { time: number[] } }>('weath ...`
> `Bash` : `python3 - <<'E' p='test/activity-scores.e2e-spec.ts' s=open(p).read() s=s.replace("const barcelonaForecast = loadFixture('weather/forecast-barcelona.json');","c ...`
> `Bash` : `python3 - <<'E' p='docs/implementation-plan.md' s=open(p).read() old=s[s.index(" activity-scores/ activity-scores.module.ts"):] old=old[:old.index("\n health/") ...`

## Claude

T05 is done, nothing is committed. All the changes are uncommitted, waiting for your review. I ran the unit tests (566), e2e (69), the weather repository integration tests (23), `tsc` and `eslint`, all green.

## What was done
- **Validation.** `TimeZoneService` determines the zone offline via `@photostructure/tz-lookup`. `DateRangeValidator` checks the date range using `Clock` and "today" in the location's zone. `ActivityScoresInput` deduplicates `activities`. All violations give `BAD_USER_INPUT` before any access to data.
- **Orchestration.** `ActivityScoresService`: coordinate rounding, `resolveLocation`, parallel loading of forecast and marine (only the needed sources), daily features once per request. `SourceResultCombiner` implements P7. A day missing from the data gets `NO_DATA`.
- **Mapping.** `ResultMapper`, `HourlyDataMapper`, `union-type.resolvers.ts` (`__resolveType` for both unions) and a resolver instead of the stub.
- **Tests.** Unit tests from the ticket's list and the e2e `test/activity-scores.e2e-spec.ts` (23 scenarios). I changed `test/graphql.e2e-spec.ts`: removed the test "accepts valid input and reaches the resolver", because it relied on the stub.

## What to look at during review
1. **Weather changed outside the ticket.** Added `WeatherService.getElevation` and `LocationRepository.findElevation`, this is your choice (a new method). Tests added.
2. **DRY refactoring.** `localDateOf` and `addDays` were in `freshness.policy.ts`, and another variant in `daily-features.mapper.ts`. Now they are in `src/shared/local-date.ts`, and both places switched to it.
3. **Coordinates.** `roundCoordinate` in `shared/coordinates.ts`, and `toE2` no longer returns `-0`.
4. **Structure.** `dto/` renamed to `entities/`, as in `AGENTS.md`.
5. **Zone in the response.** Days are grouped and returned in `location.timezone`, that is, in the zone stored in the DB. It matches the offline one unless the `Location` row already holds a different one.
6. **`__typename` in result types.** Results carry `__typename`, and `__resolveType` just returns it. This is more explicit than guessing the type by shape, but duplicates the name. Tell me if you want it differently.
7. **Documentation.** A line about tz-lookup was added to `DECISIONS.md` in your words. In `docs/implementation-plan.md`, P4 is marked confirmed and the `activity-scores` section is updated. I did not touch the ticket in `docs/tickets/`.

When you finish the review, tell me how to commit: in one commit or by ticket steps (dependency and zone, validation, orchestration, mapping, e2e).

## User

Create a separate service for location so that weather does not know about location, it is not its responsibility

> `Bash` : `cat src/weather/repositories/forecast.repository.ts; sed -n 1,40p prisma/schema.prisma; grep -rn "LocationRepository\|LocationRef\|resolveLocation" src test --i ...`
> `Bash` : `sed -n 1,35p src/weather/repositories/specs/weather.repositories.int-spec.ts; grep -n "locations\." src/weather/repositories/specs/weather.repositories.int-spec ...`
> `Bash` : `mkdir -p src/location/entities src/location/repositories/specs src/location/specs && git mv src/weather/repositories/location.repository.ts src/location/reposit ...`
> `Bash` : `python3 - <<'E' import re p='src/weather/repositories/specs/weather.repositories.int-spec.ts' s=open(p).read() a=s.index(" describe('LocationRepository'") b=s.i ...`

## Claude

Now I'm wiring `LocationService` into `activity-scores` and `AppModule`.

> `Bash` : `python3 - <<'E' p='src/activity-scores/activity-scores.service.ts' s=open(p).read() s=s.replace("import { ScoringService }","import { LocationService } from '.. ...`
> `Bash` : `sed -i '' '15d' src/weather/specs/weather.service.spec.ts && npx prettier --write src/weather/specs >/dev/null; npx tsc --noEmit && npx eslint "{src,test}/**/*. ...`
> `Bash` : `python3 - <<'E' p='docs/implementation-plan.md' s=open(p).read() s=s.replace(" resolveLocation(lat: number, lon: number, timezone: string): Promise<LocationRef> ...`
> `Bash` : `python3 - <<'E' p='docs/implementation-plan.md' s=open(p).read() s=s.replace("Currently that is `WeatherService` and\n `ScoringService`;","Currently that is `Lo ...`

## Claude

`LocationService` is now separate, `weather` no longer finds or creates locations. Nothing is committed. Unit (568), integration (40), e2e (69), `tsc` and `eslint` are green.

## What changed
- **New module `src/location/`.** `LocationModule` exports only `LocationService`. The service has two methods: `findOrCreate(latitude, longitude, timezone)` and `getElevation(location)`. `LocationRepository` moved from `weather/repositories/`, the `Location` entity is in `entities/`.
- **`WeatherService` without locations.** It no longer depends on `LocationRepository`, and the methods `resolveLocation` and `getElevation` are gone from it. It accepts a `LocationRef` from the caller and loads `getForecast` and `getMarine`.
- **`ActivityScoresService`** takes `LocationService` together with `WeatherService` and `ScoringService`. `LocationModule` is added to `AppModule`.
- **Tests.**
  - The location tests moved: the unit test in `location.service.spec.ts`, the int tests in `location.repository.int-spec.ts`, the wiring in `location.module.spec.ts`.
  - The weather int tests create location rows through the new `insertLocation` in `test/support/builders/location.ts`.
- **Documentation.** Updated `implementation-plan.md` (rules diagram, export list, layout, flow) and tickets T03 and T05.

## What is still coupled
`ForecastRepository.insert` still updates `Location.elevationM` in the same transaction as writing the snapshot. This keeps the elevation in sync with the snapshot, but weather writes to the `Location` table. If you want to remove this too, there are two options. `LocationService` gets the elevation from the latest forecast snapshot, but then `location` depends on weather tables. Or `activity-scores` itself calls `locationService.updateElevation(...)` after a successful forecast, then the write is moved out of weather, but a separate step appears in the service. Tell me which you choose, or we keep it as is.

The types `LocationRef` in weather and `Location` in location are structurally identical (`id`, `latE2`, `lonE2`, `timezone`). I deliberately do not share one type between modules, so that they do not import each other's internals.

## User

Commit the changes related to moving location into a separate module and all the small changes. Do not commit activity-scores yet

> `Bash` : `git reset -q && python3 - <<'E' p='docs/implementation-plan.md' s=open(p).read() new_layout=''' activity-scores/ activity-scores.module.ts, activity-scores.reso ...`
> `Bash` : `git commit -qm "$(cat <<'E' refactor(location): move finding and creating a location out of weather into its own module Co-Authored-By: Claude Sonnet 5.5 <norep ...`

## Claude

Committed in four commits, nothing pushed:

1. `8d8b5cc` `chore: add tz-lookup for the offline time zone of a location`: the dependency, the line in `DECISIONS.md`, the "confirmed" mark for P4 in the plan.
2. `e14b204` `refactor: share the local date helpers between weather and scoring`: `shared/local-date.ts` and the switch of `freshness.policy` and `daily-features.mapper` to it.
3. `f173a9e` `feat(shared): add roundCoordinate and never produce negative zero`.
4. `42732ee` `refactor(location): move finding and creating a location out of weather into its own module`: the `location` module, changes in weather, `LocationModule` in `AppModule`, `insertLocation` in test support, the plan and ticket documentation for T03 and T05 (only the mentions of location).

I did not commit `activity-scores`. Still uncommitted:
- `src/activity-scores/` (service, validator, zone, mappers, union resolvers, specs, module and resolver, moving `dto/` into `entities/`);
- `src/shared/validation/deduplicate.decorator.ts`;
- `test/activity-scores.e2e-spec.ts`, `test/graphql.e2e-spec.ts`, `test/support/queries.ts`, `test/support/fixtures.ts`;
- the line about the `activity-scores` structure in `docs/implementation-plan.md`.

I ran the full run after the last changes before splitting into commits. I did not check the state of HEAD separately (the commits without `activity-scores`), so I did not run types and tests on it.

## User

Can we move the from and to date validation into the resolver's validator? So that the validation happens at a stage before that?

> `Bash` : `cd src/activity-scores && cat date-range.validator.ts | head -5; sed -n 40,60p activity-scores.service.ts;  ...`
> `Bash` : `cd . && python3 - <<'E' open('src/shared/validation/round-coordinate.decorator.ts','w').write('''import { Tra ...`

## Claude

Yes, date validation now runs before the resolver and not in the service. Unit tests (571), e2e (69), `tsc` and `eslint` are green. Nothing is committed.

**How it works**
- **`DateRangeValidator` became a pipe.** It implements `PipeTransform` and is attached to the resolver argument: `@Args('input', DateRangeValidator)`. The order is: the global `ValidationPipe` (ranges, format, deduplication), then `DateRangeValidator`, then the resolver.
- **Why a pipe and not class-validator.** The check needs `Clock` and `TimeZoneService`, and a pipe gets them through DI. For a class-validator decorator I would have had to additionally configure the container in `main.ts` and in the test app.
- **The service no longer validates.** `ActivityScoresService` does not depend on the validator and works directly with valid input. Errors stay `BAD_USER_INPUT`, because it is the same `BadRequestException`.
- **Coordinate rounding is in the input too.** So that the pipe and the service do not round separately, I added a `@RoundCoordinate()` decorator in `shared/validation/` and applied it to `latitude` and `longitude`. Now already rounded coordinates reach the pipe and the service. Side effect: `90.004` is rounded to `90` and passes, while `90.01` is rejected, as before.
- **Tests.** I rewrote the validator spec for the pipe with a real `TimeZoneService` (Madrid, Auckland, Honolulu). I added rounding cases to the input spec, including `-0.001` giving `0`, not `-0`.

The zone is determined twice: in the pipe and in the service. It is a cheap call to an offline library, and there is no shared state between them.

All of this sits next to the rest of the uncommitted `activity-scores`, so the commit waits for your review.

## User

<pasted_content id="11c1">
private dayConditions(
    input: ActivityScoresInput,
    { forecast, marine }: LoadedSources,
    timeZone: string,
  ): { date: LocalDate; conditions: DayConditions }[] {
    const weatherDays =
      forecast?.status === 'ok'
        ? this.scoringService.summariseWeatherDays(
            this.hourlyDataMapper.toHourlyWeather(forecast.data.hours),
            timeZone,
          )
        : null;
    const marineDays =
      marine?.status === 'ok'
        ? this.scoringService.summariseMarineDays(
            this.hourlyDataMapper.toHourlyMarine(marine.data.hours),
            timeZone,
          )
        : null;

    return datesBetween(input.fromDate, input.toDate).map((date) => ({
      date,
      conditions: {
        weather: weatherDays?.get(date) ?? null,
        marine:
          marine?.status === 'ok'
            ? { hasSea: marine.data.hasSea, features: marineDays?.get(date) ?? null }
            : null,
      },
    }));
  }
</pasted_content id="11c1">

Make this method readable

> `Bash` : `python3 - <<'E' p='src/activity-scores/activity-scores.service.ts' s=open(p).read() a=s.index(" private dayConditions(") b=s.index(" private resultFor(") new='' ...`

## Claude

I split `dayConditions` into three small methods. `tsc`, `eslint` and the 23 `activityScores` e2e scenarios are green. Nothing is committed.

```ts
private dayConditions(input, loadedSources, timeZone) {
  const weatherDays = this.weatherDaysOf(loadedSources.forecast, timeZone);
  const sea = this.seaOf(loadedSources.marine, timeZone);

  return datesBetween(input.fromDate, input.toDate).map((date) => ({
    date,
    conditions: {
      weather: weatherDays.get(date) ?? null,
      marine: sea && { hasSea: sea.hasSea, features: sea.days.get(date) ?? null },
    },
  }));
}
```

- **`weatherDaysOf`**: returns the daily weather features, and an empty map if the forecast is not `ok`. Because of this, the `?.` and the `null` branches for weather disappeared from `dayConditions`.
- **`seaOf`**: returns `{ hasSea, days }` or `null` when marine was not requested or is unavailable. `marine: sea && {...}` reads as "if there is a sea, build it, otherwise `null`".
- The names `forecast`/`marine` and `status === 'ok'` are checked in one place each, not in three.

The behaviour did not change.

## User

Good, commit the changes

*[interrupted by the user]*

## User

commit step by step in logical parts

> `Bash` : `git status --short && cp src/activity-scores/activity-scores.resolver.ts /tmp/resolver_full.ts && git show HEAD:src/activity-scores/activity-scores.resolver.ts  ...`
> `Bash` : `commit() { git commit -q -F - <<E $1 Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com> E } commit "feat(activity-scores): validate the input and the dat ...`
> `Bash` : `npx tsc --noEmit && echo TSC_OK`

## Claude

I committed the `activity-scores` changes in five commits, nothing pushed. The tree is clean, and `tsc` passes on the final commit. I did not rerun the tests after splitting; the last full run was on the same files before the split. I did not build or test the intermediate commits separately.

1. `c7aeeb5` `feat(activity-scores): validate the input and the date range before the resolver runs`: `ActivityScoresInput` (moved from `dto/` to `entities/`), the `Deduplicate` and `RoundCoordinate` decorators, `TimeZoneService`, `DateRangeValidator` as a pipe, their specs. The stub resolver got only the new import path.
2. `da93d27` `feat(activity-scores): combine the source results of an activity`: `SourceResultCombiner` and its spec.
3. `d6d773c` `feat(activity-scores): map scoring and weather outcomes to the contract types`: result types, `ResultMapper`, `HourlyDataMapper`, the union resolvers with specs.
4. `58ac02f` `feat(activity-scores): score the requested activities end to end`: `ActivityScoresService`, the resolver, the module, the e2e spec, changes in `graphql.e2e-spec.ts`, queries and fixtures.
5. `a4bf441` `docs: describe the activity-scores module layout`.

The previous four commits (tz-lookup, local-date, roundCoordinate, location) were already in the history.
