import { describeTag } from '../helpers';

describeTag('case', (render) => {
  const product = { type: 'Love' };

  it('should render the corresponding case', async () => {
    const result = await render(
      `{% case product.type %}
        {% when 'Health' %}
          This is a health potion.
        {% when 'Love' %}
          This is a love potion.
        {% else %}
          This is a potion.
      {% endcase %}`,
      {
        product,
      },
    );

    expect(result.trim()).toBe('This is a love potion.');
  });
});
