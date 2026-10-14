import type { Activity } from './activity.js';
import { ACTIVITY_DEFINITIONS } from './activity-definitions.js';
import type { ActivityDefinition, DataSource } from './definition.types.js';

export function findDefinition(
  activity: Activity,
  definitions: readonly ActivityDefinition[] = ACTIVITY_DEFINITIONS,
): ActivityDefinition {
  const matches = definitions.filter((definition) => definition.name === activity);
  if (matches.length === 0) throw new Error(`No definition for ${activity}`);
  if (matches.length > 1) throw new Error(`Duplicate definition for ${activity}`);
  return matches[0];
}

const sourcesOf = (definition: ActivityDefinition): readonly DataSource[] =>
  'basedOn' in definition ? sourcesOf(definition.basedOn) : definition.sources;

export function requiredSources(
  activities: readonly Activity[],
  definitions: readonly ActivityDefinition[] = ACTIVITY_DEFINITIONS,
): DataSource[] {
  const sources = new Set<DataSource>();
  for (const activity of activities) {
    for (const source of sourcesOf(findDefinition(activity, definitions))) sources.add(source);
  }
  return [...sources];
}
