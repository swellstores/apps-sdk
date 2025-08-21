import { Drop } from 'liquidjs';
import { noop } from 'lodash-es';

export default class RenderDrop<T> extends Drop {
  #result: unknown;
  #handler: () => T | Promise<T>;

  constructor(handler: () => T | Promise<T>) {
    super();

    this.#result = undefined;
    this.#handler = handler;
  }

  /**
   * For `Drop` we usually use `valueOf` to convert the `object` to a `string`.
   * Use `then` instead of `valueOf` since `valueOf` doesn't work for `Promise`.
   */
  then(
    onfulfilled: (value: unknown) => void,
    onrejected: (err: unknown) => void,
  ) {
    if (this.#handler !== noop) {
      this.#result = Promise.resolve()
        .then(this.#handler)
        .then((result) => {
          this.#result = result;
          return this.#result;
        })
        .then(onfulfilled, onrejected) as T;

      // Reset handler as it will no longer be used (free memory)
      this.#handler = noop as () => T | Promise<T>;

      return;
    }

    onfulfilled(this.#result);
  }
}
