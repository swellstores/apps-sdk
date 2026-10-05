import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { PROTOCOL, PROTOCOL_VERSION, TOKEN_HEADER, wrap, unwrap } from '../dist/components-protocol.js';
import { createFrameLayer } from '../dist/components-layer.js';
import { embedComponent } from '../dist/components-host.js';
import { createComponents } from '../dist/components-client.js';

const HOST = 'https://store.swell.test';
const FRAME = 'https://store--inst--app.swell.test';
const SRC = `${FRAME}/.swell/components/Picker?v=abc`;
const nativeFetch = globalThis.fetch;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const animationFrame = win => new Promise(resolve => win.requestAnimationFrame(resolve));
const flush = () => new Promise(resolve => setImmediate(resolve));

function hostWindow(t) {
  const win = new Window({ url: `${HOST}/admin`, settings: { disableIframePageLoading: true } });
  t.after(() => win.happyDOM.close());
  return win;
}

test('protocol wraps messages and only unwraps its own channel and version', () => {
  assert.equal(TOKEN_HEADER, 'Swell-Component-Token');
  const message = wrap('c1', { type: 'change', value: 'red' });
  assert.deepEqual(message, { type: 'change', value: 'red', $swell: PROTOCOL, v: PROTOCOL_VERSION, channel: 'c1' });
  assert.equal(unwrap(message, 'c1'), message);
  assert.equal(unwrap(message, 'c2'), null);
  assert.equal(unwrap({ ...message, v: PROTOCOL_VERSION + 1 }, 'c1'), null);
  assert.equal(unwrap({ ...message, $swell: 'other' }, 'c1'), null);
  assert.equal(unwrap({ ...message, type: 1 }, 'c1'), null);
  for (const data of [null, 'text', 1, undefined]) assert.equal(unwrap(data, 'c1'), null);
});

function layerSetup(t) {
  const win = hostWindow(t);
  const wrapper = win.document.createElement('div');
  wrapper.style.opacity = '0.5';
  const placeholder = win.document.createElement('div');
  wrapper.appendChild(placeholder);
  win.document.body.appendChild(wrapper);
  let rect = { top: 100, left: 20, width: 300, height: 0 };
  placeholder.getBoundingClientRect = () => rect;
  const moves = [];
  const layer = createFrameLayer(placeholder, SRC, 'Picker', next => moves.push(next));
  t.after(() => layer.destroy());
  return { win, placeholder, layer, element: layer.iframe.parentElement, moves, move: next => { rect = { ...rect, ...next }; } };
}

test('layer sits over the placeholder, outside it, and mirrors ancestor opacity', (t) => {
  const { win, placeholder, layer, element } = layerSetup(t);
  assert.equal(element.parentElement, win.document.body);
  assert.equal(placeholder.contains(layer.iframe), false);
  assert.equal(layer.iframe.src, SRC);
  assert.equal(layer.iframe.title, 'Picker');
  assert.equal(layer.iframe.getAttribute('allow'), 'payment *; publickey-credentials-get *');
  assert.equal(layer.iframe.hasAttribute('sandbox'), false);
  assert.deepEqual([element.style.position, element.style.top, element.style.left, element.style.width, element.style.opacity],
    ['absolute', '100px', '20px', '300px', '0.5']);
  layer.setHeight(120);
  assert.equal(placeholder.style.height, '120px');
  assert.equal(element.style.height, '120px');
});

test('layer follows the placeholder on every animation frame', async (t) => {
  const { win, element, move } = layerSetup(t);
  move({ top: 140 });
  await animationFrame(win);
  assert.equal(element.style.top, '140px');
});

test('overlay covers the viewport, locks page scroll and reports placeholder moves', async (t) => {
  const { win, layer, element, moves, move } = layerSetup(t);
  win.document.documentElement.style.overflow = 'scroll';
  assert.deepEqual(layer.setOverlay(true), { top: 100, left: 20, width: 300 });
  assert.deepEqual([element.style.position, element.style.width, element.style.height, element.style.opacity], ['fixed', '100vw', '100vh', '1']);
  assert.equal(win.document.documentElement.style.overflow, 'hidden');
  move({ top: 60 });
  await animationFrame(win);
  assert.deepEqual(moves, [{ top: 60, left: 20, width: 300 }]);
  layer.setOverlay(false);
  assert.equal(win.document.documentElement.style.overflow, 'scroll');
  assert.equal(element.style.position, 'absolute');
});

test('destroy removes the layer and restores the page', (t) => {
  const { win, placeholder, layer, element } = layerSetup(t);
  layer.setHeight(80);
  layer.setOverlay(true);
  layer.destroy();
  assert.equal(element.isConnected, false);
  assert.equal(win.document.documentElement.style.overflow, '');
  assert.equal(placeholder.style.height, '');
});

function embed(t, options = {}) {
  const win = hostWindow(t);
  const placeholder = win.document.createElement('div');
  win.document.body.appendChild(placeholder);
  const handle = embedComponent(placeholder, { src: SRC, value: 'red', context: { id: 'r1' }, settings: { theme: 'dark' }, ...options });
  t.after(() => handle.unmount());
  const iframe = win.document.querySelector('iframe');
  const channel = new URL(iframe.src).searchParams.get('channel');
  const sent = [];
  // happy-dom does not create windows for iframes when page loading is off; stand in for the frame.
  const frameWindow = { postMessage(data, origin) { sent.push({ message: unwrap(structuredClone(data), channel), origin }); } };
  Object.defineProperty(iframe, 'contentWindow', { value: frameWindow, configurable: true });
  const receive = (message, { origin = FRAME, source = frameWindow, channel: target = channel } = {}) =>
    win.dispatchEvent(new win.MessageEvent('message', { data: wrap(target, message), origin, source }));
  return { win, placeholder, handle, iframe, channel, sent, receive };
}

test('host frame URL carries the host origin and a channel', (t) => {
  const { iframe, channel } = embed(t);
  const url = new URL(iframe.src);
  assert.equal(`${url.origin}${url.pathname}`, `${FRAME}/.swell/components/Picker`);
  assert.equal(url.searchParams.get('v'), 'abc');
  assert.equal(url.searchParams.get('parent'), HOST);
  assert.match(channel, /^[0-9a-f-]{36}$/);
});

test('host sends init with the latest props only after the frame says hello', async (t) => {
  const { handle, sent, receive } = embed(t);
  handle.update({ value: 'blue', readonly: true });
  await tick();
  assert.deepEqual(sent, []);
  receive({ type: 'hello' });
  await tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].origin, FRAME);
  assert.equal(sent[0].message.type, 'init');
  assert.equal(sent[0].message.token, null);
  assert.deepEqual(sent[0].message.props, { value: 'blue', context: { id: 'r1' }, params: {}, settings: { theme: 'dark' }, locale: 'en', readonly: true });
});

test('host ignores messages from other origins, windows and channels', async (t) => {
  const { win, sent, receive } = embed(t);
  receive({ type: 'hello' }, { origin: 'https://evil.test' });
  receive({ type: 'hello' }, { source: win });
  receive({ type: 'hello' }, { channel: 'other' });
  await tick();
  assert.deepEqual(sent, []);
  receive({ type: 'hello' });
  await tick();
  assert.equal(sent[0].message.type, 'init');
});

test('frame messages resolve ready and drive change, validity, resize and overlay', async (t) => {
  const { win, placeholder, handle, sent, receive } = embed(t);
  const changes = [];
  const validity = [];
  handle.on('change', value => changes.push(value));
  handle.on('validity', error => validity.push(error));
  receive({ type: 'hello' });
  await tick();
  receive({ type: 'ready' });
  await handle.ready;
  receive({ type: 'change', value: 'green' });
  receive({ type: 'validity', error: 'Required' });
  receive({ type: 'validity', error: 5 });
  receive({ type: 'resize', height: 239.4 });
  receive({ type: 'resize', height: Number.NaN });
  await tick();
  assert.deepEqual(changes, ['green']);
  assert.deepEqual(validity, ['Required', null]);
  assert.equal(placeholder.style.height, '240px');
  win.document.documentElement.style.overflow = 'auto';
  receive({ type: 'overlay', on: true });
  await tick();
  assert.equal(win.document.documentElement.style.overflow, 'hidden');
  assert.equal(sent.at(-1).message.type, 'rect');
  receive({ type: 'overlay', on: false });
  await tick();
  assert.equal(win.document.documentElement.style.overflow, 'auto');
});

test('emit resolves with the component result and rejects with its error', async (t) => {
  const { handle, sent, receive } = embed(t);
  receive({ type: 'hello' });
  await tick();
  receive({ type: 'ready' });
  const first = handle.emit('submit', { total: 10 });
  await tick();
  const event = sent.at(-1).message;
  assert.deepEqual([event.type, event.name, event.data], ['event', 'submit', { total: 10 }]);
  receive({ type: 'result', call: event.call, result: { ok: true } });
  assert.deepEqual(await first, { ok: true });
  const second = handle.emit('submit');
  await tick();
  receive({ type: 'result', call: sent.at(-1).message.call, error: 'Declined' });
  await assert.rejects(second, /Declined/);
});

test('token is loaded before init and refreshed a minute before it expires', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  let calls = 0;
  const { sent, receive } = embed(t, { getToken: async () => ({ token: `t${++calls}`, expires: Date.now() / 1000 + 600 }) });
  receive({ type: 'hello' });
  await flush();
  assert.deepEqual(sent.map(({ message }) => [message.type, message.token]), [['init', 't1']]);
  t.mock.timers.tick(539_999);
  await flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  await flush();
  assert.deepEqual(sent.map(({ message }) => [message.type, message.token]), [['init', 't1'], ['token', 't2']]);
});

test('a token inside the refresh window or without a valid expiry is not refreshed in a loop', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const tokens = [{ token: 'short', expires: 1_030 }, { token: 'bad', expires: 'soon' }, { token: 'ok', expires: 1_600 }];
  let calls = 0;
  const errors = [];
  const { handle, sent, receive } = embed(t, { getToken: async () => tokens[calls++] });
  handle.on('error', error => errors.push(error.message));
  receive({ type: 'hello' });
  await flush();
  t.mock.timers.tick(4_999);
  await flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(calls, 2);
  assert.deepEqual(errors, ['getToken must resolve to { token: string, expires: number }']);
  t.mock.timers.tick(10_000);
  await flush();
  assert.equal(calls, 3);
  assert.deepEqual(sent.map(({ message }) => [message.type, message.token]), [['init', 'short'], ['token', 'ok']]);
});

test('a failed refresh keeps the current token and retries with backoff', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const results = [{ token: 't1', expires: 1_600 }, new Error('Offline'), new Error('Offline'), { token: 't2', expires: 2_200 }];
  let calls = 0;
  const errors = [];
  const { handle, sent, receive } = embed(t, {
    getToken: async () => {
      const result = results[calls++];
      if (result instanceof Error) throw result;
      return result;
    },
  });
  handle.on('error', error => errors.push(error.message));
  receive({ type: 'hello' });
  await flush();
  t.mock.timers.tick(540_000);
  await flush();
  t.mock.timers.tick(10_000);
  await flush();
  t.mock.timers.tick(19_999);
  await flush();
  assert.equal(calls, 3);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(calls, 4);
  assert.deepEqual(errors, ['Offline', 'Offline']);
  assert.deepEqual(sent.map(({ message }) => [message.type, message.token]), [['init', 't1'], ['token', 't2']]);
});

test('init waits for the token and carries updates made meanwhile', async (t) => {
  let resolveToken;
  const { handle, sent, receive } = embed(t, { getToken: () => new Promise(resolve => { resolveToken = resolve; }) });
  receive({ type: 'hello' });
  await tick();
  handle.update({ value: 'blue' });
  await tick();
  assert.equal(sent.length, 0);
  resolveToken({ token: 't', expires: Date.now() / 1000 + 600 });
  await tick();
  assert.deepEqual(sent.map(({ message }) => message.type), ['init']);
  assert.equal(sent[0].message.props.value, 'blue');
});

test('token failures are reported and the frame gets no token', async (t) => {
  const errors = [];
  const { handle, sent, receive } = embed(t, { getToken: async () => { throw new Error('No session'); } });
  handle.on('error', error => errors.push(error.message));
  receive({ type: 'hello' });
  await tick();
  assert.equal(sent[0].message.token, null);
  assert.deepEqual(errors, ['No session']);
});

test('props that cannot be cloned are reported as errors', async (t) => {
  const errors = [];
  const { handle, receive } = embed(t, { context: { format() {} } });
  handle.on('error', error => errors.push(error.name));
  receive({ type: 'hello' });
  await tick();
  assert.deepEqual(errors, ['DataCloneError']);
});

test('a frame error rejects ready and notifies listeners', async (t) => {
  const errors = [];
  const { handle, receive } = embed(t);
  handle.on('error', error => errors.push(error.message));
  receive({ type: 'error', message: 'Bundle failed' });
  await assert.rejects(handle.ready, /Bundle failed/);
  assert.deepEqual(errors, ['Bundle failed']);
});

test('unmount rejects pending events, stops listening and removes the frame', async (t) => {
  const changes = [];
  const { win, handle, sent, receive } = embed(t, { getToken: async () => ({ token: 't', expires: Date.now() / 1000 + 60.1 }) });
  handle.on('change', value => changes.push(value));
  receive({ type: 'hello' });
  await tick();
  receive({ type: 'ready' });
  const pending = handle.emit('submit');
  await tick();
  handle.unmount();
  await assert.rejects(pending, /Component unmounted/);
  assert.equal(win.document.querySelector('iframe'), null);
  const count = sent.length;
  receive({ type: 'change', value: 'late' });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepEqual(changes, []);
  assert.equal(sent.length, count);
});

test('createComponents loads an app once with the public key and mounts components by name', async (t) => {
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push([url, init.headers.Authorization]);
    return Response.json({ settings: { theme: 'dark' }, components: [{ name: 'Picker', src: SRC }, { name: 'Badge', src: `${FRAME}/.swell/components/Badge?v=def` }] });
  };
  t.after(() => { globalThis.fetch = nativeFetch; });
  const win = hostWindow(t);
  const slots = [0, 1].map(() => win.document.body.appendChild(win.document.createElement('div')));
  const tokens = [];
  const components = createComponents({ storeId: 'store', publicKey: 'pk_test', getToken: async app => { tokens.push(app); return { token: 't', expires: Date.now() / 1000 + 600 }; } });
  const picker = await components.mount(slots[0], { app: 'my_app', component: 'Picker', value: '#fff' });
  const badge = await components.mount(slots[1], { app: 'my_app', component: 'Badge' });
  t.after(() => { picker.unmount(); badge.unmount(); });
  assert.deepEqual(requests, [['https://store.swell.store/api/apps/my_app/components', `Basic ${Buffer.from('pk_test').toString('base64')}`]]);
  const frames = [...win.document.querySelectorAll('iframe')];
  assert.deepEqual(frames.map(iframe => new URL(iframe.src).pathname), ['/.swell/components/Picker', '/.swell/components/Badge']);
  assert.deepEqual(frames.map(iframe => iframe.title), ['Picker', 'Badge']);
  await tick();
  assert.deepEqual(tokens, ['my_app', 'my_app']);
});

test('mount reports missing containers and components, and retries failed app loads', async (t) => {
  let status = 503;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    return status === 200 ? Response.json({ components: [{ name: 'Picker', src: SRC }] }) : new Response('', { status });
  };
  t.after(() => { globalThis.fetch = nativeFetch; });
  const win = hostWindow(t);
  const slot = win.document.body.appendChild(win.document.createElement('div'));
  const components = createComponents({ storeId: 'store', publicKey: 'pk', url: 'https://shop.test/' });
  await assert.rejects(components.mount('#missing', { app: 'my_app', component: 'Picker' }), /Component container "#missing" not found/);
  await assert.rejects(components.mount(slot, { app: 'my_app', component: 'Picker' }), /Cannot load components of app "my_app" \(503\)/);
  status = 200;
  await assert.rejects(components.mount(slot, { app: 'my_app', component: 'Nope' }), /Component "Nope" not found in app "my_app"/);
  const handle = await components.mount(slot, { app: 'my_app', component: 'Picker' });
  t.after(() => handle.unmount());
  assert.equal(urls[0], 'https://shop.test/api/apps/my_app/components');
  assert.equal(urls.length, 2);
  assert.ok(win.document.querySelector('iframe'));
});

test('createComponents requires a store and a public key', () => {
  assert.throws(() => createComponents({ storeId: 'store' }), /requires storeId and publicKey/);
  assert.throws(() => createComponents({ publicKey: 'pk' }), /requires storeId and publicKey/);
});
