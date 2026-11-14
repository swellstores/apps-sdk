import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { BLOCK_LIMITS, appFrontendOrigin, blockAllowedOn, blockCspSources, hasScriptBlocks, isComponentBlock, readAppBlocks, readInstalledBlocks, startBlockRegistry } from '../dist/blocks.js';
import { startComponentBlocks } from '../dist/components-blocks.js';

const STORE = 'swell-apps';
const INSTALL = '6af7ca9ff010af00114f411d';
const APP_ID = '6af7ca9ff010af00114f4119';
const ORIGIN = `https://${STORE}--${INSTALL}--app.swell.store`;
const INTEGRITY = `sha384-${'A'.repeat(64)}`;
const origin = (id) => appFrontendOrigin('https://swell-apps.swell.store/admin', STORE, id);

// An installation as GET /:clients/:self/apps?expand=app answers it
const installation = (embeds, over = {}) => ({
  id: INSTALL, app_id: APP_ID, app_private_id: '_block_demo', active: true,
  app: { name: 'Block Demo', storefront: { embeds }, logo_icon: { url: 'https://cdn.swell.store/swell-apps/icon.png' } },
  ...over,
});
const DEMO = {
  version: 1,
  script: 'frontend://embed.js?v=20273dda67cd',
  integrity: INTEGRITY,
  blocks: [
    { id: 'banner', label: 'Demo banner', props: [{ id: 'message', type: 'text', label: 'Message', default: 'Hello' }] },
    { id: 'card', label: 'Demo card', render: 'component', component: 'Card', pages: ['home', 'content'] },
  ],
};

test('readInstalledBlocks reads an installed app: its script on its installation origin, its component blocks framed there', () => {
  const problems = [];
  const apps = readInstalledBlocks({ results: [installation(DEMO)] }, { origin, onProblem: (m) => problems.push(m) });
  assert.deepEqual(problems, []);
  assert.deepEqual(apps, [{
    app: 'block_demo', name: 'Block Demo',
    script: `${ORIGIN}/embed.js?v=20273dda67cd`, integrity: INTEGRITY, connect: [], img: [],
    blocks: [
      { id: 'banner', label: 'Demo banner', props: [{ id: 'message', type: 'text', label: 'Message', default: 'Hello' }] },
      { id: 'card', label: 'Demo card', pages: ['home', 'content'], component: 'Card' },
    ],
    frame: ORIGIN, appId: APP_ID, icon: 'https://cdn.swell.store/swell-apps/icon.png',
  }]);
  assert.equal(hasScriptBlocks(apps[0]), true);
  assert.deepEqual(apps[0].blocks.map(isComponentBlock), [false, true]);
});

test('readInstalledBlocks skips uninstalled, inactive and undeclared installations, and leaves a broken declaration out whole', () => {
  const problems = [];
  const apps = readInstalledBlocks({ results: [
    installation(DEMO, { uninstalled: true }),
    installation(DEMO, { active: false }),
    installation(undefined),
    installation({ ...DEMO, blocks: [...DEMO.blocks, { id: 'x', label: 'X', extra: 1 }] }),
    installation({ ...DEMO, script: 'https://elsewhere.test/embed.js' }),
    installation({ ...DEMO, colour: 'red' }),
  ] }, { origin, onProblem: (m) => problems.push(m) });
  assert.deepEqual(apps, []);
  assert.deepEqual(problems, [
    'the installed app "block_demo"\'s storefront.embeds (block_demo).blocks[2] must be {id: [a-z0-9_]{1,40}, label, description?, icon?, render?, component?, pages?, props?}; left out',
    'the installed app "block_demo"\'s storefront.embeds.script must be a frontend:// link on the app\'s frontend; left out',
    'the installed app "block_demo"\'s storefront.embeds must be {version?, script?, integrity?, connect?, img?, blocks}; left out',
  ]);
});

test('readInstalledBlocks keeps script blocks of an installation without an app record id, and leaves its component blocks out', () => {
  const problems = [];
  const [app] = readInstalledBlocks({ results: [installation(DEMO, { app_id: undefined })] }, { origin, onProblem: (m) => problems.push(m) });
  assert.deepEqual(app.blocks.map((b) => b.id), ['banner']);
  assert.equal(app.frame, undefined);
  assert.match(problems[0], /blocks card render as components, which only an installed app's declaration can offer; left out$/);
});

test('readInstalledBlocks reads at most BLOCK_LIMITS.apps apps, each app once', () => {
  const problems = [];
  const many = Array.from({ length: BLOCK_LIMITS.apps + 2 }, (_, i) => installation(DEMO, { id: `${i}`.padStart(24, 'a'), app_private_id: `_app_${i}` }));
  assert.equal(readInstalledBlocks({ results: many }, { origin, onProblem: (m) => problems.push(m) }).length, BLOCK_LIMITS.apps);
  assert.match(problems.at(-1), /more than 10 installed apps declare app embeds/);
  const twice = readInstalledBlocks({ results: [installation(DEMO), installation(DEMO, { id: 'b'.repeat(24) })] }, { origin, onProblem: (m) => problems.push(m) });
  assert.equal(twice.length, 1);
  assert.match(problems.at(-1), /\.app block_demo is listed twice; left out$/);
});

test('readAppBlocks refuses each broken rule, naming where', () => {
  const entry = (over) => ({ app: 'demo', name: 'Demo', script: 'https://demo.test/embed.js', blocks: [{ id: 'b', label: 'B' }], ...over });
  const problem = (over) => {
    const r = readAppBlocks(entry(over), { at: 'x' });
    assert.equal(r.ok, false);
    return r.problem;
  };
  assert.equal(problem({ version: 2 }), 'x.version 2 is not one this storefront reads (1)');
  assert.equal(problem({ app: 'Demo' }), 'x.app must match [a-z0-9_-]{1,40}');
  assert.equal(problem({ script: 'http://demo.test/embed.js' }), 'x (demo).script must be an https URL in normal form');
  assert.equal(problem({ script: 'https://demo.test/a b.js' }), 'x (demo).script must be an https URL in normal form');
  assert.equal(problem({ integrity: 'sha384-short' }), 'x (demo).integrity must be sha256-, sha384- or sha512-<base64>');
  assert.equal(problem({ connect: ['http://api.test'] }), 'x (demo).connect must be a list of at most 10 https origins');
  assert.equal(problem({ blocks: [] }), 'x (demo).blocks must be a non-empty list');
  assert.equal(problem({ script: undefined }), 'x (demo).script is required for its script blocks');
  assert.equal(problem({ blocks: [{ id: 'b', label: 'B', pages: ['checkout'] }] }), 'x (demo).blocks[0] (b).pages must be a non-empty list of home, product, category, category_list, search, cart, content, blog, blog_post, account, not_found, each once');
  assert.equal(problem({ blocks: [{ id: 'b', label: 'B', props: [{ id: 'n', type: 'number', label: 'N', min: 5, max: 1 }] }] }), 'x (demo).blocks[0] (b).props[0] (n).min and max are numbers (min at most max) of a number prop');
  assert.equal(problem({ blocks: [{ id: 'b', label: 'B', props: [{ id: 's', type: 'select', label: 'S', options: [{ value: 'a', label: 'A' }], default: 'z' }] }] }), 'x (demo).blocks[0] (b).props[0] (s).default must be a value of its type');
  assert.equal(problem({ blocks: [{ id: 'b', label: 'B' }, { id: 'b', label: 'Again' }] }), 'x (demo).blocks[1].id b is listed twice');
  assert.equal(problem({ blocks: [{ id: 'b', label: 'B', component: 'Card' }] }), 'x (demo).blocks[0] (b).component names a component (^[A-Za-z0-9_-]{1,64}$) of a block whose render is "component", and only of one');
});

test('readAppBlocks keeps a valid entry: labels cleaned, origins once, select options and number bounds', () => {
  const r = readAppBlocks({
    app: 'demo', name: '  Demo\napp ', script: 'https://demo.test/embed.js?v=1', connect: ['https://api.test', 'https://api.test'], img: ['data:'],
    blocks: [{ id: 'b', label: 'B', props: [
      { id: 'layout', type: 'select', label: 'Layout', default: 'grid', options: [{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }] },
      { id: 'limit', type: 'number', label: 'Limit', min: 1, max: 24, default: 6 },
    ] }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.app.name, 'Demo app');
  assert.deepEqual(r.app.connect, ['https://api.test']);
  assert.deepEqual(r.app.img, ['data:']);
  assert.equal(r.app.blocks[0].props.length, 2);
});

test('appFrontendOrigin is the installation origin on the store\'s domain, and nothing for another host', () => {
  assert.equal(origin(INSTALL), ORIGIN);
  assert.equal(appFrontendOrigin('http://localhost:3000/admin', 'shop', INSTALL), `https://shop--${INSTALL}--app.swell.test`);
  assert.equal(appFrontendOrigin('https://other.swell.store/admin', 'shop', INSTALL), null);
  assert.equal(appFrontendOrigin('https://shop.swell.store/admin', 'shop', 'not-an-id'), null);
  assert.equal(appFrontendOrigin('not a url', 'shop', INSTALL), null);
});

test('blockAllowedOn and blockCspSources', () => {
  assert.equal(blockAllowedOn({}, 'home'), true);
  assert.equal(blockAllowedOn({}, 'account'), false);
  assert.equal(blockAllowedOn({ pages: ['account'] }, 'account'), true);
  assert.equal(blockAllowedOn({ pages: ['product'] }, 'home'), false);
  const [app] = readInstalledBlocks({ results: [installation({ ...DEMO, connect: ['https://api.test'], img: ['data:'] })] }, { origin });
  assert.deepEqual(blockCspSources([app, app], [app]), {
    scriptSrc: [`${ORIGIN}/embed.js`], connectSrc: ['https://api.test'], imgSrc: ['data:'], frameSrc: [ORIGIN],
  });
  assert.deepEqual(blockCspSources([], []), { scriptSrc: [], connectSrc: [], imgSrc: [], frameSrc: [] });
});

// ---- In the page ----

function page(t, html = '') {
  const win = new Window({ url: 'https://shop.test/products/a' });
  t.after(() => win.happyDOM.close());
  win.document.body.innerHTML = html;
  return win;
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const STOREFRONT = { storeId: STORE, storefrontId: 'Wf0afvjR', mode: 'preview' };
const block = (props = '{"message":"Hi"}', id = 'block_demo/banner', attr = 'data-app-block') => `<div class="swell-app-block" ${attr}="${id}" data-app-props='${props}'><p>fallback</p></div>`;

test('the registry takes an app\'s earlier push, mounts its blocks once with their context, and cleans up when they leave', async (t) => {
  const win = page(t, block());
  const calls = [];
  win.SwellAppBlocks = [{ app: 'block_demo', blocks: { banner: { mount(el, context) { calls.push(['mount', el.getAttribute('data-app-block'), context]); return () => calls.push(['cleanup']); } } } }];
  const stop = startBlockRegistry({ apps: ['block_demo'], storefront: STOREFRONT, document: win.document });
  t.after(stop);
  assert.deepEqual(calls, [['mount', 'block_demo/banner', { props: { message: 'Hi' }, app: 'block_demo', block: 'banner', storefront: STOREFRONT, proxy: '/.swell/apps/block_demo' }]]);
  // a block added later (a cart drawer) mounts; the page scanning again mounts nothing twice
  win.document.body.insertAdjacentHTML('beforeend', block('{"message":"Drawer"}'));
  await flush();
  assert.deepEqual(calls.map((c) => c[0]), ['mount', 'mount']);
  assert.equal(calls[1][2].props.message, 'Drawer');
  win.document.body.firstElementChild.remove();
  await flush();
  assert.deepEqual(calls.map((c) => c[0]), ['mount', 'mount', 'cleanup']);
});

test('the registry mounts a block again when its props change, and ignores apps the page did not load and second registrations', async (t) => {
  const win = page(t, block() + block('{}', 'other/banner'));
  const mounts = [];
  const stop = startBlockRegistry({ apps: ['block_demo'], storefront: STOREFRONT, document: win.document });
  t.after(stop);
  win.SwellAppBlocks.push(
    { app: 'block_demo', blocks: { banner: { mount: (el, c) => { mounts.push(c.props.message); return () => mounts.push('cleanup'); } } } },
    { app: 'block_demo', blocks: { banner: { mount: () => mounts.push('second') } } },
    { app: 'other', blocks: { banner: { mount: () => mounts.push('other') } } },
  );
  assert.deepEqual(mounts, ['Hi']);
  win.document.querySelector('[data-app-block="block_demo/banner"]').setAttribute('data-app-props', '{"message":"Changed"}');
  await flush();
  assert.deepEqual(mounts, ['Hi', 'cleanup', 'Changed']);
  stop();
  assert.deepEqual(mounts, ['Hi', 'cleanup', 'Changed', 'cleanup']);
});

test('the registry reads another id attribute, and skips props that are not a JSON object and mounts that throw', async (t) => {
  const win = page(t, block('{"a":1}', 'block_demo/banner', 'data-app-embed') + block('[1]', 'block_demo/banner', 'data-app-embed') + block('{"b":2}', 'block_demo/boom', 'data-app-embed'));
  const mounts = [];
  const errors = [];
  const original = console.error;
  console.error = (e) => errors.push(String(e));
  t.after(() => { console.error = original; });
  t.after(startBlockRegistry({ apps: ['block_demo'], storefront: STOREFRONT, attribute: 'data-app-embed', document: win.document }));
  win.SwellAppBlocks.push({ app: 'block_demo', blocks: { banner: { mount: (el, c) => mounts.push(c.props) }, boom: { mount: () => { throw new Error('boom'); } } } });
  assert.deepEqual(mounts, [{ a: 1 }]);
  assert.deepEqual(errors, ['Error: boom']);
});

test('startComponentBlocks frames each component block with its props, the storefront and the theme tokens, and unmounts it when it leaves', async (t) => {
  const nativeFetch = globalThis.fetch;
  const lists = [];
  globalThis.fetch = async (url) => {
    lists.push(String(url));
    return Response.json({ settings: {}, components: [{ name: 'Card', src: `${ORIGIN}/.swell/components/Card?v=1` }] });
  };
  t.after(() => { globalThis.fetch = nativeFetch; });
  const win = page(t, `<div style="--swell-color-accent: #b4532a; --swell-radius: 12px">${block('{"title":"Hi"}', 'block_demo/card')}${block('{}', 'block_demo/banner')}</div>`);
  const tokens = [];
  const stop = startComponentBlocks({
    storeId: STORE, publicKey: 'host', url: 'https://shop.test/__site/components',
    getToken: async (app) => { tokens.push(app); return { token: 't', expires: Date.now() / 1000 + 600 }; },
    blocks: { 'block_demo/card': { component: 'Card', title: 'Demo card' } }, storefront: STOREFRONT, document: win.document,
  });
  t.after(stop);
  await flush();
  assert.deepEqual(lists, ['https://shop.test/__site/components/api/apps/block_demo/components']);
  const frames = [...win.document.querySelectorAll('iframe')];
  assert.equal(frames.length, 1, 'the script block is left to the registry');
  assert.equal(new URL(frames[0].src).pathname, '/.swell/components/Card');
  assert.equal(frames[0].title, 'Demo card');
  assert.equal(frames[0].closest('.swell-app-frame').parentElement.getAttribute('data-app-block'), 'block_demo/card');
  win.document.querySelector('[data-app-block="block_demo/card"]').remove();
  await flush();
  assert.equal(win.document.querySelectorAll('iframe').length, 0);
});
