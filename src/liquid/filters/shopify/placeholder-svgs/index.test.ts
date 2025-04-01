import svgs from './index';

type Pair = [string, string];

describe('placeholder-svgs', () => {
  function getSvgTag(content: string): string {
    return content.slice(0, content.indexOf('>') + 1);
  }

  describe('preserveAspectRatio', () => {
    const [regular, apparel] = Object.entries(svgs).reduce<[Pair[], Pair[]]>(
      (acc, pair) => {
        // Svg images containing "apparel", "lifestyle" in the name and "image.svg"
        // must have the "preserveAspectRatio" property to scale correctly.
        // If the current svg files do not have this property,
        // you can find it in the git history of the corresponding files.
        const index =
          /\b(apparel|lifestyle)\b/.test(pair[0]) || pair[0] === 'image'
            ? 1
            : 0;
        acc[index].push(pair);
        return acc;
      },
      [[], []],
    );

    it.each(regular)('%s', (name, content) => {
      expect(getSvgTag(content)).not.toMatch('preserveAspectRatio=');
    });

    it.each(apparel)('%s', (name, content) => {
      expect(getSvgTag(content)).toMatch('preserveAspectRatio=');
    });
  });

  describe('scale', () => {
    it.each(Object.entries(svgs))('%s', (name, content) => {
      // SVG tag should not contain fixed width and height,
      // as this excludes free scaling.
      // If the <svg /> tag contains these properties, you should remove them.
      expect(getSvgTag(content)).not.toMatch('width=');
      expect(getSvgTag(content)).not.toMatch('height=');
    });
  });
});
