import { trimEnd } from 'lodash-es';

import RenderDrop from './liquid/drops/render';
import RobotsRule from './compatibility/drops/robots-rule';
import ShopifyImage from './compatibility/shopify-objects/image';

import type {
  ThemeGlobals,
  SwellData,
  SwellSettingsGeo,
  SwellSettingsGeoState,
} from 'types/swell';

import type { ShopifyRobots } from 'types/shopify';
import type { SwellTheme } from './theme';

async function getFirstFilledValue(values: unknown[]): Promise<unknown> {
  for (const promise of values) {
    const value = await promise;

    if (value) {
      return value;
    }
  }
}

export function getRecordGlobals(
  theme: SwellTheme,
  record: Record<string, unknown>,
): Partial<ThemeGlobals> {
  const globals: Partial<ThemeGlobals> = {};

  globals.handle = new RenderDrop(() => record.slug);

  globals.page_title = new RenderDrop(() =>
    getFirstFilledValue([
      record.meta_title, // filled SEO
      record.name, // all records
      record.title, // content/pages, content/blogs, content/blog-categories
      theme.page?.title, // default page title
      theme.globals.store?.name, // fallback to store name
    ]),
  );

  globals.page_description = new RenderDrop(() =>
    getFirstFilledValue([
      record.meta_description, // filled SEO
      record.description, // product and category
      record.summary, // content/blogs
      theme.page?.description,
    ]),
  );

  globals.page_image = new RenderDrop(() =>
    getFirstFilledValue([
      record.images, // product and category
      record.image, // article
    ]).then((images) => {
      if (typeof images !== 'object' || images === null) {
        return;
      }

      const image: SwellData | undefined = Array.isArray(images)
        ? (images[0] as SwellData | undefined)
        : images;

      return image ? ShopifyImage(image) : undefined;
    }),
  );

  return globals;
}

export const POWERED_BY_LINK =
  '<a target="_blank" rel="nofollow" href="https://www.swell.is/?utm_campaign=poweredby&amp;utm_medium=swell&amp;utm_source=onlinestore">Powered by Swell</a>';

export function getAllCountryOptionTags(geoSettings: SwellSettingsGeo): string {
  if (!geoSettings) {
    return '';
  }

  const stateMap = (geoSettings.states || []).reduce((map, state) => {
    let list = map.get(state.country);

    if (list === undefined) {
      list = [];
      map.set(state.country, list);
    }

    list.push(state);

    return map;
  }, new Map<string, SwellSettingsGeoState[]>());

  return (geoSettings.countries || [])
    .map((country) => {
      if (!country) return '';

      const provinces = (stateMap.get(country.id) || []).map((state) => [
        state.id,
        state.name,
      ]);

      const provincesEncoded = JSON.stringify(provinces).replace(
        /"/g,
        '&quot;',
      );

      return `<option value="${country.id}" data-provinces="${provincesEncoded}">${country.name}</option>`;
    })
    .filter(Boolean)
    .join('\n');
}

export function getRobotsGlobals(canonicalUrl: string): ShopifyRobots {
  const sitemapUrl = `${trimEnd(canonicalUrl, '/')}/sitemap.xml`;

  const defaultRules = [
    { directive: 'Disallow', value: '/admin' },
    { directive: 'Disallow', value: '/cart' },
    { directive: 'Disallow', value: '/account' },
    { directive: 'Disallow', value: '/search' },
    { directive: 'Disallow', value: '/categories/*sort_by*' },
    { directive: 'Disallow', value: '/*/categories/*sort_by*' },
  ];

  return {
    default_groups: [
      {
        user_agent: RobotsRule.from('User-agent', '*'),
        // sitemap: RobotsRule.from('Sitemap', sitemapUrl),
        rules: defaultRules.map((rule) =>
          RobotsRule.from(rule.directive, rule.value),
        ),
      },
      {
        user_agent: RobotsRule.from('User-agent', 'AhrefsBot'),
        // sitemap: RobotsRule.from('Sitemap', sitemapUrl),
        rules: [
          RobotsRule.from('Crawl-delay', '10'),
          ...defaultRules.map((rule) =>
            RobotsRule.from(rule.directive, rule.value),
          ),
        ],
      },
      {
        user_agent: RobotsRule.from('User-agent', 'AhrefsSiteAudit'),
        // sitemap: RobotsRule.from('Sitemap', sitemapUrl),
        rules: [
          RobotsRule.from('Crawl-delay', '10'),
          ...defaultRules.map((rule) =>
            RobotsRule.from(rule.directive, rule.value),
          ),
        ],
      },
      {
        user_agent: RobotsRule.from('User-agent', 'Nutch'),
        rules: [RobotsRule.from('Crawl-delay', '10')],
      },
      {
        user_agent: RobotsRule.from('User-agent', 'MJ12bot'),
        rules: [RobotsRule.from('Crawl-delay', '10')],
      },
      {
        user_agent: RobotsRule.from('User-agent', 'Pinterest'),
        rules: [RobotsRule.from('Crawl-delay', '1')],
      },
    ],
  };
}
