import { LiquidSwell } from '..';
import { StorefrontResource } from '../../resources';

// {{ product | json }}

export default function bind(_liquidSwell: LiquidSwell) {
  return async (value: any, space = 0) => {
    if (value instanceof StorefrontResource) {
      await value.resolve();
    }

    await resolveAllKeys(value);

    // Catch circular references, for example StorefrontResource
    const references: any[] = [];

    return JSON.stringify(
      value,
      (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (references.includes(value)) {
            // Ignore circular reference
            return;
          }
          references.push(value);
        }
        return value;
      },
      space,
    );
  };
}

async function resolveAllKeys(value: any, references: any[] = []) {
  await forEachKeyDeep(value, async (key, value) => {
    if (value[key] instanceof Promise) {
      value[key] = await value[key];
      await resolveAllKeys(value[key], references);
    } else if (typeof value[key] === 'object' && value[key] !== null) {
      if (references.includes(value[key])) {
        // Ignore circular reference
        return false;
      }
      references.push(value[key]);
    }
  });
}

async function forEachKeyDeep(
  obj: any,
  fn: (key: string, value: any) => Promise<boolean | void>,
) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = await fn(key, obj);
      if (result !== false) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          await forEachKeyDeep(value, fn);
        }
      }
    }
  }
}
