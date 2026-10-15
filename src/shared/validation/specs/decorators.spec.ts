import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, validateSync } from 'class-validator';
import { IsCountryCode } from '../country-code.decorator.js';
import { IsLanguageCode } from '../language-code.decorator.js';
import { Trim } from '../trim.decorator.js';

class Sample {
  @Trim()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsCountryCode()
  country?: string | null;

  @IsLanguageCode()
  language!: string;
}

const build = (plain: object) => plainToInstance(Sample, { name: 'x', language: 'en', ...plain });
const errorsOf = (plain: object) => validateSync(build(plain)).map((error) => error.property);

describe('Trim', () => {
  it('trims strings', () => expect(build({ name: '  Rome ' }).name).toBe('Rome'));
  it('leaves non-strings for the validators', () => expect(build({ name: 5 }).name).toBe(5));
  it('lets a blank string fail IsNotEmpty after trimming', () =>
    expect(errorsOf({ name: '   ' })).toEqual(['name']));
});

describe('IsCountryCode', () => {
  it('upper-cases the value', () => expect(build({ country: 'pl' }).country).toBe('PL'));
  it('accepts two letters', () => expect(errorsOf({ country: 'pl' })).toEqual([]));
  it.each(['POL', 'p', '1a', ''])('rejects %p', (country) =>
    expect(errorsOf({ country })).toEqual(['country']),
  );
  it('allows the field to be omitted or null', () => {
    expect(errorsOf({})).toEqual([]);
    expect(errorsOf({ country: null })).toEqual([]);
  });
});

describe('IsLanguageCode', () => {
  it('accepts two letters', () => expect(errorsOf({ language: 'uk' })).toEqual([]));
  it.each(['eng', 'e', '12', 5])('rejects %p', (language) =>
    expect(errorsOf({ language })).toEqual(['language']),
  );
});
