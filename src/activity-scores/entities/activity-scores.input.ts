import { ArrayNotEmpty, IsArray, IsIn, IsNumber, IsString, Max, Min } from 'class-validator';
import { ACTIVITIES, type Activity } from '../../scoring/entities/activity.js';
import { RoundCoordinate } from '../../shared/validation/round-coordinate.decorator.js';
import { Deduplicate } from '../../shared/validation/deduplicate.decorator.js';

export class ActivityScoresInput {
  @RoundCoordinate()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @RoundCoordinate()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  fromDate!: string;

  @IsString()
  toDate!: string;

  @Deduplicate()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ACTIVITIES, { each: true })
  activities!: Activity[];
}
