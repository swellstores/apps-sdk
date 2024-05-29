import { LiquidSwell } from '../..';

// {{ cart | item_count_for_variant: 650c737e2f5fb6f22124c823 }}

export default {
  bind(_liquidSwell: LiquidSwell) {
    return (cart: any, variantId: string) => {
      const variantItem = cart.items?.find(
        (item: any) => item.variant_id === variantId,
      );

      return variantItem?.quantity || 0;
    };
  },
  resolve: [['items']],
};
