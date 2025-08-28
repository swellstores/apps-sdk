import { describeFilter } from '../test-helpers';

describeFilter('date_next_interval', (render) => {
  it('should calculate next daily date', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date_next_interval: 'daily', 3 }}`,
    );

    expect(result).toBe('2024-10-04T12:00:00.000Z');
  });

  it('should calculate next weekly date', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date_next_interval: 'weekly', 2 }}`,
    );

    expect(result).toBe('2024-10-15T12:00:00.000Z');
  });

  it('should calculate next monthly date', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date_next_interval: 'monthly', 1 }}`,
    );

    expect(result).toBe('2024-11-01T12:00:00.000Z');
  });

  it('should handle Jan 31 → Feb (leap year)', async () => {
    const result = await render(
      `{{ '2024-01-31T12:00:00.000Z' | date_next_interval: 'monthly', 1 }}`,
    );

    expect(result).toBe('2024-02-29T12:00:00.000Z'); // 2024 leap year
  });

  it('should handle Jan 31 → Feb (non-leap year)', async () => {
    const result = await render(
      `{{ '2023-01-31T12:00:00.000Z' | date_next_interval: 'monthly', 1 }}`,
    );

    expect(result).toBe('2023-02-28T12:00:00.000Z'); // 2023 non-leap
  });

  it('should calculate next yearly date', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date_next_interval: 'yearly', 1 }}`,
    );

    expect(result).toBe('2025-10-01T12:00:00.000Z');
  });

  it('should fallback to now if invalid interval passed', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date_next_interval: 'invalid', 1 }}`,
    );

    expect(() => new Date(result).toISOString()).not.toThrow();
  });
});
