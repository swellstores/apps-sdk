import { LiquidSwell } from '..';
import { ensureDate } from './date';

export default function bind(_liquidSwell: LiquidSwell) {
  return (
    dateValue: string,
    interval: string | number,
    intervalCount: string | number,
  ): string => {
    const date = ensureDate(dateValue);
    const result = getNextIntervalDate(date, interval, Number(intervalCount));

    return result ? new Date(result).toISOString() : new Date().toISOString();
  };
}

export function getNextIntervalDate(
  date: Date,
  interval: string | number,
  intervalCount: number,
): number | undefined {
  if (!interval || !date) {
    return;
  }

  // Interval represents number of days (daily = 1, weekly = 7, monthly = 30)
  // Special case for Monthly which should always land on the same day of the month
  if (interval === 'monthly' || interval === 30) {
    return dateNextMonth(date, intervalCount);
  }

  let intervalDays = 0;

  if (typeof interval === 'string') {
    if (interval === 'daily') {
      intervalDays = 1;
    } else if (interval === 'weekly') {
      intervalDays = 7;
    } else if (interval === 'yearly') {
      intervalDays = 365;
    }
  }

  if (intervalDays <= 0) {
    return;
  }

  return time(date) + intervalDays * intervalCount * 86400 * 1000;
}

function dateNextMonth(startDate: Date, intervalCount: number) {
  const date = new Date(startDate);
  const nextDate = new Date(date);

  nextDate.setUTCMonth(date.getMonth() + (intervalCount || 1));
  // Correct for shorter month days and auto rollover
  if (nextDate.getDate() !== date.getDate()) {
    nextDate.setDate(nextDate.getDate() - nextDate.getDate());
  }

  return nextDate.getTime();
}

function time(date: Date) {
  if (date === undefined) {
    return Date.now();
  }

  if (typeof date === 'number' || typeof date === 'string') {
    return new Date(date).getTime();
  }

  if (date instanceof Date) {
    return date.getTime();
  }

  return Date.now();
}
