import { LiquidSwell } from '..';

// {{ account.shipping | format_address }}

export default function bind(_liquidSwell: LiquidSwell) {
  return async (address: any) => {
    const addressLines = [
      address?.company,
      address?.name,
      address?.address1,
      address?.address2,
      address?.city,
      address?.state,
      address?.country?.iso_code || address?.country_code || address?.country,
      address?.zip,
    ]
      .filter(Boolean)
      .join('<br />');

    return `
      <p>${addressLines}</p>
    `;
  };
}
