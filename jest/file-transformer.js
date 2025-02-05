import * as fs from 'node:fs';

/** @see {@link https://jestjs.io/docs/code-transformation#examples} */

/** @type {import('@jest/transform').SyncTransformer} */
const transformer = {
  async processAsync(sourceText, sourcePath) {
    const content = await fs.promises.readFile(sourcePath, {
      encoding: 'utf8',
    });

    return {
      code: `module.exports = ${JSON.stringify(content)};`,
    };
  },

  process(sourceText, sourcePath) {
    const content = fs.readFileSync(sourcePath, { encoding: 'utf8' });

    return {
      code: `module.exports = ${JSON.stringify(content)};`,
    };
  },
};

export default transformer;
