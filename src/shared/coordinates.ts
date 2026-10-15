export function toE2(degrees: number): number {
  return Math.round(degrees * 100);
}

export function fromE2(valueE2: number): number {
  return valueE2 / 100;
}
