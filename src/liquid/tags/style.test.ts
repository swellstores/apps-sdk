import { describeTag } from '../test-helpers';

describeTag('style', (render) => {
  it('should generate an HTML <style> tag with an attribute of data-swell', async () => {
    const result = await render(
      `{% style %} div: { color: {{ settings.color }}; } {% endstyle %}`,
      { settings: { color: 'red' } },
    );

    expect(result).toBe(`<style data-swell> div: { color: red; } </style>`);
  });
});
