import * as fs from 'node:fs';

/** @see {@link https://jestjs.io/docs/code-transformation#examples} */

export async function processAsync(sourceText, sourcePath) {
  const content = await fs.promises.readFile(sourcePath, { encoding: 'utf8' });

  return {
    code: `module.exports = ${JSON.stringify(content)};`,
  };
}

export function process(sourceText, sourcePath) {
  const content = fs.readFileSync(sourcePath, { encoding: 'utf8' });

  return {
    code: `module.exports = ${JSON.stringify(content)};`,
  };
}
