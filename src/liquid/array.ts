export default class LiquidArray<T> extends Array<T> {
  constructor(items?: Iterable<T> | number) {
    if (typeof items === 'number') {
      super(items);
    } else {
      super(...(items || []));
    }
  }

  static from<T>(iterable: Iterable<T> | ArrayLike<T>): LiquidArray<T> {
    return new LiquidArray<T>(super.from(iterable));
  }

  get size(): number {
    return this.length;
  }
}
