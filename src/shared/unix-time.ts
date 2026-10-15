export function unixToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}
