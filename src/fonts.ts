import type { ThemeFontConfig } from '../types/swell';

/**
 * Map of all fonts supported by Swell.
 */
export const fontMap: Array<ThemeFontConfig> = [
  // System fonts
  {
    family: 'monospace',
    label: 'Monospace',
    fallback:
      'Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol',
    axes: ['wght', 'ital'],
    variants: [{ wght: 400 }, { wght: 400, ital: 1 }, { wght: 600, ital: 1 }],
    system: true,
  },
  {
    family: 'serif',
    label: 'Serif',
    fallback:
      'Iowan Old Style, Apple Garamond, Baskerville, Times New Roman, Droid Serif, Times, Source Serif Pro, serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol',
    axes: ['wght', 'ital'],
    variants: [{ wght: 400 }, { wght: 400, ital: 1 }, { wght: 600, ital: 1 }],
    system: true,
  },
  {
    family: 'sans-serif',
    label: 'Sans-serif',
    fallback:
      'BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol',
    axes: ['wght', 'ital'],
    variants: [{ wght: 400 }, { wght: 400, ital: 1 }, { wght: 600, ital: 1 }],
    system: true,
  },
  // Google fonts
  {
    family: 'Abel',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Abril Fatface',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Alegreya',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Alegreya Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Amiri',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Anonymous Pro',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Arapey',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
    ],
  },
  {
    family: 'Archivo',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Archivo Narrow',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Arimo',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Armata',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Arvo',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Asap',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Assistant',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'Asul',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Bio Rhyme',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'Bitter',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Cabin',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Cardo',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Catamaran',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Chivo',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Cormorant',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Crimson Text',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'DM Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Domine',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Dosis',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'Eczar',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'Fira Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Fjalla One',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Glegoo',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'IBM Plex Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Inconsolata',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Inknut Antiqua',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Inter',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Josefin Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Josefin Slab',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Kalam',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Karla',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Kreon',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Lato',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Libre Baskerville',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Libre Franklin',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Lobster',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Lobster Two',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Lora',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Maven Pro',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Megrim',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Merriweather Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
    ],
  },
  {
    family: 'Montserrat',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Mouse Memoirs',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Muli',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Neuton',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'News Cycle',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Newsreader',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
    ],
  },
  {
    family: 'Nobile',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Noticia Text',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Noto Serif',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Nunito',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Nunito Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Old Standard TT',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Open Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
    ],
  },
  {
    family: 'Open Sans Condensed',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Oswald',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Ovo',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Oxygen',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'PT Mono',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'PT Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'PT Sans Narrow',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'PT Serif',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Pacifico',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Playball',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Playfair Display',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Poppins',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Prata',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Prompt',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Proza Libre',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
    ],
  },
  {
    family: 'Quantico',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Quattrocento',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Quattrocento Sans',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Questrial',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Quicksand',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Rajdhani',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Raleway',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 800,
      },
      {
        wght: 800,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Righteous',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Roboto',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Roboto Condensed',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Roboto Mono',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 100,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Roboto Slab',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Rubik',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Shadows Into Light',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Slabo 13px',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Smooch',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Source Code Pro',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Source Sans Pro',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Space Mono',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Syne',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'Tenor Sans',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Tinos',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Titillium Web',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 200,
        ital: 1,
      },
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Ubuntu',
    fallback: 'sans-serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 300,
        ital: 1,
      },
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 500,
      },
      {
        wght: 500,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Unica One',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Unna',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Varela',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Varela Round',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Vidaloka',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Volkhov',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
    ],
  },
  {
    family: 'Vollkorn',
    fallback: 'serif',
    axes: ['wght', 'ital'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 400,
        ital: 1,
      },
      {
        wght: 600,
      },
      {
        wght: 600,
        ital: 1,
      },
      {
        wght: 700,
      },
      {
        wght: 700,
        ital: 1,
      },
      {
        wght: 900,
      },
      {
        wght: 900,
        ital: 1,
      },
    ],
  },
  {
    family: 'Work Sans',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'BIZ UDPMincho',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Dela Gothic One',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Hina Mincho',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Kaisei Decol',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Kaisei Opti',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
    ],
  },
  {
    family: 'Kaisei Tokumin',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'M PLUS 1',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'M PLUS Rounded 1c',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Mochiy Pop P One',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Murecho',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Noto Sans Japanese',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 100,
      },
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Noto Serif Japanese',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 200,
      },
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Shippori Mincho',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 800,
      },
    ],
  },
  {
    family: 'Zen Kaku Gothic New',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Zen Kurenaido',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
    ],
  },
  {
    family: 'Zen Maru Gothic',
    fallback: 'sans-serif',
    axes: ['wght'],
    variants: [
      {
        wght: 300,
      },
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 700,
      },
      {
        wght: 900,
      },
    ],
  },
  {
    family: 'Zen Old Mincho',
    fallback: 'serif',
    axes: ['wght'],
    variants: [
      {
        wght: 400,
      },
      {
        wght: 500,
      },
      {
        wght: 600,
      },
      {
        wght: 700,
      },
      {
        wght: 900,
      },
    ],
  },
];

export const systemFonts = fontMap
  .filter((font) => font.system)
  .map((font) => font.family);
