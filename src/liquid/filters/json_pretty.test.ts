import { describeFilter } from '../test-helpers';

describeFilter('json_pretty', (render) => {
  it('should return json pretty', async () => {
    const object = { key: 'value' };

    const result = await render(`{{ object | json_pretty }}`, {
      object,
    });

    expect(result.replaceAll('\n', '')).toBe(`<pre>{  "key": "value"}</pre>`);
  });

  it('should render null for undefined values', async () => {
    const object = { key: 'value' };

    const result = await render(`{{ object.missing | json_pretty }}`, {
      object,
    });

    expect(result).toBe('<pre>null</pre>');
  });
});
