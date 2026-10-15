import { PlaceSearchKeyMapper } from '../place-search-key.mapper.js';

const searchKey = new PlaceSearchKeyMapper().toKey.bind(new PlaceSearchKeyMapper());

describe('PlaceSearchKeyMapper.toKey', () => {
  const base = { name: 'Zakopane', count: 10, language: 'en' };

  it('treats surrounding spaces and case as the same key', () => {
    expect(searchKey({ ...base, name: '  Zakopane ' })).toEqual(searchKey({ ...base, name: 'zakopane' }));
  });

  it('lower-cases and trims the name', () => {
    expect(searchKey({ ...base, name: '  ZaKoPaNe ' }).query).toBe('zakopane');
  });

  it('keeps inner spaces', () => {
    expect(searchKey({ ...base, name: 'New  York' }).query).toBe('new  york');
  });

  it('uses an empty country code when none is given', () => {
    expect(searchKey(base).countryCode).toBe('');
    expect(searchKey({ ...base, countryCode: undefined }).countryCode).toBe('');
  });

  it.each([
    ['language', { language: 'pl' }],
    ['country code', { countryCode: 'PL' }],
    ['count', { count: 5 }],
    ['name', { name: 'Krakow' }],
  ])('gives a different key for a different %s', (_label, override) => {
    expect(searchKey({ ...base, ...override })).not.toEqual(searchKey(base));
  });
});
