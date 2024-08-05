import type { SwellData, ThemeFormErrorMessages } from 'types/swell';

export class ThemeForm {
  public id: string;
  public success: boolean = false;
  public errors: ThemeFormErrors | null = null;

  constructor(id: string) {
    this.id = id;
  }

  setSuccess(success: boolean = true) {
    this.success = success;
  }

  setParams(params: SwellData) {
    Object.assign(this, params);
  }

  setErrors(errors: ThemeFormErrorMessages) {
    this.errors = new ThemeFormErrors(errors);
  }

  clearErrors() {
    this.errors = null;
  }
}

export class ThemeFormErrors {
  private errors: ThemeFormErrorMessages;

  constructor(errors?: ThemeFormErrorMessages) {
    this.errors = errors || [];
  }

  *[Symbol.iterator]() {
    yield* this.errors;
  }

  // Used by {% form.errors contains 'code' %}
  some(callbackFn: (code?: string) => boolean, thisArg?: unknown) {
    return this.errors.some((error) => callbackFn(error?.code), thisArg);
  }
}
