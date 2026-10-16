export const COUNTERS = {
  snapshotReused: {
    name: 'weather_snapshot_reuse_total',
    description: 'Requests served from a stored snapshot without calling Open-Meteo',
  },
  snapshotRefreshed: {
    name: 'weather_snapshot_refresh_total',
    description: 'Snapshots fetched from Open-Meteo and stored',
  },
  snapshotRefreshFailed: {
    name: 'weather_snapshot_refresh_failure_total',
    description: 'Snapshot fetches from Open-Meteo that failed',
  },
  staleResponseServed: {
    name: 'weather_stale_response_total',
    description: 'Requests answered with a stored snapshot because the refresh failed',
  },
  fetchJoined: {
    name: 'weather_fetch_joined_total',
    description: 'Requests that waited for a fetch already in flight instead of starting one',
  },
  openMeteoRequest: {
    name: 'open_meteo_request_total',
    description: 'HTTP attempts to Open-Meteo by outcome',
  },
  placeSearch: {
    name: 'place_search_total',
    description: 'Place searches by how they were answered',
  },
  activityResult: {
    name: 'activity_result_total',
    description: 'Activity results returned by activityScores by kind',
  },
  unscoredDay: {
    name: 'activity_unscored_day_total',
    description: 'Days returned as unscored by activity and reason',
  },
} as const;

export const HISTOGRAMS = {
  openMeteoRequestDurationMs: {
    name: 'open_meteo_request_duration',
    description: 'Duration of one HTTP attempt to Open-Meteo',
    unit: 'ms',
  },
} as const;

export type CounterName = keyof typeof COUNTERS;
export type HistogramName = keyof typeof HISTOGRAMS;
export type MetricLabels = Record<string, string>;

export abstract class Metrics {
  abstract increment(counter: CounterName, labels?: MetricLabels): void;
  abstract observe(histogram: HistogramName, value: number, labels?: MetricLabels): void;
}
