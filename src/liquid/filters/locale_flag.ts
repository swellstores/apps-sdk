import { hasFlag } from 'country-flag-icons';
import * as flags from 'country-flag-icons/string/1x1';
import { LiquidSwell } from '..';

// {{ localization.language.iso_code | locale_flag }}

type Flags = {
  [key: string]: string;
};

function getCountryCode(localCode: string) {
  if (localCode.includes('-')) {
    return localCode.split('-')[1].toUpperCase();
  } else {
    return localCode.toUpperCase();
  }
}

export default function bind(_liquidSwell: LiquidSwell) {
  return (localeCode: unknown) => {
    if (typeof localeCode !== 'string') {
      return flags.US;
    }

    const countryCode = getCountryCode(localeCode);

    return hasFlag(countryCode) ? (flags as Flags)[countryCode] : flags.US;
  };
}
