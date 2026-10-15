import { unixToDate } from '../unix-time.js';

describe('unixToDate', () => {
  it('reads unix seconds as a UTC instant', () => {
    expect(unixToDate(1_760_306_400)).toEqual(new Date('2025-10-12T22:00:00Z'));
  });

  it('maps zero to the epoch', () => {
    expect(unixToDate(0)).toEqual(new Date(0));
  });
});
