import { hasFlag } from 'country-flag-icons';
import * as flags from 'country-flag-icons/string/1x1';
import { getCountryCodeFromLocale } from '@/utils';
import { LiquidSwell } from '..';

// {{ localization.language.iso_code | locale_flag }}

type Flags = {
  [key: string]: string;
};

export default function bind(_liquidSwell: LiquidSwell) {
  return (localeCode: unknown) => {
    if (typeof localeCode !== 'string') {
      return flags.US;
    }

    const countryCode = getCountryCodeFromLocale(localeCode).toUpperCase();

    return hasFlag(countryCode) ? (flags as Flags)[countryCode] : flags.US;
  };
}
