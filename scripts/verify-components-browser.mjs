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

// A field inside a fixed, scrolling modal, like the admin's collection row editor.
const MODAL_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Modal host</title></head>
<body style="margin:0">
<div id="modal" style="position:fixed;top:100px;left:100px;width:600px;height:400px;z-index:99999;overflow-y:scroll;background:#fff">
  <div style="height:150px"></div><div id="slot"></div><div style="height:2000px"></div>
</div>
<script type="module">
  import { createComponents } from '/dist/components.js';
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
  window.handle = components.mount('#slot', { app: 'demo', component: 'Paragraphs' });
  await handle.ready;
  window.mounted = true;
</script>
</body></html>`;

// Components in a row between two host inputs; ?slots=A,B picks them, ?post=0 drops the last input.
const FOCUS_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Focus host</title></head>
<body style="margin:0">
<div id="slots"></div>
<script type="module">
  import { createComponents } from '/dist/components.js';
  const query = new URLSearchParams(location.search);
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
  if (query.get('pre') !== '0') document.body.insertAdjacentHTML('afterbegin', '<input id="pre">');
  const handles = [];
  for (const name of query.get('slots').split(',')) {
    const slot = document.createElement('div');
    document.getElementById('slots').appendChild(slot);
    handles.push(components.mount(slot, { app: 'demo', component: name }));
  }
  if (query.get('post') !== '0') document.body.insertAdjacentHTML('beforeend', '<input id="post">');
  await Promise.all(handles.map(handle => handle.ready));
  window.mounted = true;
</script>
</body></html>`;

const SHELL_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body><div id="root"></div>
<script type="module">
  import { startComponentFrame } from '/dist/components.js';
  startComponentFrame({ bundleUrl: '/bundle/' + location.pathname.split('/').pop() + '.js' });
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
const define = (tag, mode, html, options = '') => `if (!customElements.get('${tag}')) customElements.define('${tag}', class extends HTMLElement { constructor() { super(); const shadow = this.attachShadow({ mode: '${mode}'${options} }); shadow.innerHTML = '${html}'; if ('${mode}' === 'closed') window.__closed = shadow; } });`;
// A body-level modal without a focus trap of its own, like an SDK's popup
const openModal = html => `window.openModal = () => { const modal = document.createElement('div'); modal.id = 'overlay'; Object.assign(modal.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.5)' }); modal.innerHTML = ${JSON.stringify(html)}; document.body.appendChild(modal); modal.querySelector('#m1').focus(); };`;
const NESTED = '<iframe id="card" srcdoc="<input id=num>" style="height:40px"></iframe>';
// A 3DS challenge: the payment SDK's modal holds the bank's page in a nested frame
const TDS = '<iframe id="tds" srcdoc="<input id=otp>" style="height:40px"></iframe>';
const FOCUS_BUNDLES = {
  Two: mod('<input id="x"><input id="y">'),
  RovingLast: mod('<button id="t0" tabindex="-1">t0</button><input id="x"><button id="t1">t1</button><button id="t2" tabindex="-1">t2</button>'),
  Radio: mod('<input id="x"><input type="radio" name="r" id="r1" checked><input type="radio" name="r" id="r2">'),
  NestedOnly: mod(NESTED),
  NestedFirst: mod(`${NESTED}<input id="x">`),
  NestedLast: mod(`<input id="x">${NESTED}`),
  Shadow: mod('<x-field id="sh"></x-field>', define('x-field', 'open', '<input id=s1><input id=s2>')),
  Closed: mod('<x-closed id="cl"></x-closed>', define('x-closed', 'closed', '<input id=c1><input id=c2>')),
  Delegates: mod('<x-del id="dl"></x-del>', define('x-del', 'open', '<input id=d1><input id=d2>', ', delegatesFocus: true')),
  Modal: mod('<input id="x">', openModal('<button id="m1">One</button><button id="m2">Two</button>')),
  Modal3ds: mod('<input id="x">', openModal(`${TDS}<button id="m1">Cancel</button>`)),
  Modal3dsLast: mod('<input id="x">', openModal(`<button id="m1">Cancel</button>${TDS}`)),
  Label: mod('<p id="label">Card number</p><input id="x">'),
  Dialog: mod('<input id="x"><div id="dlg"><button id="d1">1</button><button id="d2">2</button></div>', `const dialog = root.querySelector('#dlg'); dialog.addEventListener('keydown', (event) => { if (event.key !== 'Tab') return; if (!event.shiftKey && event.target.id === 'd2') { event.preventDefault(); dialog.querySelector('#d1').focus(); } if (event.shiftKey && event.target.id === 'd1') { event.preventDefault(); dialog.querySelector('#d2').focus(); } });`),
};
const BUNDLES = { Echo: ECHO_BUNDLE, Paragraphs: PARAGRAPHS_BUNDLE, ...FOCUS_BUNDLES };

let frameOrigin = '';
const hostServer = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://host');
  if (pathname === '/') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(HOST_PAGE);
  if (pathname === '/focus') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(FOCUS_PAGE);
  if (pathname === '/modal') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(MODAL_PAGE);
  if (pathname.startsWith('/dist/')) return sendDist(res, pathname);
  if (pathname === '/api/apps/demo/components') {
    if (req.headers.authorization !== `Basic ${Buffer.from('pk_test').toString('base64')}`) return res.writeHead(401).end();
    return json(res, { settings: { color: 'red' }, components: Object.keys(BUNDLES).map(name => ({ name, src: `${frameOrigin}/.swell/components/${name}?v=1` })) });
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
  if (pathname.startsWith('/.swell/components/')) return res.writeHead(200, { 'Content-Type': 'text/html' }).end(SHELL_PAGE);
  if (pathname.startsWith('/dist/')) return sendDist(res, pathname);
  const bundle = /^\/bundle\/(\w+)\.js$/.exec(pathname)?.[1];
  if (Object.hasOwn(BUNDLES, bundle ?? '')) return res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(BUNDLES[bundle]);
  if (pathname === '/echo') return json(res, { token: req.headers['swell-component-token'] ?? null });
  res.writeHead(404).end();
});

// Real Tab and Shift+Tab, one browser page at a time. Focus is named as: a host element id, or iframeN:<element>
// where <element> is an id in the component frame, card>num inside a nested frame, host#inner inside a shadow root,
// GUARD-prev / GUARD-next for the frame's own focus guards, BODY when nothing has focus.
const T = 'Tab';
const S = 'Shift+Tab';
const FOCUS_CASES = [
  ['before -> x -> y -> after and back', 'slots=Two', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'post'], [S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'pre']]],
  ['the component is last on the page', 'slots=Two&post=0', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'BODY']]],
  ['the component is last on the page, backwards', 'slots=Two&post=0', '#pre', [[T, 'iframe0:x'], [S, 'pre']]],
  ['the component is the only focusable, forwards', 'slots=Two&pre=0&post=0', null, [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'BODY']]],
  ['the component is the only focusable, backwards', 'slots=Two&pre=0&post=0', null, [[T, 'iframe0:x'], [S, 'BODY']]],
  ['two adjacent components', 'slots=Two,Two', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'iframe1:x'], [T, 'iframe1:y'], [T, 'post'], [S, 'iframe1:y'], [S, 'iframe1:x'], [S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'pre']]],
  ['tabindex -1 controls are skipped', 'slots=RovingLast', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:t1'], [T, 'post'], [S, 'iframe0:t1'], [S, 'iframe0:x'], [S, 'pre']]],
  // Focusing a nested iframe puts focus on its document first (card>BODY); a following Tab reaches its input.
  ['a nested iframe as the only control', 'slots=NestedOnly', '#pre', [[T, 'post', { via: ['iframe0:card>num'] }], [S, 'pre', { via: ['iframe0:card>num'] }]]],
  ['a nested iframe as the first control', 'slots=NestedFirst', '#pre', [[T, 'post', { via: ['iframe0:card>num', 'iframe0:x'] }], [S, 'pre', { via: ['iframe0:x', 'iframe0:card>num'] }]]],
  ['a nested iframe as the last control', 'slots=NestedLast', '#pre', [[T, 'post', { via: ['iframe0:x', 'iframe0:card>num'] }], [S, 'pre', { via: ['iframe0:card>num', 'iframe0:x'] }]]],
  ['an open shadow root', 'slots=Shadow', '#pre', [[T, 'iframe0:sh#s1'], [T, 'iframe0:sh#s2'], [T, 'post'], [S, 'iframe0:sh#s2'], [S, 'iframe0:sh#s1'], [S, 'pre']]],
  ['a closed shadow root is entered through the guards', 'slots=Closed', '#pre', [[T, 'iframe0:GUARD-prev'], [T, 'iframe0:cl#c1'], [T, 'iframe0:cl#c2'], [T, 'post'], [S, 'iframe0:GUARD-next'], [S, 'iframe0:cl#c2'], [S, 'iframe0:cl#c1'], [S, 'pre']]],
  ['Shift+Tab right after a closed shadow entry leaves before the component', 'slots=Closed', '#pre', [[T, 'iframe0:GUARD-prev'], [S, 'pre']]],
  ['Tab right after a closed shadow entry from below leaves after the component', 'slots=Closed', '#post', [[S, 'iframe0:GUARD-next'], [T, 'post']]],
  ['a delegatesFocus host without tabindex', 'slots=Delegates', '#pre', [[T, 'iframe0:dl#d1'], [T, 'iframe0:dl#d2'], [T, 'post'], [S, 'iframe0:dl#d2'], [S, 'iframe0:dl#d1'], [S, 'pre']]],
  ['a radio group is one stop, the checked radio', 'slots=Radio', '#post', [[S, 'iframe0:r1'], [S, 'iframe0:x'], [S, 'pre'], [T, 'iframe0:x'], [T, 'iframe0:r1'], [T, 'post']]],
  ['a dialog that wraps Tab keeps focus inside', 'slots=Dialog', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:d1'], [T, 'iframe0:d2'], [T, 'iframe0:d1'], [S, 'iframe0:d2']]],
];

async function focusCases() {
  const failures = [];
  const attempt = async (run) => {
    try {
      await run();
    } catch (error) {
      failures.push(error.message.split('\n')[0]);
    }
  };
  for (const [name, query, start, steps, before] of FOCUS_CASES) await attempt(() => focusCase(name, query, start, steps, before));
  await attempt(() => focusCase('a modal without a focus trap keeps Tab inside it', 'slots=Modal', null, [[T, 'iframe0:m2'], [T, 'iframe0:m1'], [T, 'iframe0:m2'], [S, 'iframe0:m1'], [S, 'iframe0:m2']], openComponentModal, 'iframe0:m1'));
  // A 3DS modal: Tab and Shift+Tab cycle between its button and the bank's frame (Chromium stops on that frame's
  // document first going forwards), never reaching the component's own field under the backdrop or the host page
  const challenge = ['iframe0:m1', 'iframe0:tds>otp', 'iframe0:tds>BODY'];
  const cycle = [T, S, S, T].map(key => [key, 'iframe0:m1', { via: ['iframe0:tds>otp'], only: challenge }]);
  await attempt(() => focusCase('a modal with a nested frame first keeps Tab and Shift+Tab inside it', 'slots=Modal3ds', null, cycle, openComponentModal, 'iframe0:m1'));
  await attempt(() => focusCase('a modal with a nested frame last keeps Tab and Shift+Tab inside it', 'slots=Modal3dsLast', null, cycle, openComponentModal, 'iframe0:m1'));
  // The shopper clicks straight into the bank's field from the host page: the component frame itself never had focus
  const clickChallenge = async (focusPage) => {
    await openComponentModal(focusPage);
    await focusPage.locator('#pre').focus();
    await focusPage.frames().find(item => item.url().startsWith(frameOrigin)).frameLocator('#tds').locator('#otp').click();
  };
  await attempt(() => focusCase('Shift+Tab after a click into a modal\'s nested frame stays in the modal', 'slots=Modal3ds', null, [[S, 'iframe0:m1'], [S, 'iframe0:tds>otp']], clickChallenge, 'iframe0:tds>otp'));
  await attempt(() => focusCase('Tab after a click into a modal\'s nested frame stays in the modal', 'slots=Modal3dsLast', null, [[T, 'iframe0:m1'], [T, 'iframe0:tds>otp']], clickChallenge, 'iframe0:tds>otp'));
  // A click on text before the field, then Shift+Tab, leaves the component: the click is no Tab entry
  await attempt(() => focusCase('Shift+Tab after a click on text before the field leaves the component', 'slots=Label', null, [[S, 'pre']], async (focusPage) => {
    await focusPage.frames().find(item => item.url().startsWith(frameOrigin)).locator('#label').click();
  }, 'iframe0:BODY'));
  // Two Tabs with no pause between them end inside the component on a field, not on a guard or back before it
  await attempt(async () => {
    const page = await openFocusPage('slots=Two', '#pre');
    try {
      const field = name => name === 'iframe0:x' || name === 'iframe0:y';
      await page.keyboard.press(T);
      await page.keyboard.press(T);
      await waitForFocus(page, field, 'two fast Tabs');
      await page.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(() => resolve(true), 200))));
      await waitForFocus(page, field, 'two fast Tabs, settled');
    } finally {
      await page.close();
    }
  });
  assert.deepEqual(failures, [], `focus order failures:\n${failures.join('\n')}`);
}

// Opens the component's modal (focus goes to its #m1) and waits for overlay and for any nested frame in it to load
async function openComponentModal(focusPage) {
  const frame = focusPage.frames().find(item => item.url().startsWith(frameOrigin));
  await frame.evaluate(() => openModal());
  await focusPage.waitForFunction(() => getComputedStyle(document.querySelector('iframe').parentElement).position === 'fixed');
  await frame.waitForFunction(() => [...document.querySelectorAll('#overlay iframe')].every(nested => nested.contentDocument?.querySelector('input')));
}

async function openFocusPage(query, start) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', error => pageErrors.push(error));
  await page.goto(`${hostOrigin}/focus?${query}`);
  await page.waitForFunction(() => window.mounted === true, null, { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#slots > div')].every(slot => slot.getBoundingClientRect().height > 0));
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
    const name = el => (el?.hasAttribute?.('data-swell-focus-guard') ? (el.nextElementSibling?.id === 'root' ? 'GUARD-prev' : 'GUARD-next') : el?.id || el?.tagName);
    const active = document.activeElement;
    if (active?.shadowRoot?.activeElement) return `${name(active)}#${active.shadowRoot.activeElement.id}`;
    if (active?.id === 'cl' && window.__closed?.activeElement) return `cl#${window.__closed.activeElement.id}`;
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
        // Press until the target is reached; no stop may repeat (a trap), the controls in `via` must be visited on the way
        // in that order, and with `only` no other stop may be visited
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
        assert.ok(path.at(-1) === expected && new Set(path).size === path.length && visited && inside, `${name}: ${key} path ${path.join(' > ')} should visit ${via.join(', ') || 'anything'}${walk.only ? ` within ${walk.only.join(', ')}` : ''} and reach ${expected}`);
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

  // The frame lives in a body-level layer, outside the placeholder, without a sandbox.
  assert.equal(await page.evaluate(() => document.querySelector('#slot iframe')), null);
  assert.equal(await page.evaluate(() => document.querySelector('iframe').parentElement.parentElement === document.body), true);
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

  // The token goes to the frame origin only.
  assert.deepEqual(await frame.evaluate(() => __props.fetch('/echo').then(response => response.json())), { token: 'tok-1' });
  assert.deepEqual(await frame.evaluate(url => __props.fetch(url).then(response => response.json()), `${hostOrigin}/cors-echo`), { token: null });

  // The placeholder follows the component height.
  await frame.evaluate(() => { document.querySelector('#grow').style.height = '300px'; });
  await page.waitForFunction(() => document.querySelector('#slot').getBoundingClientRect().height >= 300);

  // A modal inside the frame turns overlay on and off.
  await frame.locator('#modal').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('iframe').parentElement).position === 'fixed' && document.documentElement.style.overflow === 'hidden');
  await frame.locator('#overlay').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('iframe').parentElement).position === 'absolute' && document.documentElement.style.overflow === '');

  // The layer fades with the placeholder's ancestors.
  await page.evaluate(() => { document.querySelector('#wrapper').style.opacity = '0.5'; });
  await page.waitForFunction(() => document.querySelector('iframe').parentElement.style.opacity === '0.5');

  // A forged message from the host page itself is ignored.
  await page.evaluate(() => {
    const channel = new URL(document.querySelector('iframe').src).searchParams.get('channel');
    window.postMessage({ $swell: 'swell:component', v: 1, channel, type: 'change', value: 'forged' }, '*');
  });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => events.some(([, value]) => value === 'forged')), false);

  // Inside a fixed, scrolling modal the layer stacks above the modal and is clipped to it.
  const modalPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  modalPage.on('pageerror', error => pageErrors.push(error));
  await modalPage.goto(`${hostOrigin}/modal`);
  await modalPage.waitForFunction(() => window.mounted === true && parseFloat(document.querySelector('iframe').parentElement.style.height) > 0, null, { timeout: 15000 });

  // The frame height includes the paragraphs' margins, so both show without an inner scroll.
  const paragraphs = modalPage.frames().find(item => item.url().startsWith(frameOrigin));
  const fit = await paragraphs.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight,
    lastBottom: document.querySelector('#last').getBoundingClientRect().bottom, innerHeight,
  }));
  assert.ok(fit.scrollHeight <= fit.clientHeight && fit.lastBottom <= fit.innerHeight, `the component is cut off: ${JSON.stringify(fit)}`);
  assert.equal(await modalPage.evaluate(() => {
    const slot = document.querySelector('#slot').getBoundingClientRect();
    return document.elementFromPoint(slot.left + slot.width / 2, slot.top + slot.height / 2) === document.querySelector('iframe');
  }), true, 'the component is hidden under the modal');
  await modalPage.evaluate(() => {
    const modal = document.querySelector('#modal');
    const slot = document.querySelector('#slot');
    modal.scrollTop = slot.getBoundingClientRect().top - modal.getBoundingClientRect().top + slot.offsetHeight / 2;
  });
  await modalPage.waitForFunction(() => Math.abs(document.querySelector('iframe').getBoundingClientRect().top - document.querySelector('#slot').getBoundingClientRect().top) < 1);
  const clipped = await modalPage.evaluate(() => {
    const layer = document.querySelector('iframe').parentElement;
    const [top, right = top, bottom = top, left = right] = (layer.style.clipPath.match(/-?[\d.]+/g) ?? [0]).map(Number);
    const box = layer.getBoundingClientRect();
    const modal = document.querySelector('#modal').getBoundingClientRect();
    const x = box.left + box.width / 2;
    const hit = y => document.elementFromPoint(x, y) === document.querySelector('iframe');
    return {
      visible: { top: box.top + top, right: box.right - right, bottom: box.bottom - bottom, left: box.left + left },
      modal: { top: modal.top, right: modal.right, bottom: modal.bottom, left: modal.left },
      above: hit(modal.top - 5), inside: hit(modal.top + 5),
    };
  });
  assert.ok(clipped.visible.top >= clipped.modal.top - 0.5 && clipped.visible.bottom <= clipped.modal.bottom + 0.5, `layer paints outside the modal: ${JSON.stringify(clipped)}`);
  assert.ok(clipped.visible.left >= clipped.modal.left - 0.5 && clipped.visible.right <= clipped.modal.right + 0.5, `layer paints outside the modal: ${JSON.stringify(clipped)}`);
  assert.deepEqual([clipped.above, clipped.inside], [false, true]);

  // The component sits partly under the sticky header, which stays on top of it.
  await modalPage.evaluate(() => {
    const modal = document.querySelector('#modal');
    const slot = document.querySelector('#slot');
    const header = document.createElement('div');
    header.id = 'bar';
    header.setAttribute('data-swell-component-occluder', '');
    header.style.cssText = 'position:sticky;top:0;height:60px;background:#ccc';
    modal.prepend(header);
    const bar = header.getBoundingClientRect();
    modal.scrollTop += slot.getBoundingClientRect().top - bar.bottom + 10;
  });
  await modalPage.waitForFunction(() => {
    const bar = document.querySelector('#bar').getBoundingClientRect();
    return Math.abs(document.querySelector('iframe').getBoundingClientRect().top - document.querySelector('#slot').getBoundingClientRect().top) < 1
      && document.querySelector('#slot').getBoundingClientRect().top < bar.bottom - 5;
  });
  const bar = await modalPage.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const header = document.querySelector('#bar').getBoundingClientRect();
    const slot = document.querySelector('#slot').getBoundingClientRect();
    const x = header.left + header.width / 2;
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
