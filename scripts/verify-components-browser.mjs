import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const dist = resolve('dist');
const listen = server => new Promise(done => server.listen(0, () => done(server.address().port)));
const json = (res, body, headers = {}) => res.writeHead(200, { 'Content-Type': 'application/json', ...headers }).end(JSON.stringify(body));

async function sendDist(res, pathname) {
  const file = resolve(dist, `.${pathname.replace(/^\/dist/, '')}`);
  if (!file.startsWith(`${dist}/`) || extname(file) !== '.js') return res.writeHead(404).end();
  try {
    res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}

const HOST_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Host</title></head>
<body style="margin:0">
<div id="wrapper" style="padding:40px"><input id="before"><div id="slot"></div><input id="after"></div>
<div style="height:2000px"></div>
<script type="module">
  import { createComponents } from '/dist/components.js';
  const components = createComponents({
    storeId: 'demo', publicKey: 'pk_test', url: location.origin,
    getToken: async () => ({ token: 'tok-1', expires: Date.now() / 1000 + 600 }),
  });
  window.events = [];
  window.handle = components.mount('#slot', { app: 'demo', component: 'Echo', value: 'a', context: { id: 'r1' } });
  handle.on('change', value => events.push(['change', value]));
  handle.on('validity', error => events.push(['validity', error]));
  await handle.ready;
  window.mounted = true;
</script>
</body></html>`;

// A field inside a fixed, scrolling modal, like the admin's collection row editor, with a lookup list of the
// modal (#menu) open over the component's top-left corner.
const MODAL_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Modal host</title></head>
<body style="margin:0">
<div id="modal" style="position:fixed;top:100px;left:100px;width:600px;height:400px;z-index:99999;overflow-y:scroll;background:#fff">
  <div style="height:150px"></div><div id="slot"></div><div style="height:2000px"></div>
  <div id="menu" style="position:absolute;z-index:10;left:20px;top:140px;width:200px;height:40px;background:#eee">menu</div>
</div>
<script type="module">
  import { createComponents } from '/dist/components.js';
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
  window.handle = components.mount('#slot', { app: 'demo', component: 'Paragraphs' });
  await handle.ready;
  window.mounted = true;
</script>
</body></html>`;

// Components in a row between two host inputs; ?slots=A,B picks them.
const FOCUS_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Focus host</title></head>
<body style="margin:0">
<input id="pre"><div id="slots"></div><input id="post">
<script type="module">
  import { createComponents } from '/dist/components.js';
  const query = new URLSearchParams(location.search);
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
  const handles = [];
  window.handles = handles;
  window.errors = [];
  for (const name of query.get('slots').split(',')) {
    const slot = document.createElement('div');
    document.getElementById('slots').appendChild(slot);
    const handle = components.mount(slot, { app: 'demo', component: name });
    handle.on('error', error => errors.push(error.message));
    handles.push(handle);
  }
  // ?ready=0: a component that never starts is mounted too, so the page does not wait for it
  if (query.get('ready') !== '0') await Promise.all(handles.map(handle => handle.ready));
  window.mounted = true;
</script>
</body></html>`;

// The component sits in a short, clipping, translucent and transformed container, like an admin modal while it
// animates in: its overlay must still cover the whole viewport at full opacity
const CONFINED_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Confined host</title></head>
<body style="margin:0"><input id="pre">
<div id="confine" style="transform:translateX(5px);opacity:.4;overflow:hidden;height:60px;position:relative;z-index:1"><div id="slot"></div></div>
<input id="post">
<script type="module">
  import { createComponents } from '/dist/components.js';
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
  await components.mount('#slot', { app: 'demo', component: 'Echo', value: 'a', context: { id: 'r1' } }).ready;
  window.mounted = true;
</script>
</body></html>`;

const ECHO_BUNDLE = `
export function mount(root, props) {
  root.innerHTML = '<input id="value"><span id="info"></span><div id="grow"></div><button id="modal">modal</button>';
  const input = root.querySelector('#value');
  input.addEventListener('input', () => props.setValue(input.value));
  root.querySelector('#modal').addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.id = 'overlay';
    Object.assign(modal.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.5)' });
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
  });
  props.on('ping', n => n * 2);
  update(root, props);
}
export function update(root, props) {
  window.__props = props;
  root.querySelector('#value').value = String(props.value);
  root.querySelector('#info').textContent = props.context.id + '|' + props.settings.color + '|' + props.readonly;
}
export function unmount(root) { root.innerHTML = ''; }
`;

const PARAGRAPHS_BUNDLE = `
export function mount(root) { root.innerHTML = '<p>Hello</p><p id="last">World</p>'; }
export function update() {}
export function unmount(root) { root.innerHTML = ''; }
`;
const mod = (html, extra = '') => `export function mount(root) { root.innerHTML = ${JSON.stringify(html)}; ${extra} } export function update() {} export function unmount(root) { root.innerHTML = ''; }`;
// A body-level modal without a focus trap of its own, like an SDK's popup
const openModal = html => `window.openModal = () => { const modal = document.createElement('div'); modal.id = 'overlay'; Object.assign(modal.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.5)' }); modal.innerHTML = ${JSON.stringify(html)}; document.body.appendChild(modal); modal.querySelector('#m1').focus(); };`;
// Modals that do not focus anything themselves: a wrapper with buttons, and a vendor frame appended without a wrapper
const openQuietModal = html => `window.openModal = () => { const modal = document.createElement('div'); modal.id = 'overlay'; Object.assign(modal.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.5)' }); modal.innerHTML = ${JSON.stringify(html)}; document.body.appendChild(modal); };`;
const openBareFrame = "window.openModal = () => { const frame = document.createElement('iframe'); frame.id = 'bare'; frame.srcdoc = '<input id=otp>'; Object.assign(frame.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', border: '0' }); document.body.appendChild(frame); };";
// A 3DS challenge: the payment SDK's modal holds the bank's page in a nested frame
const TDS = '<iframe id="tds" srcdoc="<input id=otp>" style="height:40px"></iframe>';
const FOCUS_BUNDLES = {
  Two: mod('<input id="x"><input id="y">'),
  Modal: mod('<input id="x">', openModal('<button id="m1">One</button><button id="m2">Two</button>')),
  Modal3ds: mod('<input id="x">', openModal(`${TDS}<button id="m1">Cancel</button>`)),
  Modal3dsLast: mod('<input id="x">', openModal(`<button id="m1">Cancel</button>${TDS}`)),
  ModalQuiet: mod('<button id="pay">Pay</button>', openQuietModal('<button id="m1">One</button><button id="m2">Two</button>')),
  ModalFrame: mod('<input id="x">', openBareFrame),
  // Mounts, then throws on every update: the frame reports an error after ready
  Throws: mod('<input id="x"><input id="y">').replace('export function update() {}', "export function update() { throw new Error('update failed'); }"),
};
const BUNDLES = { Echo: ECHO_BUNDLE, Paragraphs: PARAGRAPHS_BUNDLE, ...FOCUS_BUNDLES };

let frameOrigin = '';
const hostServer = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://host');
  if (pathname === '/') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(HOST_PAGE);
  if (pathname === '/focus') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(FOCUS_PAGE);
  if (pathname === '/modal') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(MODAL_PAGE);
  if (pathname === '/confined') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(CONFINED_PAGE);
  if (pathname.startsWith('/dist/')) return sendDist(res, pathname);
  if (pathname === '/api/apps/demo/components') {
    if (req.headers.authorization !== `Basic ${Buffer.from('pk_test').toString('base64')}`) return res.writeHead(401).end();
    const components = Object.keys(BUNDLES).map(name => ({ name, src: `${frameOrigin}/.swell/components/${name}?v=1` }));
    // A frame URL that answers with an error page: the frame never starts
    return json(res, { settings: { color: 'red' }, components: [...components, { name: 'Missing', src: `${frameOrigin}/missing` }] });
  }
  if (pathname === '/cors-echo') {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (req.method === 'OPTIONS') return res.writeHead(204, headers).end();
    return json(res, { token: req.headers['swell-component-token'] ?? null }, headers);
  }
  res.writeHead(404).end();
});
const frameServer = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://frame');
  // As the platform answers on an app origin: the SDK's shell page, the bundle URL next to it, and the SDK runtime
  const name = /^\/\.swell\/components\/(\w+)(\.json)?$/.exec(pathname);
  if (name?.[2]) return Object.hasOwn(BUNDLES, name[1]) ? json(res, { bundleUrl: `/bundle/${name[1]}.js` }) : res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"Component not found"}');
  if (name) return res.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(resolve(dist, 'component-frame.html')));
  if (pathname.startsWith('/.swell/sdk/')) return sendDist(res, pathname.replace('/.swell/sdk/', '/dist/'));
  if (pathname.startsWith('/dist/')) return sendDist(res, pathname);
  const bundle = /^\/bundle\/(\w+)\.js$/.exec(pathname)?.[1];
  if (Object.hasOwn(BUNDLES, bundle ?? '')) return res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(BUNDLES[bundle]);
  if (pathname === '/echo') return json(res, { token: req.headers['swell-component-token'] ?? null });
  res.writeHead(404, { 'Content-Type': 'text/html' }).end('<!doctype html><p>Not found</p>');
});

// Real Tab and Shift+Tab, one browser page at a time. Focus is named as: a host element id, or iframeN:<element>
// where <element> is an id in the component frame, tds>otp inside a nested frame, BODY when nothing has focus.
const T = 'Tab';
const S = 'Shift+Tab';
const FOCUS_CASES = [
  ['before -> x -> y -> after and back', 'slots=Two', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'post'], [S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'pre']]],
  ['a component whose frame never starts is no Tab stop', 'slots=Missing&ready=0', '#pre', [[T, 'post'], [S, 'pre']]],
  // An error after the component rendered (its update threw) leaves it in the Tab order
  ['a component that reported an error after ready is still a Tab stop', 'slots=Throws', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'post'], [S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'pre']], async (focusPage) => {
    await focusPage.evaluate(() => handles[0].update({ value: 'z' }));
    await focusPage.waitForFunction(() => errors.length > 0);
  }],
];

// Cases run one after another and report their failures together at the end
const failures = [];
async function attempt(run) {
  try {
    await run();
  } catch (error) {
    failures.push(error.message.split('\n')[0]);
  }
}

async function focusCases() {
  for (const [name, query, start, steps, before] of FOCUS_CASES) await attempt(() => focusCase(name, query, start, steps, before));
  // The host page is inert during overlay, so Tab past the modal's last control leaves the page (BODY here, the
  // browser's own controls in a window) and comes back to its first, like a native modal dialog. Focus never
  // reaches the component's own field under the backdrop or a host control.
  const wrapTo = stop => ({ only: ['BODY', stop] });
  await attempt(() => focusCase('a modal without a focus trap keeps Tab inside it', 'slots=Modal', null, [[T, 'iframe0:m2'], [T, 'iframe0:m1', wrapTo('iframe0:m1')], [T, 'iframe0:m2'], [S, 'iframe0:m1'], [S, 'iframe0:m2', wrapTo('iframe0:m2')]], openComponentModal, 'iframe0:m1'));
  // A 3DS modal: Tab and Shift+Tab cycle between its button and the bank's frame (Chromium stops on that frame's
  // document first going forwards), never reaching the component's own field under the backdrop or a host control
  const challenge = ['BODY', 'iframe0:m1', 'iframe0:tds>otp', 'iframe0:tds>BODY'];
  const cycle = [T, S, S, T].map(key => [key, 'iframe0:m1', { via: ['iframe0:tds>otp'], only: challenge }]);
  await attempt(() => focusCase('a modal with a nested frame first keeps Tab and Shift+Tab inside it', 'slots=Modal3ds', null, cycle, openComponentModal, 'iframe0:m1'));
  await attempt(() => focusCase('a modal with a nested frame last keeps Tab and Shift+Tab inside it', 'slots=Modal3dsLast', null, cycle, openComponentModal, 'iframe0:m1'));
  // The shopper clicks straight into the bank's field from the host page: the component frame itself never had focus
  const clickChallenge = async (focusPage) => {
    await openComponentModal(focusPage);
    await focusPage.locator('#pre').focus();
    await focusPage.frames().find(item => item.url().startsWith(frameOrigin)).frameLocator('#tds').locator('#otp').click();
  };
  await attempt(() => focusCase('Shift+Tab after a click into a modal\'s nested frame stays in the modal', 'slots=Modal3ds', null, [[S, 'iframe0:m1', { only: challenge, repeat: ['BODY'] }], [S, 'iframe0:tds>otp', { only: challenge }]], clickChallenge, 'iframe0:tds>otp'));
  await attempt(() => focusCase('Tab after a click into a modal\'s nested frame stays in the modal', 'slots=Modal3dsLast', null, [[T, 'iframe0:m1', { only: challenge, repeat: ['BODY'] }], [T, 'iframe0:tds>otp', { only: challenge }]], clickChallenge, 'iframe0:tds>otp'));
  // A modal that focuses nothing itself takes focus: from the component's own button, and from the host page when
  // the modal is a vendor frame without a wrapper
  await attempt(async () => {
    const page = await openFocusPage('slots=ModalQuiet', null);
    try {
      const frame = page.frames().find(item => item.url().startsWith(frameOrigin));
      await frame.locator('#pay').focus();
      await frame.evaluate(() => openModal());
      await waitForFocus(page, name => name === 'iframe0:m1', 'a modal opened from the component');
    } finally {
      await page.close();
    }
  });
  await attempt(async () => {
    const page = await openFocusPage('slots=ModalFrame', '#pre');
    try {
      const frame = page.frames().find(item => item.url().startsWith(frameOrigin));
      await frame.evaluate(() => openModal());
      await waitForFocus(page, name => name.startsWith('iframe0:bare>'), 'a bare vendor frame opened while the host page had focus');
    } finally {
      await page.close();
    }
  });
  // During overlay the host page is inert: its inputs cannot take focus, which stays in the modal
  await attempt(async () => {
    const page = await openFocusPage('slots=Modal', null);
    try {
      await openComponentModal(page);
      for (const start of ['#pre', '#post']) await page.evaluate(id => document.getElementById(id).focus(), start.slice(1));
      const got = await whereIs(page);
      assert.equal(got, 'iframe0:m1', `focusing the host page during overlay moved focus to ${got}`);
      assert.deepEqual(await page.evaluate(() => ['pre', 'post'].map(id => document.getElementById(id).closest('[inert]') !== null)), [true, true]);
    } finally {
      await page.close();
    }
  });
}

// Opens the component's modal (focus goes to its #m1) and waits for overlay and for any nested frame in it to load
async function openComponentModal(focusPage) {
  const frame = focusPage.frames().find(item => item.url().startsWith(frameOrigin));
  await frame.evaluate(() => openModal());
  await focusPage.waitForFunction(() => document.querySelector('iframe').matches(':popover-open'));
  await frame.waitForFunction(() => [...document.querySelectorAll('#overlay iframe')].every(nested => nested.contentDocument?.querySelector('input')));
}

async function openFocusPage(query, start) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', error => pageErrors.push(error));
  await page.goto(`${hostOrigin}/focus?${query}`);
  await page.waitForFunction(() => window.mounted === true, null, { timeout: 15000 });
  if (query.includes('ready=0')) {
    await page.waitForFunction(() => document.querySelector('iframe'));
    await page.frames().find(item => item.url().startsWith(frameOrigin))?.waitForLoadState('load');
  } else {
    await page.waitForFunction(() => [...document.querySelectorAll('#slots > div')].every(slot => slot.getBoundingClientRect().height > 0));
  }
  if (start) await page.locator(start).focus();
  return page;
}

async function whereIs(page) {
  const active = await page.evaluateHandle(() => document.activeElement);
  const element = active.asElement();
  const index = await page.evaluate(el => (el.tagName === 'IFRAME' ? [...document.querySelectorAll('iframe')].indexOf(el) : -1), element);
  if (index < 0) return page.evaluate(el => el.id || el.tagName, element);
  const owner = await element.contentFrame();
  if (!owner) return `iframe${index}:?`;
  return `iframe${index}:${await owner.evaluate(() => {
    const name = el => el?.id || el?.tagName;
    const active = document.activeElement;
    if (active?.tagName === 'IFRAME') return `${name(active)}>${name(active.contentDocument.activeElement)}`;
    return name(active);
  })}`;
}

async function waitForFocus(page, accept, label) {
  const deadline = Date.now() + 3000;
  let got = await whereIs(page);
  while (!accept(got) && Date.now() < deadline) {
    await page.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => resolve(true))));
    got = await whereIs(page);
  }
  assert.ok(accept(got), `${label}: focus is on ${got}`);
  return got;
}

async function focusCase(name, query, start, steps, before, initial) {
  const page = await openFocusPage(query, start);
  try {
    if (before) await before(page);
    if (initial) assert.equal(await whereIs(page), initial, `${name}: start`);
    const seen = [];
    for (const [key, expected, walk] of steps) {
      if (walk) {
        // Press until the target is reached; no stop may repeat (a trap) except those in `repeat` (the page outside the
        // browser's own controls), the controls in `via` must be visited on the way in that order, and with `only` no
        // other stop may be visited
        const path = [];
        for (let press = 0; press < 5 && path.at(-1) !== expected; press++) {
          await page.keyboard.press(key);
          await page.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(() => resolve(true), 50))));
          path.push(await whereIs(page));
        }
        const via = walk.via ?? [];
        const order = via.map(stop => path.indexOf(stop));
        const visited = order.every((index, at) => index >= 0 && (at === 0 || index > order[at - 1]));
        const inside = !walk.only || path.every(stop => walk.only.includes(stop));
        assert.ok(path.at(-1) === expected && new Set(path.filter(stop => !(walk.repeat ?? []).includes(stop))).size === path.filter(stop => !(walk.repeat ?? []).includes(stop)).length && visited && inside, `${name}: ${key} path ${path.join(' > ')} should visit ${via.join(', ') || 'anything'}${walk.only ? ` within ${walk.only.join(', ')}` : ''} and reach ${expected}`);
        seen.push(...path);
        continue;
      }
      await page.keyboard.press(key);
      seen.push(await waitForFocus(page, found => found === expected, `${name}: ${key} after [${seen.join(', ')}] should reach ${expected}`));
    }
  } finally {
    await page.close();
  }
}

// Two animation frames: scrolling and layout have settled
async function settled(page) {
  await page.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
}

async function confinedOverlayCase() {
  // A component confined by a short, clipping, translucent, transformed container still covers the whole viewport
  // at full opacity while its modal is open, and the page under it is inert
  await attempt(async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.on('pageerror', error => pageErrors.push(error));
    try {
      await page.goto(`${hostOrigin}/confined`);
      await page.waitForFunction(() => window.mounted === true, null, { timeout: 15000 });
      const frame = page.frames().find(item => item.url().startsWith(frameOrigin));
      await frame.locator('#modal').click();
      await page.waitForFunction(() => document.querySelector('iframe').matches(':popover-open'));
      await settled(page);
      const cover = await page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        const box = iframe.getBoundingClientRect();
        return {
          box: [box.left, box.top, box.width, box.height].map(Math.round),
          viewport: [0, 0, innerWidth, innerHeight],
          onTop: document.elementFromPoint(innerWidth / 2, innerHeight - 5) === iframe,
          inert: ['pre', 'post'].map(id => document.getElementById(id).closest('[inert]') !== null),
        };
      });
      assert.deepEqual(cover.box, cover.viewport, `confined overlay does not cover the viewport: ${JSON.stringify(cover)}`);
      assert.deepEqual([cover.onTop, ...cover.inert], [true, true, true], `confined overlay: ${JSON.stringify(cover)}`);
      // Full opacity: the overlay looks the same whether the container is at opacity .4 or 1
      const clip = { x: 300, y: 300, width: 400, height: 300 };
      const faded = await page.screenshot({ clip });
      await page.evaluate(() => { document.querySelector('#confine').style.opacity = '1'; });
      await settled(page);
      const opaque = await page.screenshot({ clip });
      assert.ok(faded.equals(opaque), 'confined overlay is faded by the container\'s opacity');
      await frame.locator('#overlay').click();
      await page.waitForFunction(() => !document.querySelector('iframe').matches(':popover-open') && document.querySelectorAll('[inert]').length === 0);
    } finally {
      await page.close();
    }
  });
}

const hostOrigin = `http://localhost:${await listen(hostServer)}`;
frameOrigin = `http://127.0.0.1:${await listen(frameServer)}`;
const browser = await chromium.launch();
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', error => pageErrors.push(error));
  await page.goto(`${hostOrigin}/`);
  await page.waitForFunction(() => window.mounted === true, null, { timeout: 15000 });
  const frame = page.frames().find(item => item.url().startsWith(frameOrigin));
  assert.ok(frame, 'component frame not found');

  // The frame lives in the placeholder, without a sandbox.
  assert.equal(await page.evaluate(() => document.querySelector('iframe').parentElement === document.querySelector('#slot')), true);
  assert.equal(await page.evaluate(() => document.querySelector('iframe').hasAttribute('sandbox')), false);

  // Initial props reach the component.
  assert.equal(await frame.locator('#info').textContent(), 'r1|red|false');
  assert.equal(await frame.locator('#value').inputValue(), 'a');

  // setValue reaches the host; handle.update reaches the component.
  await frame.locator('#value').fill('abc');
  await page.waitForFunction(() => events.some(([type, value]) => type === 'change' && value === 'abc'));
  await page.evaluate(() => handle.update({ value: 'z', readonly: true }));
  await frame.waitForFunction(() => document.querySelector('#info').textContent === 'r1|red|true' && document.querySelector('#value').value === 'z');

  // emit resolves with the component handler's result.
  assert.equal(await page.evaluate(() => handle.emit('ping', 21)), 42);

  await focusCases();
  await confinedOverlayCase();
  assert.deepEqual(failures, [], `failures:\n${failures.join('\n')}`);

  // The token goes to the frame origin only.
  assert.deepEqual(await frame.evaluate(() => __props.fetch('/echo').then(response => response.json())), { token: 'tok-1' });
  assert.deepEqual(await frame.evaluate(url => __props.fetch(url).then(response => response.json()), `${hostOrigin}/cors-echo`), { token: null });

  // The placeholder follows the component height.
  await frame.evaluate(() => { document.querySelector('#grow').style.height = '300px'; });
  await page.waitForFunction(() => document.querySelector('#slot').getBoundingClientRect().height >= 300);

  // A modal inside the frame turns overlay on and off: the frame goes to the top layer, the rest of the page is
  // inert and does not scroll, and all of it comes back after.
  await frame.locator('#modal').click();
  await page.waitForFunction(() => document.querySelector('iframe').matches(':popover-open') && document.documentElement.style.overflow === 'hidden');
  assert.deepEqual(await page.evaluate(() => ['before', 'after'].map(id => document.getElementById(id).closest('[inert]') !== null)), [true, true]);
  await frame.locator('#overlay').click();
  await page.waitForFunction(() => !document.querySelector('iframe').matches(':popover-open') && document.documentElement.style.overflow === '');
  assert.equal(await page.evaluate(() => document.querySelectorAll('[inert]').length), 0);

  // A forged message from the host page itself is ignored.
  await page.evaluate(() => {
    const channel = new URL(document.querySelector('iframe').src).searchParams.get('channel');
    window.postMessage({ $swell: 'swell:component', v: 1, channel, type: 'change', value: 'forged' }, '*');
  });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => events.some(([, value]) => value === 'forged')), false);

  // Inside a fixed, scrolling modal the frame is a plain part of it: the modal's own popover paints over it, the
  // scroller clips it and a sticky header stays above it, with no host markup for any of that.
  const modalPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  modalPage.on('pageerror', error => pageErrors.push(error));
  await modalPage.goto(`${hostOrigin}/modal`);
  await modalPage.waitForFunction(() => window.mounted === true && parseFloat(document.querySelector('#slot').style.height) > 0, null, { timeout: 15000 });

  // The frame height includes the paragraphs' margins, so both show without an inner scroll.
  const paragraphs = modalPage.frames().find(item => item.url().startsWith(frameOrigin));
  const fit = await paragraphs.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight,
    lastBottom: document.querySelector('#last').getBoundingClientRect().bottom, innerHeight,
  }));
  assert.ok(fit.scrollHeight <= fit.clientHeight && fit.lastBottom <= fit.innerHeight, `the component is cut off: ${JSON.stringify(fit)}`);
  const stacking = await modalPage.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const slot = document.querySelector('#slot').getBoundingClientRect();
    const menu = document.querySelector('#menu').getBoundingClientRect();
    return {
      component: document.elementFromPoint(slot.right - 20, slot.top + slot.height / 2) === iframe,
      // Where the modal's popover overlaps the component, the popover is on top
      overlap: menu.bottom > slot.top,
      menu: document.elementFromPoint(menu.left + menu.width / 2, (Math.max(menu.top, slot.top) + menu.bottom) / 2)?.id,
    };
  });
  assert.deepEqual(stacking, { component: true, overlap: true, menu: 'menu' }, `the modal's popover is not above the component: ${JSON.stringify(stacking)}`);
  await modalPage.evaluate(() => {
    const modal = document.querySelector('#modal');
    const slot = document.querySelector('#slot');
    modal.scrollTop = slot.getBoundingClientRect().top - modal.getBoundingClientRect().top + slot.offsetHeight / 2;
  });
  await settled(modalPage);
  const clipped = await modalPage.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const box = iframe.getBoundingClientRect();
    const modal = document.querySelector('#modal').getBoundingClientRect();
    const hit = y => document.elementFromPoint(box.right - 20, y) === iframe;
    return { straddles: box.top < modal.top && box.bottom > modal.top, above: hit(modal.top - 5), inside: hit(modal.top + 5) };
  });
  assert.deepEqual(clipped, { straddles: true, above: false, inside: true }, `the scroller does not clip the component: ${JSON.stringify(clipped)}`);

  // The component sits partly under the sticky header, which stays on top of it.
  await modalPage.evaluate(() => {
    const modal = document.querySelector('#modal');
    const slot = document.querySelector('#slot');
    const header = document.createElement('div');
    header.id = 'bar';
    header.style.cssText = 'position:sticky;top:0;height:60px;background:#ccc';
    modal.prepend(header);
    const bar = header.getBoundingClientRect();
    modal.scrollTop += slot.getBoundingClientRect().top - bar.bottom + 10;
  });
  await modalPage.waitForFunction(() => document.querySelector('#slot').getBoundingClientRect().top < document.querySelector('#bar').getBoundingClientRect().bottom - 5);
  const bar = await modalPage.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const header = document.querySelector('#bar').getBoundingClientRect();
    const slot = document.querySelector('#slot').getBoundingClientRect();
    const x = slot.right - 20;
    const at = y => document.elementFromPoint(x, y);
    return { onHeader: at(header.bottom - 3) === document.querySelector('#bar'), onFrame: at(header.bottom + 3) === iframe, slotTop: slot.top, headerBottom: header.bottom };
  });
  assert.deepEqual([bar.onHeader, bar.onFrame], [true, true], `the sticky header does not stay above the component: ${JSON.stringify(bar)}`);

  assert.deepEqual(pageErrors, []);
} finally {
  await browser.close();
  hostServer.close();
  frameServer.close();
}
console.log('Components verified in Chromium across origins');
