import { Drop } from 'liquidjs';

import type { ShopifyRule } from 'types/shopify';

export default class RobotsRule extends Drop implements ShopifyRule {
  static from(directive: string, value: string): RobotsRule {
    return new RobotsRule(directive, value);
  }

  constructor(
    public directive: string,
    public value: string,
  ) {
    super();
  }

  valueOf(): string {
    return `${this.directive}: ${this.value}\n`;
  }
}
