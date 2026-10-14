export interface Place {
  id: string;
  name: string;
  country: string | null;
  countryCode: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  elevation: number | null;
  timezone: string | null;
  population: number | null;
}
