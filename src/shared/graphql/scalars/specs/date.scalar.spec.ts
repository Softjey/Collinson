import { Kind } from 'graphql';
import { DateScalar } from '../date.scalar.js';

describe('Date scalar', () => {
  const scalar = new DateScalar();

  describe('parseValue', () => {
    it.each(['2026-10-13', '2028-02-29', '2026-12-31'])('accepts %s', (value) => {
      expect(scalar.parseValue(value)).toBe(value);
    });

    it.each([
      ['an impossible day', '2026-02-30'],
      ['a non-leap February 29', '2027-02-29'],
      ['month 13', '2026-13-01'],
      ['single digit month and day', '2026-2-3'],
      ['a datetime', '2026-10-13T00:00:00Z'],
      ['surrounding spaces', ' 2026-10-13'],
      ['an empty string', ''],
      ['a number', 20261013],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      expect(() => scalar.parseValue(value)).toThrow();
    });
  });

  describe('parseLiteral', () => {
    it('accepts a valid string literal', () => {
      expect(scalar.parseLiteral({ kind: Kind.STRING, value: '2026-10-13' })).toBe('2026-10-13');
    });

    it('rejects an impossible date literal', () => {
      expect(() => scalar.parseLiteral({ kind: Kind.STRING, value: '2026-02-30' })).toThrow();
    });

    it('rejects a non-string literal', () => {
      expect(() => scalar.parseLiteral({ kind: Kind.INT, value: '20261013' })).toThrow();
    });
  });

  describe('serialize', () => {
    it('returns a valid date string unchanged', () => {
      expect(scalar.serialize('2026-10-13')).toBe('2026-10-13');
    });

    it('rejects an invalid date string', () => {
      expect(() => scalar.serialize('2026-02-30')).toThrow();
    });

    it('rejects a non-string', () => {
      expect(() => scalar.serialize(new Date())).toThrow();
    });
  });
});
