const DAY_MS = 86_400_000;

/** A calendar date without a time, `YYYY-MM-DD`. */
export type LocalDate = string;

export function localDateOf(instant: Date, timeZone: string): LocalDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function datesBetween(firstDate: LocalDate, lastDate: LocalDate): LocalDate[] {
  const dates: LocalDate[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}
