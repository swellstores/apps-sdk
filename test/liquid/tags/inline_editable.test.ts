import { describeTag } from '../helpers';

describeTag('inline_editable', (render) => {
  const heading = 'Test heading';

  it('should return inline editable content', async () => {
    const result = await render(
      `{% inline_editable setting: 'heading', value: heading %}`,
      { heading },
    );

    expect(result).toBe(
      '<span data-swell-inline-editable="heading">Test heading</span>',
    );
  });
});
