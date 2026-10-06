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
<input id="pre">
<div id="slots"></div>
<script type="module">
  import { createComponents } from '/dist/components.js';
  const query = new URLSearchParams(location.search);
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
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
// The second button is skipped by Tab (roving tabindex)
const PAIR_BUNDLE = `
export function mount(root) { root.innerHTML = '<input id="a"><button id="b" tabindex="-1">b</button>'; }
export function update() {}
export function unmount(root) { root.innerHTML = ''; }
`;

// A dialog that wraps Tab inside itself
const DIALOG_BUNDLE = `
export function mount(root) {
  root.innerHTML = '<button id="o">open</button><div id="dialog"><button id="d1">1</button><button id="d2">2</button></div>';
  const [first, last] = [root.querySelector('#d1'), root.querySelector('#d2')];
  root.querySelector('#dialog').addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
  });
}
export function update() {}
export function unmount(root) { root.innerHTML = ''; }
`;
const BUNDLES = { Echo: ECHO_BUNDLE, Paragraphs: PARAGRAPHS_BUNDLE, Pair: PAIR_BUNDLE, Dialog: DIALOG_BUNDLE };

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

  // Real Tab and Shift+Tab through components in a row, though their iframes sit at the end of the body.
  const where = async (focusPage) => {
    const active = await focusPage.evaluateHandle(() => document.activeElement);
    const owner = await active.asElement().contentFrame();
    if (!owner) return focusPage.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    return `frame:${await owner.evaluate(() => document.activeElement.id || document.activeElement.tagName)}`;
  };
  const tabTo = async (focusPage, key, expected) => {
    await focusPage.keyboard.press(key);
    const deadline = Date.now() + 3000;
    let got = await where(focusPage);
    while (got !== expected && Date.now() < deadline) {
      await focusPage.waitForTimeout(25);
      got = await where(focusPage);
    }
    assert.equal(got, expected, `${key} did not reach ${expected}`);
  };
  const openFocusPage = async (query) => {
    const focusPage = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    focusPage.on('pageerror', error => pageErrors.push(error));
    await focusPage.goto(`${hostOrigin}/focus?${query}`);
    await focusPage.waitForFunction(() => window.mounted === true, null, { timeout: 15000 });
    await focusPage.waitForFunction(() => [...document.querySelectorAll('#slots > div')].every(slot => slot.getBoundingClientRect().height > 0));
    await focusPage.locator('#pre').focus();
    return focusPage;
  };

  // Host input -> component -> host input, forwards and back (the second control of Echo is the last one Tab reaches)
  await page.locator('#before').focus();
  await tabTo(page, 'Tab', 'frame:value');
  await tabTo(page, 'Tab', 'frame:modal');
  await tabTo(page, 'Tab', 'after');
  await tabTo(page, 'Shift+Tab', 'frame:modal');
  await tabTo(page, 'Shift+Tab', 'frame:value');
  await tabTo(page, 'Shift+Tab', 'before');

  // Components in a row: focus enters each at the edge it comes from, and a control with tabindex -1 is skipped
  const row = await openFocusPage('slots=Echo,Pair');
  for (const [key, expected] of [['Tab', 'frame:value'], ['Tab', 'frame:modal'], ['Tab', 'frame:a'], ['Tab', 'post'], ['Shift+Tab', 'frame:a'], ['Shift+Tab', 'frame:modal'], ['Shift+Tab', 'frame:value'], ['Shift+Tab', 'pre']]) {
    await tabTo(row, key, expected);
  }

  // A component whose last control ends the page lets focus leave the frame instead of trapping it
  const last = await openFocusPage('slots=Echo&post=0');
  await tabTo(last, 'Tab', 'frame:value');
  await tabTo(last, 'Tab', 'frame:modal');
  await last.keyboard.press('Tab');
  await last.waitForFunction(() => document.activeElement !== document.querySelector('iframe'));

  // A dialog inside the component that wraps Tab itself keeps focus in the frame
  const dialog = await openFocusPage('slots=Dialog');
  await tabTo(dialog, 'Tab', 'frame:o');
  await tabTo(dialog, 'Tab', 'frame:d1');
  await tabTo(dialog, 'Tab', 'frame:d2');
  await tabTo(dialog, 'Tab', 'frame:d1');
  await tabTo(dialog, 'Shift+Tab', 'frame:d2');

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
