import { describeTag } from '../test-helpers';

describeTag('for', (render) => {
  const products = [
    { title: 'Draught of Immortality' },
    { title: 'Glacier ice' },
  ];

  it('should render an expression for every item in an array', async () => {
    const result = await render(
      `{% for product in products -%}
        <span>{{ product.title }}</span>
      {%- endfor %}`,
      {
        products,
      },
    );

    expect(result.trim()).toBe(
      '<span>Draught of Immortality</span><span>Glacier ice</span>',
    );
  });
});
