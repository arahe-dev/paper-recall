const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function getLocalDateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
}

export function isLocalDateKey(value: string): boolean {
  return DATE_KEY_PATTERN.test(value);
}

export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

export function parseLocalDateKey(dateKey: string): Date {
  if (!isLocalDateKey(dateKey)) {
    throw new Error(`Invalid local date key: ${dateKey}`);
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDisplayDateFromKey(dateKey: string): string {
  return formatDisplayDate(parseLocalDateKey(dateKey));
}

export function formatClockTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
