import { describeFilter } from '../test-helpers';

describeFilter('translate', (render, liquid) => {
  it('should return translate', async () => {
    const result = await render(`{{ 'translation.key' | t: prop: 'value' }}`);

    expect(result).toBe('Translation: translation.key');
    expect(liquid.renderTranslation).toHaveBeenCalledWith('translation.key', {
      prop: 'value',
    });
  });
});
