import { ThemeFont } from '../font';
import { describeFilter } from '../test-helpers';

describeFilter('font_modify', (render) => {
  const fontId =
    'Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900';

  it('should modify font (string)', async () => {
    const result = await render(
      `{%- assign bold_font = font | font_modify: 'weight', 'bold' -%}
       h2 { font-weight: {{ bold_font.weight }}; }`,
      { font: fontId },
    );

    expect(result).toBe('h2 { font-weight: 700; }');
  });

  it('should modify font (object)', async () => {
    const font = new ThemeFont(fontId);
    const weight = font.weight;

    const result = await render(
      `{%- assign bold_font = font | font_modify: 'weight', 'bold' -%}
       h2 { font-weight: {{ bold_font.weight }}; }`,
      { font },
    );

    expect(result).toStrictEqual('h2 { font-weight: 700; }');
    expect(weight).not.toStrictEqual(700);
    expect(font.weight).toStrictEqual(weight);
  });
});
