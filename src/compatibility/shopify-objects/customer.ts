import { StorefrontResource, cloneStorefrontResource } from '@/resources';

import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyAddress from './address';
import ShopifyOrder from './order';
import ShopifyMoney from './money';

import type { ShopifyCompatibility } from '../shopify';
import type { SwellRecord } from 'types/swell';
import type { ShopifyCustomer } from 'types/shopify';

export default function ShopifyCustomer(
  instance: ShopifyCompatibility,
  account: StorefrontResource | SwellRecord,
): ShopifyResource<ShopifyCustomer> {
  if (account instanceof ShopifyResource) {
    return account.clone() as ShopifyResource<ShopifyCustomer>;
  }

  if (account instanceof StorefrontResource) {
    account = cloneStorefrontResource(account);
  }

  return new ShopifyResource<ShopifyCustomer>({
    accepts_marketing: defer(() => account.email_optin),
    addresses: deferWith(account.addresses, (addresses) =>
      addresses.results.map((address: SwellRecord) =>
        ShopifyAddress(instance, address),
      ),
    ),
    addresses_count: deferWith(
      account.addresses,
      (addresses) => addresses.count || 0,
    ),
    'b2b?': deferWith(account, () => account.type === 'business'),
    company_available_locations: [], // TODO
    company_available_locations_count: 0,
    current_company: undefined, // TODO
    current_location: undefined, // TODO
    default_address: deferWith(account, (account: SwellRecord) =>
      ShopifyAddress(
        instance,
        account.shipping || account.billing || {},
        account,
      ),
    ),
    email: defer(() => account.email),
    first_name: defer(() => account.first_name),
    has_account: true, // TODO: return something from the swell api to indicate when password exists
    'has_avatar?': false, // N/A
    id: defer(() => account.id),
    last_name: defer(() => account.last_name),
    last_order: defer(() => resolveLastOrder(instance, account)),
    name: defer(() => account.name),
    orders: deferWith(account.orders, (orders) =>
      orders.results.map((order: SwellRecord) => ShopifyOrder(instance, order)),
    ),
    orders_count: defer(() => account.order_count),
    payment_methods: [],
    phone: deferWith(account, (account) => account.phone),
    store_credit_account: deferWith(account, (account) => ({
      balance: ShopifyMoney(instance, Number(account.balance)),
    })),
    tags: deferWith(account, (account) => account.tags || [account.group]), // TODO: replace with segments in future
    tax_exempt: defer(() => account.tax_exempt),
    total_spent: defer(() => account.order_value),
  });
}

async function resolveLastOrder(
  instance: ShopifyCompatibility,
  account: StorefrontResource | SwellRecord,
) {
  const accountId = await account.id;

  const lastOrder = await instance.swell.getCachedResource(
    `last-order-${accountId}`,
    [],
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
