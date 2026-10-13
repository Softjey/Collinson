-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "latE2" INTEGER NOT NULL,
    "lonE2" INTEGER NOT NULL,
    "elevationM" REAL,
    "timezone" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastSnapshot" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" INTEGER NOT NULL,
    "apiLatitude" REAL NOT NULL,
    "apiLongitude" REAL NOT NULL,
    "elevationM" REAL,
    "utcOffsetSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastHour" (
    "snapshotId" INTEGER NOT NULL,
    "timeUtc" TIMESTAMPTZ(3) NOT NULL,
    "temperature2m" REAL,
    "relativeHumidity2m" REAL,
    "precipitation" REAL,
    "rain" REAL,
    "snowfall" REAL,
    "snowDepth" REAL,
    "cloudCover" REAL,
    "windSpeed10m" REAL,
    "windGusts10m" REAL,
    "weatherCode" SMALLINT,

    CONSTRAINT "ForecastHour_pkey" PRIMARY KEY ("snapshotId","timeUtc")
);

-- CreateTable
CREATE TABLE "MarineSnapshot" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" INTEGER NOT NULL,
    "hasSea" BOOLEAN NOT NULL,
    "apiLatitude" REAL,
    "apiLongitude" REAL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarineHour" (
    "snapshotId" INTEGER NOT NULL,
    "timeUtc" TIMESTAMPTZ(3) NOT NULL,
    "waveHeight" REAL,
    "wavePeriod" REAL,
    "waveDirection" SMALLINT,
    "swellWaveHeight" REAL,
    "swellWavePeriod" REAL,

    CONSTRAINT "MarineHour_pkey" PRIMARY KEY ("snapshotId","timeUtc")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" CHAR(2),
    "admin1" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "elevationM" REAL,
    "timezone" TEXT,
    "population" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceSearch" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '',
    "resultCount" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceSearchHit" (
    "searchId" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,
    "placeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceSearchHit_pkey" PRIMARY KEY ("searchId","position")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_latE2_lonE2_key" ON "Location"("latE2", "lonE2");

-- CreateIndex
CREATE INDEX "ForecastSnapshot_locationId_fetchedAt_id_idx" ON "ForecastSnapshot"("locationId", "fetchedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "MarineSnapshot_locationId_fetchedAt_id_idx" ON "MarineSnapshot"("locationId", "fetchedAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceSearch_query_language_countryCode_resultCount_key" ON "PlaceSearch"("query", "language", "countryCode", "resultCount");

-- AddForeignKey
ALTER TABLE "ForecastSnapshot" ADD CONSTRAINT "ForecastSnapshot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastHour" ADD CONSTRAINT "ForecastHour_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ForecastSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarineSnapshot" ADD CONSTRAINT "MarineSnapshot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarineHour" ADD CONSTRAINT "MarineHour_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MarineSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceSearchHit" ADD CONSTRAINT "PlaceSearchHit_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PlaceSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceSearchHit" ADD CONSTRAINT "PlaceSearchHit_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

