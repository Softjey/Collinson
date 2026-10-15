import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsCountryCode } from '../../shared/validation/country-code.decorator.js';
import { IsLanguageCode } from '../../shared/validation/language-code.decorator.js';
import { Trim } from '../../shared/validation/trim.decorator.js';

export class SearchLocationsArgs {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  count!: number;

  @IsOptional()
  @IsCountryCode()
  countryCode?: string | null;

  @IsLanguageCode()
  language!: string;
}
