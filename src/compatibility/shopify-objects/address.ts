import { ShopifyCompatibility } from '../shopify';
import { StorefrontResource } from '../../resources';
import { ShopifyResource, defer, deferWith } from './resource';

export default function ShopifyAddress(
  instance: ShopifyCompatibility,
  address: StorefrontResource | SwellRecord,
): ShopifyResource {
  if (address instanceof ShopifyResource) {
    return address.clone();
  }

  return new ShopifyResource({
    address1: deferWith(address, (address: any) => address.address1),
    address2: deferWith(address, (address: any) => address.address2),
    city: deferWith(address, (address: any) => address.city),
    company: deferWith(address, (address: any) => address.company),
    country: deferWith(address, (address: any) =>
      ShopifyCountry(instance, address.country),
    ),
    country_code: deferWith(address, (address: any) => address.country_code),
    first_name: deferWith(address, (address: any) => address.first_name),
    id: deferWith(address, (address: any) => address.id),
    last_name: deferWith(address, (address: any) => address.last_name),
    name: deferWith(address, (address: any) => address.name),
    phone: deferWith(address, (address: any) => address.phone),
    province: deferWith(address, (address: any) => address.state),
    province_code: deferWith(address, (address: any) =>
      String(address.state || '').substring(0, 2),
    ),
    street: deferWith(address, (address: any) =>
      joinAddressLines(address.address1, address.address2),
    ),
    summary: deferWith(address, (address: any) =>
      joinAddressLines(
        address.name,
        address.company,
        address.address1,
        address.address2,
        address.city,
        address.state,
        address.country,
      ),
    ),
    url: deferWith(
      address,
      (address: any) => `/account/addresses/${address.id}`,
    ),
    zip: deferWith(address, (address: any) => address.zip),
  });
}

function joinAddressLines(...props: string[]) {
  return props.filter(Boolean).join('\n');
}

export function ShopifyCountry(
  _instance: ShopifyCompatibility,
  countryCode: string,
): ShopifyResource {
  return new ShopifyResource(
    {
      available_languages: [], // TODO
      continent: '', // TODO
      currency: '', // TODO
      iso_code: countryCode,
      market: null, // TODO
      name: countryCode, // TODO
      'popular?': true, // TODO
      unit_system: 'metric', // TODO
    },
    'iso_code',
  );
}
