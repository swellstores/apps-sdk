import * as esbuild from 'esbuild';

/**
 * Parallel compile helper adapted from https://www.npmjs.com/package/@kruining/waterlogged
 */
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};
let _call;

const c = new Proxy(() => {}, {
  get: (_target, property) => {
    if (Object.keys(colors).includes(property) === false) {
      throw new Error(c.red`'${property}' is not a valid color!`);
    }

    _call = property;

    return c;
  },
  apply: (_target, _thisArg, [strings, ...args]) => {
    return `${colors[_call]}${strings
      .flatMap((s, i) => [s, args[i] ?? ''])
      .join('')}${colors.reset}`;
  },
});

function toPlatform(format) {
  switch (format) {
    case 'esm':
      return 'neutral';

    case 'cjs':
      return 'node';

    case 'iife':
      return 'browser';

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function toExtension(format) {
  switch (format) {
    case 'esm':
      return 'mjs';

    case 'cjs':
      return 'cjs';

    case 'iife':
      return 'js';

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * @param {string[]} formats
 * @param {esbuild.BuildOptions} options
 * @returns {Promise<void>}
 */
export async function build(formats, options) {
  const watchMode = process.argv[2] === 'watch';

  let builds = [];

  const add = () => {
    let done;

    builds.push(new Promise((r) => (done = r)));

    if (builds.length === formats.length) {
      Promise.all(builds).then((results) => {
        builds = [];

        log(results);
      });
    }

    return done;
  };

  const log = (builds) => {
    const [start, end] = builds.reduce(
      ([s, e], { start, end }) => [Math.min(s, start), Math.max(e, end)],
      [Infinity, 0],
    );
    const results = builds
      .map(({ format, start, end, result }) => {
        const isSuccessful = result.errors.length === 0;
        const color = isSuccessful ? c.green : c.red;
        const icon = isSuccessful ? '✓' : '⚠';

        return color`${icon} ${format} in ${Math.round(end - start)}ms`;
      })
      .join('\n');

    console.log(
      c.cyan`🌊 Finished build (${Math.round(
        end - start,
      )}ms total)\n\n${results}\n`,
    );

    if (watchMode) {
      console.log('watching for changes...\n');
    }
  };

  return Promise.all(
    formats.map((format) => {
      return esbuild[watchMode ? 'context' : 'build']({
        ...options,
        format,
        platform: toPlatform(format),
        outfile: options.outfile
          ?.replaceAll(/\$formatExtension/g, toExtension(format))
          .replaceAll(/\$format/g, format),
        outdir: options.outdir
          ?.replaceAll(/\$formatExtension/g, toExtension(format))
          .replaceAll(/\$format/g, format),

        plugins: [
          ...(options.plugins ?? []),
          {
            name: 'Logger',

            setup(build) {
              let start = 0;
              let done;

              build.onStart(() => {
                start = performance.now();

                done = add();
              });
              build.onEnd((result) => {
                const end = performance.now();

                done({ format, start, end, result });
              });
            },
          },
        ],
      }).then((result) => {
        if (watchMode) {
          return result.watch();
        }
        return result;
      });
    }),
  );
}
