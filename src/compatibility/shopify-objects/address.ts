import { ShopifyResource, defer, deferWith } from './resource';

export default function ShopifyAddress(
  instance: ShopifyCompatibility,
  address: StorefrontResource | SwellRecord,
): ShopifyResource {
  if (address instanceof ShopifyResource) {
    return address.clone();
  }

  return new ShopifyResource({
    address1: defer(() => address.address1),
    address2: defer(() => address.address2),
    city: defer(() => address.city),
    company: defer(() => address.company),
    country: deferWith(address, (address: any) =>
      ShopifyCountry(instance, address.country),
    ),
    country_code: defer(() => address.country_code),
    first_name: defer(() => address.first_name),
    id: defer(() => address.id),
    last_name: defer(() => address.last_name),
    name: defer(() => address.name),
    phone: defer(() => address.phone),
    province: defer(() => address.state),
    province_code: deferWith(address, (address: any) =>
      String(address.state || '').substring(0, 2),
    ),
    street: deferWith(address, (address: any) =>
      joinAddressLines(address.address1, address.address2),
    ),
    summary: deferWith(address, (address: any) =>
      joinAddressLines(
        address.name,
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
    zip: defer(() => address.zip),
  });
}

function joinAddressLines(...props: string[]) {
  return props.filter(Boolean).join('\n');
}

export function ShopifyCountry(
  _instance: ShopifyCompatibility,
  countryCode: string,
): ShopifyResource {
  return new ShopifyResource({
    available_languages: [], // TODO
    continent: '', // TODO
    currency: '', // TODO
    iso_code: countryCode,
    market: null, // TODO
    name: countryCode, // TODO
    popular: true, // TODO
    unit_system: 'metric', // TODO
  });
}
