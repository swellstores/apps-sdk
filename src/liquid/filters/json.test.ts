import { describeFilter } from '../test-helpers';

describeFilter('json', (render) => {
  it('should return json', async () => {
    const object = { key: 'value' };

    const result = await render(`{{ object | json }}`, { object });

    expect(result).toBe('{"key":"value"}');
  });

  it('should render null for undefined values', async () => {
    const object = { key: 'value' };

    const result = await render(`{{ object.missing | json }}`, { object });

    expect(result).toBe('null');
  });
});
