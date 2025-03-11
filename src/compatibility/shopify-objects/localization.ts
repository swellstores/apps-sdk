import { ShopifyCompatibility } from '../shopify';

import { ShopifyResource } from './resource';

import type { SwellData } from 'types/swell';

export default function ShopifyLocalization(
  _instance: ShopifyCompatibility,
  store: SwellData,
  request: SwellData,
) {
  const { currency: storefrontCurrency, locale: storefrontLocale } =
    _instance.swell.getStorefrontLocalization();

  const requestCurrency =
    store.currencies.find(
      (currency: any) =>
        currency.code === (storefrontCurrency || request.currency),
    ) || store.currencies[0];

  const requestLocale =
    store.locales.find(
      (locale: any) => locale.code === (storefrontLocale || request.locale),
    ) || store.locales[0];

  return new ShopifyResource({
    available_countries: getAvailableCountries(store),
    available_languages: getAvailableLanguages(store),
    country:
      requestCurrency && getShopifyCountryFromCurrency(requestCurrency, store),
    language: requestLocale && getShopifyLocaleFromLocale(requestLocale, store),
    market: null, // N/A
  });
}

function getAvailableCountries(store: SwellData) {
  return (
    store.currencies.map((currency: any) =>
      getShopifyCountryFromCurrency(currency, store),
    ) || []
  );
}

function getAvailableLanguages(store: SwellData) {
  return (
    store.locales.map((locale: any) =>
      getShopifyLocaleFromLocale(locale, store),
    ) || []
  );
}

function getShopifyLocaleFromLocale(locale: any, store: SwellData) {
  return {
    // Shopify shop_locale object
    endonym_name: locale.name,
    iso_code: locale.code,
    name: locale.name,
    primary: locale.code === store.locale,
    root_url: store.url, // TODO
  };
}

function getShopifyCountryFromCurrency(currency: SwellData, store: SwellData) {
  return {
    available_languages: getAvailableLanguages(store), // All languages are available for all countries
    continent: null, // TODO
    currency: {
      // Shopify currency object
      iso_code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    },
    iso_code: currency.code,
    market: null, // N/A
    name: getCountryNameByCurrency(currency.code),
    'popular?': false, // TODO
    unit_system: 'metric', // TODO
  };
}

function getCountryNameByCurrency(
  currencyCode: keyof typeof CURRENCY_COUNTRIES,
) {
  if (currencyCode in CURRENCY_COUNTRIES) {
    return CURRENCY_COUNTRIES[currencyCode];
  }

  return null;
}

const CURRENCY_COUNTRIES = Object.freeze({
  USD: 'United States',
  EUR: 'Europe',
  GBP: 'United Kingdom',
  JPY: 'Japan',
  CAD: 'Canada',
  AUD: 'Australia',
  CHF: 'Switzerland',
  CNY: 'China',
  SEK: 'Sweden',
  NZD: 'New Zealand',
  NOK: 'Norway',
  MXN: 'Mexico',
  SGD: 'Singapore',
  HKD: 'Hong Kong',
  KRW: 'South Korea',
  INR: 'India',
  BRL: 'Brazil',
  RUB: 'Russia',
  ZAR: 'South Africa',
  TRY: 'Turkey',
  AED: 'United Arab Emirates',
  THB: 'Thailand',
  IDR: 'Indonesia',
  SAR: 'Saudi Arabia',
  PLN: 'Poland',
  PHP: 'Philippines',
  ILS: 'Israel',
  MYR: 'Malaysia',
  CZK: 'Czech Republic',
  HUF: 'Hungary',
  CLP: 'Chile',
  DKK: 'Denmark',
  RON: 'Romania',
  ARS: 'Argentina',
  COP: 'Colombia',
  TWD: 'Taiwan',
  BGN: 'Bulgaria',
  EGP: 'Egypt',
  PKR: 'Pakistan',
  NGN: 'Nigeria',
  VND: 'Vietnam',
  IQD: 'Iraq',
  MAD: 'Morocco',
  KES: 'Kenya',
  DZD: 'Algeria',
  UAH: 'Ukraine',
  XAF: 'Cameroon',
  XOF: "Côte d'Ivoire",
  GHS: 'Ghana',
  BYN: 'Belarus',
  LKR: 'Sri Lanka',
  SDG: 'Sudan',
  AFN: 'Afghanistan',
  ALL: 'Albania',
  AMD: 'Armenia',
  AOA: 'Angola',
  AWG: 'Aruba',
  AZN: 'Azerbaijan',
  BAM: 'Bosnia and Herzegovina',
  BBD: 'Barbados',
  BDT: 'Bangladesh',
  BHD: 'Bahrain',
  BIF: 'Burundi',
  BMD: 'Bermuda',
  BND: 'Brunei',
  BOB: 'Bolivia',
  BSD: 'Bahamas',
  BTN: 'Bhutan',
  BWP: 'Botswana',
  BZD: 'Belize',
  CDF: 'Democratic Republic of the Congo',
  CLF: 'Chile (Unidad de Fomento)',
  CRC: 'Costa Rica',
  CVE: 'Cape Verde',
  DJF: 'Djibouti',
  DOP: 'Dominican Republic',
  ERN: 'Eritrea',
  ETB: 'Ethiopia',
  FKP: 'Falkland Islands',
  GEL: 'Georgia',
  GIP: 'Gibraltar',
  GMD: 'Gambia',
  GNF: 'Guinea',
  GTQ: 'Guatemala',
  GYD: 'Guyana',
  HNL: 'Honduras',
  HRK: 'Croatia',
  HTG: 'Haiti',
  IRR: 'Iran',
  ISK: 'Iceland',
  JMD: 'Jamaica',
  JOD: 'Jordan',
  KGS: 'Kyrgyzstan',
  KHR: 'Cambodia',
  KMF: 'Comoros',
  KPW: 'North Korea',
  KWD: 'Kuwait',
  KYD: 'Cayman Islands',
  KZT: 'Kazakhstan',
  LAK: 'Laos',
  LBP: 'Lebanon',
  LRD: 'Liberia',
  LSL: 'Lesotho',
  LYD: 'Libya',
  MDL: 'Moldova',
  MGA: 'Madagascar',
  MKD: 'North Macedonia',
  MMK: 'Myanmar',
  MNT: 'Mongolia',
  MOP: 'Macau',
  MRO: 'Mauritania',
  MUR: 'Mauritius',
  MVR: 'Maldives',
  MWK: 'Malawi',
  NAD: 'Namibia',
  NPR: 'Nepal',
  OMR: 'Oman',
  PAB: 'Panama',
  PEN: 'Peru',
  PGK: 'Papua New Guinea',
  PYG: 'Paraguay',
  QAR: 'Qatar',
  RSD: 'Serbia',
  RWF: 'Rwanda',
  SBD: 'Solomon Islands',
  SCR: 'Seychelles',
  SHP: 'Saint Helena',
  SLL: 'Sierra Leone',
  SOS: 'Somalia',
  SRD: 'Suriname',
  STD: 'São Tomé and Príncipe',
  SZL: 'Eswatini',
  TJS: 'Tajikistan',
  TMT: 'Turkmenistan',
  TND: 'Tunisia',
  TOP: 'Tonga',
  TTD: 'Trinidad and Tobago',
  TZS: 'Tanzania',
  UGX: 'Uganda',
  UYU: 'Uruguay',
  UZS: 'Uzbekistan',
  VEF: 'Venezuela',
  VUV: 'Vanuatu',
  WST: 'Samoa',
  XCD: 'Eastern Caribbean',
  YER: 'Yemen',
  ZMW: 'Zambia',
  ZWL: 'Zimbabwe',
});
