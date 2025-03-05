import { Drop } from 'liquidjs';

export default class ObjectHandlesDrop<T> extends Drop {
  #map: Map<string, T>;

  constructor(map?: Record<string, T> | Map<string, T>) {
    super();

    switch (typeof map) {
      case 'object': {
        if (map === null) {
          this.#map = new Map();
          break;
        }

        this.#map = new Map(map instanceof Map ? map : Object.entries(map));
        break;
      }

      default:
        this.#map = new Map();
        break;
    }
  }

  liquidMethodMissing(key: unknown): T | undefined {
    switch (typeof key) {
      case 'string':
        return this.#map.get(key);

      case 'object': {
        if (key !== null && 'handle' in key) {
          const { handle } = key;

          if (typeof handle === 'string') {
            return this.#map.get(handle);
          }
        }

        break;
      }

      default:
        break;
    }
  }
}
