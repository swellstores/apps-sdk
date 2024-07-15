import { ShopifyCompatibility } from '../shopify';
import { ThemeForm } from '../../liquid/form';
import { ShopifyResource } from './resource';

const SHOPIFY_FORMS = {
  account_login: {
    params: () => ({
      password_needed: true,
    }),
  },
};

export default function ShopifyForm(
  _instance: ShopifyCompatibility,
  form: ThemeForm,
): ShopifyResource {
  if (form instanceof ShopifyResource) {
    return form.clone();
  }

  const shopifyForm = (SHOPIFY_FORMS as any)[form.id];

  return new ShopifyResource({
    ...(shopifyForm?.params?.(form) || undefined),
    errors: form.errors && new ShopifyFormErrors(form.errors),
    'posted_successfully?': form.success,
  });
}

export class ShopifyFormError {
  public code: string;
  public message: string;
  public field_name: string;
  public field_label: string;
  public type: string;

  constructor(error: any) {
    this.code = error.code;
    this.message = error.message;
    this.field_name = error.field_name;
    this.field_label = error.field_label;
    this.type = this.getShopifyErrorType(error);
  }

  getShopifyErrorType(error: any) {
    if (error.field_name === 'email') {
      return 'email';
    }
    if (error.field_name === 'password') {
      return 'password';
    }
    return 'form';
  }

  valueOf() {
    return this.type;
  }

  toString() {
    return this.type;
  }
}

export class ShopifyFormErrors {
  private errors: any[];
  private pointer: number = 0;

  public messages: ShopifyFormErrorArrayByType;
  public translated_fields: ShopifyFormErrorArrayByType;

  constructor(errors: any) {
    this.errors = Array.from(errors as any).map(
      (error: any) => new ShopifyFormError(error),
    );

    this.messages = new ShopifyFormErrorArrayByType(
      this.errors,
      this.errors.map((error: any) => error.message),
    );

    this.translated_fields = new ShopifyFormErrorArrayByType(
      this.errors,
      this.errors.map((error: any) => error.field_label),
    );

    return new Proxy(this.errors as any, {
      get: (target, prop) => {
        const instance = target as any;

        if (prop === 'toJSON') {
          return this.errors;
        }

        if (prop === 'some') {
          return this.some.bind(this);
        }

        if (prop === 'messages') {
          return this.messages;
        }

        if (prop === 'translated_fields') {
          return this.translated_fields;
        }

        return instance[prop];
      },

      getPrototypeOf() {
        return ShopifyFormErrors.prototype;
      },
    });
  }

  *[Symbol.iterator]() {
    yield* this.errors;
  }

  some(callbackFn: any, thisArg?: any) {
    return this.errors.some((error: any) => callbackFn(error?.type), thisArg);
  }
}

// Class to handle indexing messages by error object
export class ShopifyFormErrorArrayByType {
  values: any[];

  constructor(errors: any, values: any) {
    this.values = values;

    return new Proxy(values, {
      get: (target, prop) => {
        const instance = target as any;

        if (prop === 'toJSON') {
          return values;
        }

        const foundIndex = errors?.findIndex?.(
          (value: any) => value?.type === prop,
        );
        if (foundIndex !== -1) {
          return values[foundIndex];
        }

        return instance[prop];
      },
    });
  }
}
