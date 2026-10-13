export interface SearchKey {
  query: string;
  language: string;
  countryCode: string;
  count: number;
}

export function searchKey(input: {
  name: string;
  count: number;
  language: string;
  countryCode?: string | null;
}): SearchKey {
  return {
    query: input.name.trim().toLowerCase(),
    language: input.language,
    countryCode: input.countryCode ?? '',
    count: input.count,
  };
}
