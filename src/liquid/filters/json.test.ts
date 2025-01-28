import { describeFilter } from '../test-helpers';

describeFilter('json', (render) => {
  const object = {
    key: 'value',
  };

  it('should return json', async () => {
    const result = await render(`{{ object | json }}`, {
      object,
    });

    expect(result).toBe('{"key":"value"}');
  });
});
