export class ThemeForm {
  public id: string;
  public success: boolean = false;
  public errors?: ThemeFormErrors;

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
    this.errors = undefined;
  }
}

export class ThemeFormErrors {
  private errors?: ThemeFormErrorMessages;

  constructor(errors?: ThemeFormErrorMessages) {
    this.errors = errors;
  }

  [Symbol.iterator]() {
    return this.iterator();
  }

  *iterator() {
    for (const error of this.errors || []) {
      yield error;
    }
  }

  // Used by {% form.errors contains 'code' %}
  some(callbackFn: any, thisArg?: any) {
    return this.errors?.some((error: any) => callbackFn(error?.code), thisArg);
  }
}
