import { Drop } from 'liquidjs';

export default class RenderDrop extends Drop {
  constructor(public handler: () => unknown) {
    super();
  }

  valueOf() {
    return this.handler();
  }
}
