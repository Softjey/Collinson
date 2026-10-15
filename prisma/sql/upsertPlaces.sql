INSERT INTO "Place" ("id", "name", "country", "countryCode", "admin1", "latitude", "longitude", "elevation", "timezone", "population", "updatedAt")
SELECT "id", "name", "country", "countryCode", "admin1", "latitude", "longitude", "elevation", "timezone", "population", now()
FROM jsonb_to_recordset($1::jsonb -> 'rows') AS "rows"(
  "id" integer,
  "name" text,
  "country" text,
  "countryCode" char(2),
  "admin1" text,
  "latitude" double precision,
  "longitude" double precision,
  "elevation" real,
  "timezone" text,
  "population" integer
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "country" = EXCLUDED."country",
  "countryCode" = EXCLUDED."countryCode",
  "admin1" = EXCLUDED."admin1",
  "latitude" = EXCLUDED."latitude",
  "longitude" = EXCLUDED."longitude",
  "elevation" = EXCLUDED."elevation",
  "timezone" = EXCLUDED."timezone",
  "population" = EXCLUDED."population",
  "updatedAt" = now()
RETURNING "id"
