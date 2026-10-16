import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { Clock } from '../shared/clock.js';
import { addDays, localDateOf } from '../shared/local-date.js';
import type { ActivityScoresInput } from './entities/activity-scores.input.js';
import { TimeZoneService } from './time-zone.service.js';

export const MAX_DAYS_AHEAD = 7;

/** Checks the requested dates against "today" in the time zone of the location, before the resolver runs. */
@Injectable()
export class DateRangeValidator implements PipeTransform<ActivityScoresInput, ActivityScoresInput> {
  constructor(
    private readonly clock: Clock,
    private readonly timeZoneService: TimeZoneService,
  ) {}

  transform(input: ActivityScoresInput): ActivityScoresInput {
    const timeZone = this.timeZoneService.timeZoneOf(input.latitude, input.longitude);
    const today = localDateOf(this.clock.now(), timeZone);
    const lastAllowedDate = addDays(today, MAX_DAYS_AHEAD);

    if (input.fromDate > input.toDate) {
      throw new BadRequestException('fromDate must not be after toDate');
    }
    if (input.fromDate < today) {
      throw new BadRequestException(`fromDate must not be before today (${today}) in ${timeZone}`);
    }
    if (input.toDate > lastAllowedDate) {
      throw new BadRequestException(
        `toDate must not be more than ${MAX_DAYS_AHEAD} days after today (${today}) in ${timeZone}`,
      );
    }
    return input;
  }
}
