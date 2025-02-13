import svgs from './index';

type Pair = [string, string];

describe('placeholder-svgs', () => {
  const [regular, apparel] = Object.entries(svgs).reduce<[Pair[], Pair[]]>(
    (acc, pair) => {
      // Svg images containing "apparel" in the name
      // must have the "preserveAspectRatio" property to scale correctly.
      // If the current svg files do not have this property,
      // you can find it in the git history of the corresponding files.
      const index = /\bapparel\b/.test(pair[0]) ? 1 : 0;
      acc[index].push(pair);
      return acc;
    },
    [[], []],
  );

  it.each(regular)('svg %s', (name, content) => {
    expect(content).not.toMatch('preserveAspectRatio');
  });

  it.each(apparel)('svg %s', (name, content) => {
    expect(content).toMatch('preserveAspectRatio');
  });
});
