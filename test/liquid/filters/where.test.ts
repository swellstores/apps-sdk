import { describeFilter } from '../helpers';

describeFilter('where', (render) => {
  const collection = [{ name: 'Default' }, { name: 'Special', special: true }];

  it('should return filtered values', async () => {
    const result = await render(
      `{% assign specials = collection | where: 'special', true %}
       {{ specials | json }}`,
      {
        collection,
      },
    );

    expect(result.trim()).toBe('[{"name":"Special","special":true}]');
  });
});
