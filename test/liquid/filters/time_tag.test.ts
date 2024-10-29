import { describeFilter } from '../helpers';

describeFilter('time_tag', (render) => {
  it('should return time tag', async () => {
    const result = await render(
      `{{ '2024-10-01T12:00:00.000Z' | time_tag: format: 'abbreviated_date' }}`,
    );

    expect(result).toBe(
      '<time datetime="2024-10-01T12:00:00.000Z">Oct 01, 2024</time>',
    );
  });
});
