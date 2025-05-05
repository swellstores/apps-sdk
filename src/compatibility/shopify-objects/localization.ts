import { isObject } from '@/utils';

import type { SwellData } from 'types/swell';
import type { ShopifyCompatibility } from '../shopify';
import type {
  ShopifyCountry,
  ShopifyLocale,
  ShopifyLocalization,
} from 'types/shopify';

export default function ShopifyLocalization(
  instance: ShopifyCompatibility,
  store: SwellData,
  request: SwellData,
): ShopifyLocalization {
  const { currency: storefrontCurrency, locale: storefrontLocale } =
    instance.swell.getStorefrontLocalization();

  const requestCurrency =
    store.currencies.find(
      (currency: any) =>
        currency.code === (storefrontCurrency || request.currency),
    ) || store.currencies[0];

  const requestLocale =
    store.locales.find(
      (locale: any) => locale.code === (storefrontLocale || request.locale),
    ) || store.locales[0];

  return {
    available_countries: getAvailableCountries(store),
    available_languages: getAvailableLanguages(store),
    country:
      requestCurrency && getShopifyCountryFromCurrency(requestCurrency, store),
    language: requestLocale && getShopifyLocaleFromLocale(requestLocale, store),
    market: {
      handle: 'unknown',
      id: 0,
      metafields: {},
    },
  };
}

function getAvailableCountries(store: SwellData): ShopifyCountry[] {
  return (
    store.currencies.map((currency: any) =>
      getShopifyCountryFromCurrency(currency, store),
    ) || []
  );
}

function getAvailableLanguages(store: SwellData): ShopifyLocale[] {
  return (
    store.locales.map((locale: any) =>
      getShopifyLocaleFromLocale(locale, store),
    ) || []
  );
}

function getShopifyLocaleFromLocale(
  locale: any,
  store: SwellData,
): ShopifyLocale {
  return {
    // Shopify shop_locale object
    endonym_name: locale.name,
    iso_code: locale.code,
    name: locale.name,
    primary: locale.code === store.locale,
    root_url: store.url, // TODO
  };
}

function getShopifyCountryFromCurrency(
  currency: SwellData,
  store: SwellData,
): ShopifyCountry {
  return {
    available_languages: getAvailableLanguages(store), // All languages are available for all countries
    continent: 'North America', // TODO
    currency: {
      // Shopify currency object
      iso_code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    },
    iso_code: getCountryByCurrency(currency.code)?.iso as string,
    market: {
      // N/A
      handle: 'unknown',
      id: 0,
      metafields: {},
    },
    name: getCountryByCurrency(currency.code)?.name as string,
    'popular?': false, // TODO
    unit_system: 'metric', // TODO
  };
}

function getCountryByCurrency(currencyCode: keyof typeof CURRENCY_COUNTRIES) {
  if (currencyCode in CURRENCY_COUNTRIES) {
    return CURRENCY_COUNTRIES[currencyCode];
  }

  return null;
}

export function isLikeShopifyCountry(value: unknown): value is ShopifyCountry {
  return (
    isObject(value) &&
    Object.hasOwn(value, 'iso_code') &&
    Object.hasOwn(value, 'name') &&
    Object.hasOwn(value, 'continent') &&
    Object.hasOwn(value, 'unit_system')
  );
}

const CURRENCY_COUNTRIES = Object.freeze({
  USD: { name: 'United States', iso: 'US' },
  EUR: { name: 'Europe', iso: 'EU' },
  GBP: { name: 'United Kingdom', iso: 'UK' },
  JPY: { name: 'Japan', iso: 'JP' },
  CAD: { name: 'Canada', iso: 'CA' },
  AUD: { name: 'Australia', iso: 'AU' },
  CHF: { name: 'Switzerland', iso: 'CH' },
  CNY: { name: 'China', iso: 'CN' },
  SEK: { name: 'Sweden', iso: 'SE' },
  NZD: { name: 'New Zealand', iso: 'NZ' },
  NOK: { name: 'Norway', iso: 'NO' },
  MXN: { name: 'Mexico', iso: 'MX' },
  SGD: { name: 'Singapore', iso: 'SG' },
  HKD: { name: 'Hong Kong', iso: 'HK' },
  KRW: { name: 'South Korea', iso: 'KR' },
  INR: { name: 'India', iso: 'IN' },
  BRL: { name: 'Brazil', iso: 'BR' },
  RUB: { name: 'Russia', iso: 'RU' },
  ZAR: { name: 'South Africa', iso: 'ZA' },
  TRY: { name: 'Turkey', iso: 'TR' },
  AED: { name: 'United Arab Emirates', iso: 'AE' },
  THB: { name: 'Thailand', iso: 'TH' },
  IDR: { name: 'Indonesia', iso: 'ID' },
  SAR: { name: 'Saudi Arabia', iso: 'SA' },
  PLN: { name: 'Poland', iso: 'PL' },
  PHP: { name: 'Philippines', iso: 'PH' },
  ILS: { name: 'Israel', iso: 'IL' },
  MYR: { name: 'Malaysia', iso: 'MY' },
  CZK: { name: 'Czech Republic', iso: 'CZ' },
  HUF: { name: 'Hungary', iso: 'HU' },
  CLP: { name: 'Chile', iso: 'CL' },
  DKK: { name: 'Denmark', iso: 'DK' },
  RON: { name: 'Romania', iso: 'RO' },
  ARS: { name: 'Argentina', iso: 'AR' },
  COP: { name: 'Colombia', iso: 'CO' },
  TWD: { name: 'Taiwan', iso: 'TW' },
  BGN: { name: 'Bulgaria', iso: 'BG' },
  EGP: { name: 'Egypt', iso: 'EG' },
  PKR: { name: 'Pakistan', iso: 'PK' },
  NGN: { name: 'Nigeria', iso: 'NG' },
  VND: { name: 'Vietnam', iso: 'VN' },
  IQD: { name: 'Iraq', iso: 'IQ' },
  MAD: { name: 'Morocco', iso: 'MA' },
  KES: { name: 'Kenya', iso: 'KE' },
  DZD: { name: 'Algeria', iso: 'DZ' },
  UAH: { name: 'Ukraine', iso: 'UA' },
  XAF: { name: 'Cameroon', iso: 'CM' },
  XOF: { name: "Côte d'Ivoire", iso: 'CI' },
  GHS: { name: 'Ghana', iso: 'GH' },
  BYN: { name: 'Belarus', iso: 'BY' },
  LKR: { name: 'Sri Lanka', iso: 'LK' },
  SDG: { name: 'Sudan', iso: 'SD' },
  AFN: { name: 'Afghanistan', iso: 'AF' },
  ALL: { name: 'Albania', iso: 'AL' },
  AMD: { name: 'Armenia', iso: 'AM' },
  AOA: { name: 'Angola', iso: 'AO' },
  AWG: { name: 'Aruba', iso: 'AW' },
  AZN: { name: 'Azerbaijan', iso: 'AZ' },
  BAM: { name: 'Bosnia and Herzegovina', iso: 'BA' },
  BBD: { name: 'Barbados', iso: 'BB' },
  BDT: { name: 'Bangladesh', iso: 'BD' },
  BHD: { name: 'Bahrain', iso: 'BH' },
  BIF: { name: 'Burundi', iso: 'BI' },
  BMD: { name: 'Bermuda', iso: 'BM' },
  BND: { name: 'Brunei', iso: 'BN' },
  BOB: { name: 'Bolivia', iso: 'BO' },
  BSD: { name: 'Bahamas', iso: 'BS' },
  BTN: { name: 'Bhutan', iso: 'BT' },
  BWP: { name: 'Botswana', iso: 'BW' },
  BZD: { name: 'Belize', iso: 'BZ' },
  CDF: { name: 'Democratic Republic of the Congo', iso: 'CD' },
  CLF: { name: 'Chile (Unidad de Fomento)', iso: 'CL' },
  CRC: { name: 'Costa Rica', iso: 'CR' },
  CVE: { name: 'Cape Verde', iso: 'CV' },
  DJF: { name: 'Djibouti', iso: 'DJ' },
  DOP: { name: 'Dominican Republic', iso: 'DO' },
  ERN: { name: 'Eritrea', iso: 'ER' },
  ETB: { name: 'Ethiopia', iso: 'ET' },
  FKP: { name: 'Falkland Islands', iso: 'FK' },
  GEL: { name: 'Georgia', iso: 'GE' },
  GIP: { name: 'Gibraltar', iso: 'GI' },
  GMD: { name: 'Gambia', iso: 'GM' },
  GNF: { name: 'Guinea', iso: 'GN' },
  GTQ: { name: 'Guatemala', iso: 'GT' },
  GYD: { name: 'Guyana', iso: 'GY' },
  HNL: { name: 'Honduras', iso: 'HN' },
  HRK: { name: 'Croatia', iso: 'HR' },
  HTG: { name: 'Haiti', iso: 'HT' },
  IRR: { name: 'Iran', iso: 'IR' },
  ISK: { name: 'Iceland', iso: 'IS' },
  JMD: { name: 'Jamaica', iso: 'JM' },
  JOD: { name: 'Jordan', iso: 'JO' },
  KGS: { name: 'Kyrgyzstan', iso: 'KG' },
  KHR: { name: 'Cambodia', iso: 'KH' },
  KMF: { name: 'Comoros', iso: 'KM' },
  KPW: { name: 'North Korea', iso: 'KP' },
  KWD: { name: 'Kuwait', iso: 'KW' },
  KYD: { name: 'Cayman Islands', iso: 'KY' },
  KZT: { name: 'Kazakhstan', iso: 'KZ' },
  LAK: { name: 'Laos', iso: 'LA' },
  LBP: { name: 'Lebanon', iso: 'LB' },
  LRD: { name: 'Liberia', iso: 'LR' },
  LSL: { name: 'Lesotho', iso: 'LS' },
  LYD: { name: 'Libya', iso: 'LY' },
  MDL: { name: 'Moldova', iso: 'MD' },
  MGA: { name: 'Madagascar', iso: 'MG' },
  MKD: { name: 'North Macedonia', iso: 'MK' },
  MMK: { name: 'Myanmar', iso: 'MM' },
  MNT: { name: 'Mongolia', iso: 'MN' },
  MOP: { name: 'Macau', iso: 'MO' },
  MRO: { name: 'Mauritania', iso: 'MR' },
  MUR: { name: 'Mauritius', iso: 'MU' },
  MVR: { name: 'Maldives', iso: 'MV' },
  MWK: { name: 'Malawi', iso: 'MW' },
  NAD: { name: 'Namibia', iso: 'NA' },
  NPR: { name: 'Nepal', iso: 'NP' },
  OMR: { name: 'Oman', iso: 'OM' },
  PAB: { name: 'Panama', iso: 'PA' },
  PEN: { name: 'Peru', iso: 'PE' },
  PGK: { name: 'Papua New Guinea', iso: 'PG' },
  PYG: { name: 'Paraguay', iso: 'PY' },
  QAR: { name: 'Qatar', iso: 'QA' },
  RSD: { name: 'Serbia', iso: 'RS' },
  RWF: { name: 'Rwanda', iso: 'RW' },
  SBD: { name: 'Solomon Islands', iso: 'SB' },
  SCR: { name: 'Seychelles', iso: 'SC' },
  SHP: { name: 'Saint Helena', iso: 'SH-HL' },
  SLL: { name: 'Sierra Leone', iso: 'SL' },
  SOS: { name: 'Somalia', iso: 'SO' },
  SRD: { name: 'Suriname', iso: 'SR' },
  STD: { name: 'São Tomé and Príncipe', iso: 'ST' },
  SZL: { name: 'Eswatini', iso: 'SZ' },
  TJS: { name: 'Tajikistan', iso: 'TJ' },
  TMT: { name: 'Turkmenistan', iso: 'TM' },
  TND: { name: 'Tunisia', iso: 'TN' },
  TOP: { name: 'Tonga', iso: 'TO' },
  TTD: { name: 'Trinidad and Tobago', iso: 'TT' },
  TZS: { name: 'Tanzania', iso: 'TZ' },
  UGX: { name: 'Uganda', iso: 'UG' },
  UYU: { name: 'Uruguay', iso: 'UY' },
  UZS: { name: 'Uzbekistan', iso: 'UZ' },
  VEF: { name: 'Venezuela', iso: 'VE' },
  VUV: { name: 'Vanuatu', iso: 'VU' },
  WST: { name: 'Samoa', iso: 'WS' },
  XCD: { name: 'Eastern Caribbean', iso: 'AG' },
  YER: { name: 'Yemen', iso: 'YE' },
  ZMW: { name: 'Zambia', iso: 'ZM' },
  ZWG: { name: 'Zimbabwe', iso: 'ZW' },
});
