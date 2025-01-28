import { describeFilter } from '../test-helpers';

describeFilter('image_url', (render) => {
  const image = '/test-image.png';

  it('should return image url', async () => {
    const result = await render(
      `{{ image | image_url: width: 450, height: 300 }}`,
      {
        image,
      },
    );

    expect(result).toBe(`/test-image.png?width=900&height=600`);
  });
});
