export function unixToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

export function fromE2(value: number): number {
  return value / 100;
}
