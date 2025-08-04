import { StorefrontResource, cloneStorefrontResource } from '@/resources';
import { getCurrencyByCountry } from '@/utils';

import { ShopifyResource, defer, deferWith } from './resource';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';
import type { ShopifyAddress, ShopifyCountry } from 'types/shopify';

export default function ShopifyAddress(
  instance: ShopifyCompatibility,
  address: StorefrontResource | SwellRecord,
  account?: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyAddress> {
  if (address instanceof ShopifyResource) {
    return address.clone() as ShopifyResource<ShopifyAddress>;
  }

  if (address instanceof StorefrontResource) {
    address = cloneStorefrontResource(address);
  }

  // address can be null
  if (!address) {
    address = {} as SwellRecord;
  }

  return new ShopifyResource<ShopifyAddress>({
    address1: defer(() => address.address1),
    address2: defer(() => address.address2),
    city: defer(() => address.city),
    company: defer(() => address.company),
    country: deferWith(address, (address) =>
      ShopifyCountry(instance, address.country),
    ),
    country_code: defer(() => address.country_code),
    first_name: deferWith(
      address,
      (address) => address.first_name || account?.first_name,
    ),
    id: defer(() => address.id),
    last_name: deferWith(
      address,
      (address) => address.last_name || account?.last_name,
    ),
    name: deferWith(address, (address) => address.name || account?.name),
    phone: defer(() => address.phone),
    province: defer(() => address.state),
    province_code: deferWith(address, (address) =>
      String(address.state || '').substring(0, 2),
    ),
    street: deferWith(address, (address) =>
      joinAddressLines(address.address1, address.address2),
    ),
    summary: deferWith(address, (address) =>
      joinAddressLines(
        address.name || account?.name,
        address.company,
        address.address1,
        address.address2,
        address.city,
        address.state,
        address.country,
      ),
    ),
    url: deferWith(address, (address) => `/account/addresses/${address.id}`),
    zip: defer(() => address.zip),
  });
}

function joinAddressLines(...props: string[]): string {
  return props.filter(Boolean).join('\n');
}

export function ShopifyCountry(
  _instance: ShopifyCompatibility,
  countryCode: string,
): ShopifyResource<ShopifyCountry> {
  const currencyCode = getCurrencyByCountry(countryCode) || 'USD';

  return new ShopifyResource<ShopifyCountry>(
    {
      available_languages: [], // TODO
      continent: '' as 'North America', // TODO
      currency: {
        iso_code: currencyCode,
        name: currencyCode,
        symbol: currencyCode,
      }, // TODO
      iso_code: countryCode,
      market: {
        handle: 'unknown',
        id: 0,
        metafields: {},
      }, // TODO
      name: countryCode, // TODO
      'popular?': true, // TODO
      unit_system: 'metric', // TODO
    },
    'iso_code',
  );
}
