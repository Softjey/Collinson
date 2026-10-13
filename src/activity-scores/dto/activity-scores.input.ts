import { ArrayNotEmpty, IsArray, IsIn, IsNumber, IsString, Max, Min } from 'class-validator';

export const ACTIVITIES = ['SKIING', 'SURFING', 'OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING'] as const;

export class ActivityScoresInput {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  fromDate!: string;

  @IsString()
  toDate!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ACTIVITIES, { each: true })
  activities!: string[];
}
