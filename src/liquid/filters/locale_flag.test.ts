import * as flags from 'country-flag-icons/string/1x1';
import { describeFilter } from '../test-helpers';

describeFilter('locale_flag', (render) => {
  it('should return locale flag', async () => {
    const result = await render(`{{ locale | locale_flag }}`, {
      locale: 'de-DE',
    });

    expect(result).toBe(flags.DE);
  });

  it('should return locale flag when locale is in short format', async () => {
    const result = await render(`{{ locale | locale_flag }}`, {
      locale: 'de',
    });

    expect(result).toBe(flags.DE);
  });

  it('should return the US flag when locale is not recognized', async () => {
    const result = await render(`{{ locale | locale_flag }}`, {
      locale: 'unknown',
    });

    expect(result).toBe(flags.US);
  });

  it('should return the US flag when locale is null', async () => {
    const result = await render(`{{ locale | locale_flag }}`, {
      locale: null,
    });

    expect(result).toBe(flags.US);
  });

  it('should return the US flag when locale is not defined', async () => {
    const result = await render(`{{ locale | locale_flag }}`);

    expect(result).toBe(flags.US);
  });
});
