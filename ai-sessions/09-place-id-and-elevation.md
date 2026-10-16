# Session 09: place id and elevation

Started 2026-10-15 07:17 UTC.

## User

Hi, check why the GraphQL contract has the decision that place id is a string, while in the DB it is a number, and why elevation has different names

> `Bash` : `git ls-files | grep -Ev 'package-lock|\.png$' | head -100; grep -rniE "elevation|placeId|place_id|\bid\b" --include=*.graphql --include=*.prisma --include=*.md  ...`
> `Bash` : `grep -rniE "elevation|altitude|placeId|place_id|openMeteoId|geonames" contracts prisma/schema.prisma DECISIONS.md docs src --include=* | grep -v node_modules |  ...`
> `Bash` : `grep -rniE "elevation|altitude|placeId|place_id|openMeteoId|geonames" contracts prisma/schema.prisma DECISIONS.md docs src | head -60`

## Claude

Found it. I'm looking at the contract and the places in the docs where this is recorded.

> `Bash` : `sed -n 60,115p contracts/graphql/schema.graphql; grep -n -iE "string|GeoNames|id\b" docs/tickets/T04-location-search.md | head -20; grep -n -iE "place|geonames| ...`

## Claude

In short: this is not a separate "accepted decision" with a rationale. These are two independent but consistent layers, and the difference is intentional. There is nothing about it in DECISIONS.md.

**1. `Place.id`: `ID!` (string) in GraphQL, `Int` in the DB**

- In the DB, [prisma/schema.prisma:92](prisma/schema.prisma#L92) `Place.id` is the GeoNames id from the Open-Meteo geocoder. It is an integer, so it is `Int @id` without autoincrement.
- The contract [contracts/graphql/schema.graphql](contracts/graphql/schema.graphql) has `id: ID!`. The `ID` scalar in GraphQL is always serialized as a string, so `Int` would make no sense there.
- In [T04-location-search.md:33](docs/tickets/T04-location-search.md#L33) it is written as "`Place.id` is the GeoNames id as a string". So the resolver has to do `String(place.id)`. This was not discussed as a separate decision, it follows from choosing `ID` for the identifier.
- This is common practice: the client should treat the id as an opaque token. If the geocoder is ever replaced, the id format can be changed without changing the contract.

**2. `elevation` in GraphQL, `elevationM` in the DB**

- This is also not a decision, just different conventions. The DB has the unit suffix: `elevationM` in `Place`, `Location` and `ForecastSnapshot`. In the contract the field is called `elevation`, and the unit (metres) is given in the description: "Metres above sea level".
- The name `elevation` in the contract was most likely taken from the Open-Meteo response (see [implementation-plan.md:28](docs/implementation-plan.md#L28)). The `M` suffix was added only on the DB side, in the schema draft (commit `848fb2f`).
- The mapping `elevation` ← `Location.elevationM` is described in [implementation-plan.md:182](docs/implementation-plan.md#L182) and [T05:47](docs/tickets/T05-activity-scores.md#L47).

Both differences work as long as the resolvers map explicitly. The risk is that nothing guarantees it automatically: if a `Place` is returned directly from Prisma, `id` will go out as a number (GraphQL itself will coerce `Int` to `ID`), and `elevation` will be `null`, because the model has no `elevation` field.

Do you want me to unify the names (for example `elevationM` everywhere, or `elevation` in the DB), or leave it as it is and record it in DECISIONS.md? By your rules I will not write anything in DECISIONS.md until you confirm.

## User

Is there any benefit from it being a string in GraphQL?

## Claude

The benefit here is small, and most of the "benefit" is just a GraphQL convention.

**What `ID` (a string) really gives:**
- **Opacity.** The client does not rely on the id being numeric. If the geocoder is replaced or a composite key is introduced (for example `geonames:2643743`), the contract will not break. This is the only real argument, but here it is theoretical: the design explicitly does not plan to replace Open-Meteo (DECISIONS.md:78).
- **Compatibility with client caches.** Apollo, Relay and similar normalize the cache by `ID`. If a client uses `Place` in a cache, `ID` works out of the box.
- **No problems with big numbers in JS.** For GeoNames ids this is irrelevant, they are far from 2^53.

**What it does not give:**
- No validation. `ID` accepts any string, while the DB has `Int`. If `id` arrives as input (say, a future `place(id: ID!)`), you would have to parse it and handle `"abc"` by hand. With `Int!`, GraphQL would reject it on its own.
- No saving of the extra `String(id)` / `Number(id)` mapping at the boundary.
- The type `Int` would be more honest about this being a GeoNames number.

**What you have now:** `id` is only returned in the `searchLocations` results, and `activityScores` accepts coordinates, not a place id. So parsing on input is not needed, and the downside hardly shows.

My assessment: `ID!` is a safe default, and it is not worth changing for this. But if the client never uses the id on its own (only takes `latitude`/`longitude` for `activityScores`), there is practically no difference in behaviour, and `Int!` would also be justified. It is a matter of taste, not correctness.
