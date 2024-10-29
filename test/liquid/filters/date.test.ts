import { describeFilter } from '../helpers';

describeFilter('date', (render) => {
  it('should format date', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date: '%B %d, %Y' }}`,
    );

    expect(result).toBe('October 01, 2024');
  });

  it('should format date when format is passed as key-value', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date: format: '%B %d, %Y' }}`,
    );

    expect(result).toBe('October 01, 2024');
  });

  it('should return date in custom format', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date: 'abbreviated_date' }}`,
    );

    expect(result).toBe('Oct 01, 2024');
  });

  it('should return date in custom format when format is passed as key-value', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | date: format: 'abbreviated_date' }}`,
    );

    expect(result).toBe('Oct 01, 2024');
  });
});
