// Bump a version when the mapping from that API response to stored columns changes (new or renamed variable,
// unit change, different time handling or rule for hasSea), so rows written by older logic can be told apart.
export const PARSER_VERSIONS = { forecast: 1, marine: 1 } as const;
