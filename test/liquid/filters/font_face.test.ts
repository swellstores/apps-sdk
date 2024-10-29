import { describeFilter } from '../helpers';

describeFilter('font_face', (render) => {
  const font = 'Roboto:ital,wght@0,100;';

  it('should generate a CSS font face declaration', async () => {
    const result = await render(
      `{{ font | font_face: font_display: 'swap' }}`,
      { font },
    );

    expect(result.replaceAll('\n', '')).toBe(
      `@font-face {font-family: 'Roboto';font-style: italic;font-weight: 100;font-display: swap;}`,
    );
  });
});
