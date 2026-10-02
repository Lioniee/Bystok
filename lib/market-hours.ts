// US stock market hours (NYSE; NASDAQ uses the same regular session).
// Open 9:30am–4:00pm New York time, Monday–Friday.
// The "America/New_York" time zone makes daylight saving automatic.
// Not handled yet: exchange holidays and early closes.

const TIME_ZONE = "America/New_York";
const OPEN_MINUTE = 9 * 60 + 30; // 9:30am
const CLOSE_MINUTE = 16 * 60; // 4:00pm

export type MarketClock = {
  isOpen: boolean;
  nextChange: Date; // next close if open, next open if closed
  msUntilChange: number;
};

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

// Wall-clock date/time in New York for a given instant.
function nyParts(date: Date) {
  const p = Object.fromEntries(nyFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

// How far New York's clock is from UTC at a given instant, in ms (e.g. -4h in summer).
function nyOffsetMs(date: Date) {
  const p = nyParts(date);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - (date.getTime() - date.getUTCMilliseconds());
}

// The instant when New York's clock shows `minutes` past midnight on y-m-d.
// Day overflow is fine (day 32 rolls into next month).
function nyTimeToDate(year: number, month: number, day: number, minutes: number) {
  const wallAsUtc = Date.UTC(year, month - 1, day, 0, minutes);
  const guess = wallAsUtc - nyOffsetMs(new Date(wallAsUtc));
  // Re-check in case the guess landed on the other side of a DST switch.
  return new Date(wallAsUtc - nyOffsetMs(new Date(guess)));
}

// 0 = Sunday … 6 = Saturday, for a New York calendar date.
function weekdayOf(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const isWeekday = (d: number) => d >= 1 && d <= 5;

export function getMarketClock(now: Date = new Date()): MarketClock {
  const p = nyParts(now);
  const minuteOfDay = p.hour * 60 + p.minute + p.second / 60;
  const todayIsWeekday = isWeekday(weekdayOf(p.year, p.month, p.day));

  let isOpen = false;
  let nextChange: Date;

  if (todayIsWeekday && minuteOfDay >= OPEN_MINUTE && minuteOfDay < CLOSE_MINUTE) {
    isOpen = true;
    nextChange = nyTimeToDate(p.year, p.month, p.day, CLOSE_MINUTE);
  } else {
    // Next weekday open: today if it's a weekday before 9:30, otherwise a later day.
    let offset = todayIsWeekday && minuteOfDay < OPEN_MINUTE ? 0 : 1;
    while (!isWeekday(weekdayOf(p.year, p.month, p.day + offset))) offset++;
    nextChange = nyTimeToDate(p.year, p.month, p.day + offset, OPEN_MINUTE);
  }

  return { isOpen, nextChange, msUntilChange: nextChange.getTime() - now.getTime() };
}

// "2h 05m 09s", or "1d 17h 30m" when more than a day away.
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${h}h ${pad(m)}m` : `${h}h ${pad(m)}m ${pad(s)}s`;
}
