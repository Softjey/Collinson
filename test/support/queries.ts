export const SEARCH_LOCATIONS = `
  query ($name: String!, $count: Int, $countryCode: String, $language: String) {
    searchLocations(name: $name, count: $count, countryCode: $countryCode, language: $language) {
      id name country countryCode admin1 latitude longitude elevation timezone population
    }
  }`;

export const ACTIVITY_SCORES = `
  query ($input: ActivityScoresInput!) {
    activityScores(input: $input) { location { latitude } }
  }`;
