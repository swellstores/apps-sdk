import { describeFilter } from '../helpers';

describeFilter('json_pretty', (render) => {
  const object = {
    key: 'value',
  };

  it('should return json pretty', async () => {
    const result = await render(`{{ object | json_pretty }}`, {
      object,
    });

    expect(result.replaceAll('\n', '')).toBe(`<pre>{  "key": "value"}</pre>`);
  });
});
