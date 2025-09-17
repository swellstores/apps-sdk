import strftime from 'strftime';
import { LiquidSwell } from '..';
import { paramsToProps } from '../utils';

// {{ '2024-10-01T12:00:00.000Z' | date: '%B %d, %Y' }} => October 01, 2024
// {{ '2024-10-01T12:00:00.000Z' | date: format: '%B %d, %Y' }} => October 01, 2024
// {{ '2024-10-01T12:00:00.000Z' | date: 'date_at_time' }} => Oct 01, 2024
// {{ '2024-10-01T12:00:00.000Z' | date: format: 'date_at_time' }} => Oct 01, 2024

export default function bind(_liquidSwell: LiquidSwell) {
  return (dateValue: string, ...params: any[]): string => {
    const date = ensureDate(dateValue);
    const { format } = getDateFilterParams(params);

    return applyDateFormat(format as string, date);
  };
}

export function ensureDate(dateValue: string | Date) {
  if (dateValue === 'now' || dateValue === 'today') {
    return new Date();
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  }

  return new Date();
}

export function getDateFilterParams(params: any[]) {
  // params = ['%B %d, %Y']
  if (typeof params[0] === 'string') {
    return { format: params[0] };
  }

  // params = [['format', '%B %d, %Y']]
  return paramsToProps(params);
}

export function applyDateFormat(type: string, date: Date): string {
  if (isCustomDateFormat(type)) {
    return applyStrftimeFormat(type, date);
  }

  switch (type) {
    case 'abbreviated_date':
      // Apr 3, 2024
      return strftime('%b %d, %Y', date);
    case 'basic':
      // 04/03/2024
      return strftime('%m/%d/%Y', date);
    case 'date':
      // April 3, 2024
      return strftime('%B %d, %Y', date);
    case 'date_at_time':
      // April 3, 2024 at 12:00 pm
      return `${strftime('%B %d, %Y', date)} at ${strftime('%I:%M %P', date)}`;
    case 'default':
      // Wednesday, April 3, 2024 at 1:40 pm -0400
      return strftime('%A, %B %d, %Y at %I:%M %P %z', date);
    case 'on_date':
      // on Apr 3, 2024
      return `on ${strftime('%b %d, %Y', date)}`;
    case 'short': // deprecated by shopify
      // 3 Apr 13:40
      return strftime('%-d %b %H:%M', date);
    case 'long': // deprecated by shopify
      // April 3, 2024 13:40
      return strftime('%B %d, %Y %H:%M', date);
    default:
      // TODO: support custom date formats from theme locale settings
      return date.toLocaleString();
  }
}

export function isCustomDateFormat(format: string): boolean {
  return Boolean(format) && format.includes('%');
}

export function applyStrftimeFormat(format: string, date: Date) {
  return strftime(format, date);
}
