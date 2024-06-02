import { ShopifyResource, defer, deferWith } from './resource';
import ShopifyAddress from './address';
import ShopifyOrder from './order';

export default function ShopifyCustomer(
  instance: ShopifyCompatibility,
  account: StorefrontResource | SwellRecord,
): ShopifyResource {
  if (account instanceof ShopifyResource) {
    return account.clone();
  }

  return new ShopifyResource({
    accepts_marketing: defer(() => account.email_optin),
    addresses: deferWith(account, async (account: any) => {
      return await resolveAddresses(instance, account);
    }),
    addresses_count: deferWith(account, async (account: any) => {
      return (await resolveAddresses(instance, account))?.length || 0;
    }),
    b2b: deferWith(account, () => account.type === 'business'),
    company_available_locations: [], // TODO
    current_company: null, // TODO
    current_location: null, // TODO
    default_address: deferWith(
      account,
      (account: any) =>
        (account.shipping || account.billing) &&
        ShopifyAddress(instance, account.shipping || account.billing),
    ),
    email: defer(() => account.email),
    first_name: defer(() => account.first_name),
    has_account: true, // TODO: return something from the swell api to indicate when password exists
    has_avatar: false, // N/A
    id: defer(() => account.id),
    last_name: defer(() => account.last_name),
    last_order: deferWith(account, async (account: any) =>
      resolveLastOrder(instance, account),
    ),
    name: defer(() => account.name),
    orders: deferWith(
      account,
      async (account: any) => await resolveOrders(instance, account),
    ),
    orders_count: defer(() => account.order_count),
    phone: deferWith(
      account,
      (account: any) =>
        account.phone || account.shipping?.phone || account.billing?.phone,
    ),
    tags: defer(() => account.tags || [account.group]), // TODO: replace with segments in future
    tax_exempt: defer(() => account.tax_exempt),
    total_spent: defer(() => account.order_value),
  });
}

async function resolveAddresses(instance: ShopifyCompatibility, account: any) {
  const addresses = await instance.swell.getCachedResource(
    `addresses-${account.id}`,
    () => {
      return instance.swell.storefront.account.listAddresses();
    },
  );

  return (addresses as any)?.results?.map((address: any) =>
    ShopifyAddress(instance, address),
  );
}

async function resolveOrders(instance: ShopifyCompatibility, account: any) {
  const orders = await instance.swell.getCachedResource(
    `orders-${account.id}`,
    () => instance.swell.storefront.account.listOrders(),
  );

  return (orders as any)?.results?.map((order: any) =>
    ShopifyOrder(instance, order, account),
  );
}

async function resolveLastOrder(instance: ShopifyCompatibility, account: any) {
  const lastOrder = await instance.swell.getCachedResource(
    `last-order-${account.id}`,
    async () => {
      return (
        await instance.swell.storefront.account.listOrders({
          limit: 1,
        })
      )?.results?.[0];
    },
  );

  return lastOrder && ShopifyOrder(instance, lastOrder as any, account);
}
