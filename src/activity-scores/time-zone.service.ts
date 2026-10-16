import { Injectable } from '@nestjs/common';
import tzLookup from '@photostructure/tz-lookup';

@Injectable()
export class TimeZoneService {
  timeZoneOf(latitude: number, longitude: number): string {
    return tzLookup(latitude, longitude);
  }
}
