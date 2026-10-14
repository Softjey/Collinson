import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const TWO_LETTERS = /^[A-Za-z]{2}$/;

export class SearchLocationsArgs {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  count!: number;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsOptional()
  @Matches(TWO_LETTERS)
  countryCode?: string | null;

  @IsString()
  @Matches(TWO_LETTERS)
  language!: string;
}
