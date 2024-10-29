import { describeFilter } from '../helpers';

describeFilter('font_modify', (render) => {
  const font =
    'Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900';

  it('should modify font', async () => {
    const result = await render(
      `{%- assign bold_font = font | font_modify: 'weight', 'bold' -%}
       h2 { font-weight: {{ bold_font.weight }}; }`,
      { font },
    );

    expect(result).toBe(`h2 { font-weight: 700; }`);
  });
});
