import { describeFilter } from '../test-helpers';

describeFilter('inline_editable', (render) => {
  const heading = 'Test heading';

  it('should return inline editable content', async () => {
    const result = await render(`{{ heading | inline_editable: 'heading' }}`, {
      heading,
    });

    expect(result).toBe(
      `<span data-swell-inline-editable=\"heading\">Test heading</span>`,
    );
  });
});
