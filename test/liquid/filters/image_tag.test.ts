import { describeFilter } from '../helpers';

describeFilter('image_tag', (render) => {
  const image = '/test-image.png';

  it('should generate img tag', async () => {
    const result = await render(
      `{{ image | image_url: width: 600 | image_tag:
        class: 'test_css_class',
        height: 500,
        width: 600,
        alt: 'test_alt',
        sizes: '(min-width:1600px) 960px, (min-width: 750px) calc((100vw - 11.5rem) / 2), calc(100vw - 4rem)',
        preload: 'true'
      }}`,
      {
        image,
      },
    );

    expect(result).toBe(
      `<img src=\"/test-image.png?width=1200\" width=\"600\" height=\"500\" srcset=\"/test-image.png?width=480 480w, /test-image.png?width=384 384w, /test-image.png?width=307 307w, /test-image.png?width=246 246w\" alt=\"test_alt\" loading=\"eager\" class=\"test_css_class\" sizes=\"(min-width:1600px) 960px, (min-width: 750px) calc((100vw - 11.5rem) / 2), calc(100vw - 4rem)\" />`,
    );
  });
});
