import { LiquidSwell } from '..';

// {{ form.errors | default_errors }}

export default function bind(_liquidSwell: LiquidSwell) {
  return async (errors: any) => {
    const errorMessages = await Promise.all(
      Array.from(errors).map((error: any) => error?.message || 'Unkown error'),
    );

    // console.log('default_errors', errors, errorMessages);

    if (errorMessages.length === 0) {
      return '';
    }

    return `
      <div class="errors">
        <ul>
          ${errorMessages
            .map(
              (message: string) => `
            <li>${message}</li>
          `,
            )
            .join('')}
        </ul>
      </div>
    `;
  };
}
