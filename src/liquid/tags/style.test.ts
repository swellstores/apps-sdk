import { md5 } from '@/utils';
import { describeTag } from '../test-helpers';

describeTag('style', (render) => {
  it('should generate an HTML <style> tag with an attribute of data-swell', async () => {
    const template =
      '{% style %} div: { color: {{ settings.color }}; } {% endstyle %}';
    const hash = md5(template);
    const result = await render(template, { settings: { color: 'red' } });

    expect(result).toBe(
      `<style data-swell data-hash="${hash}"> div: { color: red; } </style>`,
    );
  });
});
