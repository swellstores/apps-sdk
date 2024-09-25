import { StorefrontResource } from '../../resources';

import { ShopifyCompatibility } from '../shopify';

import {
  ShopifyResource,
  defer,
  deferWith,
  deferSwellCollectionWithShopifyResults,
} from './resource';
import ShopifyAddress from './address';
import ShopifyOrder from './order';

import type { SwellRecord } from 'types/swell';

export default function ShopifyCustomer(
  instance: ShopifyCompatibility,
  account: StorefrontResource | SwellRecord,
): ShopifyResource {
  if (account instanceof ShopifyResource) {
    return account.clone();
  }

  return new ShopifyResource({
    accepts_marketing: defer(() => account.email_optin),
    addresses: deferSwellCollectionWithShopifyResults(
      instance,
      account,
      'addresses',
      ShopifyAddress,
    ),
    addresses_count: deferWith<any, any>(
      account.addresses,
      (addresses) => addresses.count || 0,
    ),
    'b2b?': deferWith(account, () => account.type === 'business'),
    company_available_locations: [], // TODO
    current_company: null, // TODO
    current_location: null, // TODO
    default_address: deferWith(
      account,
      (account: any) =>
        (account.shipping || account.billing) &&
        ShopifyAddress(instance, account.shipping || account.billing),
    ),
    email: deferWith(account, (account: any) => account.email),
    first_name: deferWith(account, (account: any) => account.first_name),
    has_account: true, // TODO: return something from the swell api to indicate when password exists
    'has_avatar?': false, // N/A
    id: deferWith(account, (account: any) => account.id),
    last_name: deferWith(account, (account: any) => account.last_name),
    last_order: defer(() => resolveLastOrder(instance, account)),
    name: deferWith(account, (account: any) => account.name),
    orders: deferSwellCollectionWithShopifyResults(
      instance,
      account,
      'orders',
      ShopifyOrder,
    ),
    orders_count: defer(() => account.order_count),
    phone: deferWith(
      account,
      (account: any) =>
        account.phone || account.shipping?.phone || account.billing?.phone,
    ),
    tags: deferWith(account, (account: any) => account.tags || [account.group]), // TODO: replace with segments in future
    tax_exempt: defer(() => account.tax_exempt),
    total_spent: defer(() => account.order_value),
  });
}

async function resolveLastOrder(instance: ShopifyCompatibility, account: StorefrontResource | SwellRecord) {
  const accountId = await account.id;

  const lastOrder = await instance.swell.getCachedResource(
    `last-order-${accountId}`,
    async () => {
      return (
        await instance.swell.storefront.account.listOrders({
          limit: 1,
        })
      )?.results?.[0];
    },
  );

  if (!lastOrder) {
    return;
  }

  return ShopifyOrder(instance, lastOrder as SwellRecord, account);
}
