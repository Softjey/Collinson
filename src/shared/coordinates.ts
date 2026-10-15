export function toE2(degrees: number): number {
  return Math.round(degrees * 100) + 0;
}

export function fromE2(valueE2: number): number {
  return valueE2 / 100;
}

export function roundCoordinate(degrees: number): number {
  return fromE2(toE2(degrees));
}
