import { LiquidSwell } from '..';

// {{ account.shipping | format_address }}

export default {
  bind(_liquidSwell: LiquidSwell) {
    return async (address: any) => {
      if (address) {
        const country =
          address.country?.iso_code ||
          address.country_code ||
          (typeof address.country === 'string' ? address.country : null);

        if (address.address1 || address.state || country) {
          const addressLines = [
            address.name,
            address.company,
            address.address1,
            address.address2,
            address.city,
            address.state,
            country,
            address.zip,
          ].filter(Boolean);

          if (addressLines.length > 0) {
            return `
              <p>${addressLines.join('<br />')}</p>
            `;
          }
        }
      }

      return '<p></p>';
    };
  },
  resolve: [
    [
      'name',
      'company',
      'address1',
      'address2',
      'city',
      'state',
      'country_code',
      'country',
      'zip',
    ],
  ],
};
