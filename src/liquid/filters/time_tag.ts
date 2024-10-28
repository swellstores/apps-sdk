import { LiquidSwell } from '..';
import { default as bindDate, ensureDate } from './date';
import { paramsToProps } from '../utils';

// {{ blog.date_published | time_tag: format: 'date_at_time' }}

export default function bind(_liquidSwell: LiquidSwell) {
  const dateFilter = bindDate(_liquidSwell);
  return (dateValue: string, ...params: any[]) => {
    const date = ensureDate(dateValue);
    const formattedDate = dateFilter(dateValue, ...params);
    const formattedDatetime = date.toISOString();

    return `<time datetime="${formattedDatetime}">${formattedDate}</time>`;
  };
}
