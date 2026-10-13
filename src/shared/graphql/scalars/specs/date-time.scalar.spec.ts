import { Kind } from 'graphql';
import { DateTimeScalar } from './date-time.scalar.js';

describe('DateTime scalar', () => {
  const scalar = new DateTimeScalar();

  describe('serialize', () => {
    it('writes a Date as UTC ISO 8601', () => {
      expect(scalar.serialize(new Date('2026-10-13T08:30:00.000Z'))).toBe('2026-10-13T08:30:00.000Z');
    });

    it('rejects an invalid Date', () => {
      expect(() => scalar.serialize(new Date('nope'))).toThrow();
    });

    it('rejects a non-Date', () => {
      expect(() => scalar.serialize('2026-10-13T08:30:00.000Z')).toThrow();
    });
  });

  describe('parseValue', () => {
    it('reads a UTC ISO 8601 string', () => {
      expect(scalar.parseValue('2026-10-13T08:30:00Z')).toEqual(new Date('2026-10-13T08:30:00Z'));
    });

    it.each([
      ['a date without time', '2026-10-13'],
      ['a time without zone', '2026-10-13T08:30:00'],
      ['garbage', 'yesterday'],
      ['an impossible day', '2026-02-30T00:00:00Z'],
      ['a number', 1760344200],
    ])('rejects %s', (_label, value) => {
      expect(() => scalar.parseValue(value)).toThrow();
    });
  });

  describe('parseLiteral', () => {
    it('reads a string literal', () => {
      expect(scalar.parseLiteral({ kind: Kind.STRING, value: '2026-10-13T08:30:00Z' })).toEqual(
        new Date('2026-10-13T08:30:00Z'),
      );
    });

    it('rejects a non-string literal', () => {
      expect(() => scalar.parseLiteral({ kind: Kind.INT, value: '1' })).toThrow();
    });
  });
});
