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
    default_address: deferWith(account, (account: any) =>
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
  account._addresses =
    account._addresses ||
    (await instance.swell.storefront.account.listAddresses());

  return account._addresses?.results?.map((address: any) =>
    ShopifyAddress(instance, address),
  );
}

async function resolveOrders(instance: ShopifyCompatibility, account: any) {
  account._orders =
    account._orders || (await instance.swell.storefront.account.listOrders());

  return account._orders?.results?.map((order: any) =>
    ShopifyOrder(instance, order, account),
  );
}

async function resolveLastOrder(instance: ShopifyCompatibility, account: any) {
  account._last_order =
    account._last_order ||
    (await instance.swell.storefront.account.listOrders({ limit: 1 }));

  return ShopifyOrder(instance, account._last_order, account);
}
