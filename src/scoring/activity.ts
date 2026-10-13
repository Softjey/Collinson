export const ACTIVITIES = ['SKIING', 'SURFING', 'OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING'] as const;

export type Activity = (typeof ACTIVITIES)[number];
