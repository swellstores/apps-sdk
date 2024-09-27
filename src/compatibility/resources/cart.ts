import { Swell, SwellStorefrontSingleton } from '@/api';

export class CartResource extends SwellStorefrontSingleton {
  constructor(swell: Swell) {
    super(swell, 'cart');
  }
}
