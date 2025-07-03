// Export all svgs documented at https://shopify.dev/docs/api/liquid/filters/placeholder_svg_tag

interface SvgImage {
  src: string;
}

const svgs: Record<string, SvgImage | string | undefined> = {
  image: {
    src: 'https://cdn.swell.store/schema/685ef58ab79e3e0012cf3253/79fe22ba0c0881be2fbd5d5b51861d82/image.png',
  },
  'product-1': {
    src: 'https://cdn.swell.store/schema/685ef58cb79e3e0012cf3260/fd636e87f58fa4313e1d70d0a3dd6662/product-1.png',
  },
  'product-2': {
    src: 'https://cdn.swell.store/schema/685ef58cb79e3e0012cf3267/318f4f837862aae26cb1cb329a864872/product-2.png',
  },
  'product-3': {
    src: 'https://cdn.swell.store/schema/685ef58db79e3e0012cf326a/6337ef0ed2126cf696263f43b5b57bb9/product-3.png',
  },
  'product-4': {
    src: 'https://cdn.swell.store/schema/685ef58db79e3e0012cf326d/8c52d4e48500e2ae9506de6513222415/product-4.png',
  },
  'product-5': {
    src: 'https://cdn.swell.store/schema/685ef58db79e3e0012cf3270/566583407481d7e8e69c2e35d5da33c7/product-5.png',
  },
  'product-6': {
    src: 'https://cdn.swell.store/schema/685ef58db79e3e0012cf3273/0c3b3349d195386674958e0e60ac87d7/product-6.png',
  },
  'collection-1': {
    src: 'https://cdn.swell.store/schema/685ef580b79e3e0012cf320f/0d5d4baa5c890d87bcc356958459f1f6/collection-1.png',
  },
  'collection-2': {
    src: 'https://cdn.swell.store/schema/685ef580b79e3e0012cf3216/1b976d3a480f06c2ebf3a4606da8d015/collection-2.png',
  },
  'collection-3': {
    src: 'https://cdn.swell.store/schema/685ef580b79e3e0012cf3219/69efc2130f37ba4965e3355ec3c131ba/collection-3.png',
  },
  'collection-4': {
    src: 'https://cdn.swell.store/schema/685ef581b79e3e0012cf321c/1cee5756d424e0a79bca3a3f8f33f24e/collection-4.png',
  },
  'collection-5': {
    src: 'https://cdn.swell.store/schema/685ef581b79e3e0012cf321f/b802f4b9521281160df2d17bbecf40d7/collection-5.png',
  },
  'collection-6': {
    src: 'https://cdn.swell.store/schema/685ef581b79e3e0012cf3222/fba884c7fe8122c472e130355fb52db7/collection-6.png',
  },
  'lifestyle-1': {
    src: 'https://cdn.swell.store/schema/685ef58bb79e3e0012cf3256/1da0da57ea80d90038fcf6b100a16fe6/lifestyle-1.png',
  },
  'lifestyle-2': {
    src: 'https://cdn.swell.store/schema/685ef58cb79e3e0012cf3259/f963448f1a6f4d6588fcd283b5c00c7c/lifestyle-2.png',
  },
  'product-apparel-1': {
    src: 'https://cdn.swell.store/schema/685ef58eb79e3e0012cf3276/37c3c973a01287a580ab9db2e05dd36d/product-apparel-1.png',
  },
  'product-apparel-2': {
    src: 'https://cdn.swell.store/schema/685ef58eb79e3e0012cf3280/2a4dce99e9af0730afdfd6c3465c4487/product-apparel-2.png',
  },
  'product-apparel-3': {
    src: 'https://cdn.swell.store/schema/685ef58fb79e3e0012cf3283/b96835507260828b6b744a05c1e1b92c/product-apparel-3.png',
  },
  'product-apparel-4': {
    src: 'https://cdn.swell.store/schema/685ef58fb79e3e0012cf3286/e8efc104bd3e813ca00847ab243852f2/product-apparel-4.png',
  },
  'collection-apparel-1': {
    src: 'https://cdn.swell.store/schema/685ef582b79e3e0012cf322c/9cecfb1b5f6a22a1a7432f7b2bb93cf6/collection-apparel-1.png',
  },
  'collection-apparel-2': {
    src: 'https://cdn.swell.store/schema/685ef584b79e3e0012cf322f/6b191f029e811c69eff721d1da07fabc/collection-apparel-2.png',
  },
  'collection-apparel-3': {
    src: 'https://cdn.swell.store/schema/685ef585b79e3e0012cf3234/98ca327590d41a9b81fce28eae8593ba/collection-apparel-3.png',
  },
  'collection-apparel-4': {
    src: 'https://cdn.swell.store/schema/685ef585b79e3e0012cf3237/e559f1d5a48b5ff04a47fab387c57b2d/collection-apparel-4.png',
  },
  'hero-apparel-1': {
    src: 'https://cdn.swell.store/schema/685ef587b79e3e0012cf3247/ef96bbd7b852a2641fbca87bbeca63de/hero-apparel-1.png',
  },
  'hero-apparel-2': {
    src: 'https://cdn.swell.store/schema/685ef588b79e3e0012cf324b/660460dd8576215ccd55c85c975b3c37/hero-apparel-2.png',
  },
  'hero-apparel-3': {
    src: 'https://cdn.swell.store/schema/685ef58ab79e3e0012cf3250/431a7970525bf3b5d6ab54243cd77f78/hero-apparel-3.png',
  },
  'blog-apparel-1': {
    src: 'https://cdn.swell.store/schema/685ef57db79e3e0012cf3202/bd81d93a97554b06c9e74ff2e74e3339/blog-apparel-1.png',
  },
  'blog-apparel-2': {
    src: 'https://cdn.swell.store/schema/685ef57eb79e3e0012cf3207/d2cf238c341d9302966123c52c746b34/blog-apparel-2.png',
  },
  'blog-apparel-3': {
    src: 'https://cdn.swell.store/schema/685ef57fb79e3e0012cf320c/4665a3df383e06552307b57e432458b7/blog-apparel-3.png',
  },
  'detailed-apparel-1': {
    src: 'https://cdn.swell.store/schema/685ef586b79e3e0012cf3241/47d7848d3e50d094cc9cd5e16aa543f2/detailed-apparel-1.png',
  },
};

export default svgs;
