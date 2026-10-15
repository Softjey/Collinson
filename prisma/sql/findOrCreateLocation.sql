INSERT INTO "Location" ("latE2", "lonE2", "timezone", "updatedAt")
VALUES ($1, $2, $3, now())
ON CONFLICT ("latE2", "lonE2") DO UPDATE SET "timezone" = COALESCE("Location"."timezone", EXCLUDED."timezone")
RETURNING "id", "timezone"
