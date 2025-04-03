import type { FilterHandler } from 'liquidjs/dist/template';
import type { LiquidSwell } from '..';

// {{ form.errors | default_errors }}

export default function bind(_liquidSwell: LiquidSwell): FilterHandler {
  return async function filterDefaultError(errors) {
    if (!errors) {
      return '';
    }

    const errorMessages = await Promise.all(
      Array.from(errors).map((error: any) => error?.message || 'Unknown error'),
    );

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
