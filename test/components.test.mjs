import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { PROTOCOL, PROTOCOL_VERSION, TOKEN_HEADER, wrap, unwrap } from '../dist/components-protocol.js';
import { createFrameLayer } from '../dist/components-layer.js';
import { embedComponent } from '../dist/components-host.js';
import { createComponents } from '../dist/components-client.js';
import { startComponentFrame } from '../dist/components-frame.js';

const HOST = 'https://store.swell.test';
const FRAME = 'https://store--inst--app.swell.test';
const SRC = `${FRAME}/.swell/components/Picker?v=abc`;
const nativeFetch = globalThis.fetch;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const animationFrame = win => new Promise(resolve => win.requestAnimationFrame(resolve));
const flush = () => new Promise(resolve => setImmediate(resolve));
// Settles a promise that should already have settled, without hanging when it has not.
const settled = promise => Promise.race([promise.then(value => ({ value }), error => ({ error })), flush().then(() => 'pending')]);

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
  const outer = win.document.createElement('div');
  const wrapper = win.document.createElement('div');
  wrapper.style.opacity = '0.5';
  const placeholder = win.document.createElement('div');
  wrapper.appendChild(placeholder);
  outer.appendChild(wrapper);
  win.document.body.appendChild(outer);
  let rect = { top: 100, left: 20, width: 300, height: 0 };
  placeholder.getBoundingClientRect = () => rect;
  const moves = [];
  const layer = createFrameLayer(placeholder, SRC, 'Picker', next => moves.push(next));
  t.after(() => layer.destroy());
  return { win, outer, wrapper, placeholder, layer, element: layer.iframe.parentElement, moves, move: next => { rect = { ...rect, ...next }; } };
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

test('layer stacks with the outermost positioned ancestor that has a z-index', async (t) => {
  const { win, outer, wrapper, layer, element } = layerSetup(t);
  assert.equal(element.style.zIndex, '1');
  Object.assign(outer.style, { position: 'fixed', zIndex: '99999' });
  Object.assign(wrapper.style, { position: 'relative', zIndex: '5' });
  await animationFrame(win);
  assert.equal(element.style.zIndex, '99999');
  outer.style.zIndex = 'auto';
  await animationFrame(win);
  assert.equal(element.style.zIndex, '5');
  // A z-index without positioning does not stack the element
  wrapper.style.position = 'static';
  await animationFrame(win);
  assert.equal(element.style.zIndex, '1');
  outer.style.zIndex = '99999';
  layer.setOverlay(true);
  assert.equal(element.style.zIndex, '2147483647');
});

test('layer is clipped to the visible part of scrolling ancestors and hidden when scrolled out', async (t) => {
  const { win, outer, wrapper, layer, element, move } = layerSetup(t);
  layer.setHeight(100);
  assert.deepEqual([element.style.clipPath, element.style.visibility], ['none', 'visible']);
  // Placeholder box: top 100, right 320, bottom 200, left 20
  outer.style.overflowY = 'scroll';
  outer.getBoundingClientRect = () => ({ top: 130, right: 1000, bottom: 180, left: 0 });
  await animationFrame(win);
  assert.equal(element.style.clipPath, 'inset(30px 0px 20px 0px)');
  wrapper.style.overflowX = 'hidden';
  wrapper.getBoundingClientRect = () => ({ top: 0, right: 300, bottom: 1000, left: 50 });
  await animationFrame(win);
  assert.equal(element.style.clipPath, 'inset(30px 20px 20px 30px)');
  assert.equal(element.style.visibility, 'visible');
  move({ top: 180 });
  await animationFrame(win);
  assert.equal(element.style.visibility, 'hidden');
  layer.setOverlay(true);
  assert.deepEqual([element.style.clipPath, element.style.visibility], ['none', 'visible']);
  layer.setOverlay(false);
  assert.deepEqual([element.style.clipPath, element.style.visibility], ['inset(0px 20px 100px 30px)', 'hidden']);
});

test('layer mirrors an inherited visibility: hidden', async (t) => {
  const { win, outer, element } = layerSetup(t);
  assert.equal(element.style.visibility, 'visible');
  outer.style.visibility = 'hidden';
  await animationFrame(win);
  assert.equal(element.style.visibility, 'hidden');
  outer.style.visibility = '';
  await animationFrame(win);
  assert.equal(element.style.visibility, 'visible');
});

test('layer writes only the styles that changed', async (t) => {
  const { win, element, move } = layerSetup(t);
  const writes = [];
  const setProperty = element.style.setProperty.bind(element.style);
  element.style.setProperty = (name, value) => {
    writes.push(name);
    setProperty(name, value);
  };
  await animationFrame(win);
  assert.deepEqual(writes, []);
  move({ top: 140 });
  await animationFrame(win);
  assert.deepEqual(writes, ['top']);
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

// happy-dom does not create windows for iframes when page loading is off; stand in for the frame.
function attachFrame(win) {
  const iframe = win.document.querySelector('iframe');
  const channel = new URL(iframe.src).searchParams.get('channel');
  const sent = [];
  const frameWindow = { postMessage(data, origin) { sent.push({ message: unwrap(structuredClone(data), channel), origin }); } };
  Object.defineProperty(iframe, 'contentWindow', { value: frameWindow, configurable: true });
  const receive = (message, { origin = FRAME, source = frameWindow, channel: target = channel } = {}) =>
    win.dispatchEvent(new win.MessageEvent('message', { data: wrap(target, message), origin, source }));
  return { iframe, channel, sent, receive };
}

function embed(t, options = {}) {
  const win = hostWindow(t);
  const placeholder = win.document.createElement('div');
  win.document.body.appendChild(placeholder);
  const handle = embedComponent(placeholder, { src: SRC, value: 'red', context: { id: 'r1' }, settings: { theme: 'dark' }, ...options });
  t.after(() => handle.unmount());
  return { win, placeholder, handle, ...attachFrame(win) };
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

test('props that cannot be cloned reject ready and are reported as errors', async (t) => {
  const errors = [];
  const { handle, receive } = embed(t, { context: { format() {} } });
  handle.on('error', error => errors.push(error.name));
  receive({ type: 'hello' });
  await tick();
  assert.deepEqual(errors, ['DataCloneError']);
  assert.equal((await settled(handle.ready)).error?.name, 'DataCloneError');
});

test('an event with data that cannot be cloned rejects that emit', async (t) => {
  const { handle, sent, receive } = embed(t);
  receive({ type: 'hello' });
  await tick();
  receive({ type: 'ready' });
  await handle.ready;
  assert.equal((await settled(handle.emit('submit', { format() {} }))).error?.name, 'DataCloneError');
  const next = handle.emit('submit', { ok: true });
  await tick();
  const event = sent.at(-1).message;
  assert.deepEqual([event.type, event.data], ['event', { ok: true }]);
  receive({ type: 'result', call: event.call, result: 'done' });
  assert.equal(await next, 'done');
});

test('ready fails when the frame does not say hello within 10 seconds of loading', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const errors = [];
  const { win, iframe, handle, sent, receive } = embed(t);
  handle.on('error', error => errors.push(error.message));
  iframe.dispatchEvent(new win.Event('load'));
  t.mock.timers.tick(9_999);
  assert.equal(await settled(handle.ready), 'pending');
  t.mock.timers.tick(1);
  assert.match((await settled(handle.ready)).error?.message ?? '', /Component frame did not start/);
  assert.deepEqual(errors, ['Component frame did not start']);
  // A frame that starts late still works
  receive({ type: 'hello' });
  await flush();
  assert.equal(sent.at(-1).message.type, 'init');
});

test('a frame that says hello in time is not failed by the start timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const errors = [];
  const { win, iframe, handle, receive } = embed(t);
  handle.on('error', error => errors.push(error.message));
  iframe.dispatchEvent(new win.Event('load'));
  receive({ type: 'hello' });
  await flush();
  t.mock.timers.tick(10_000);
  receive({ type: 'ready' });
  assert.deepEqual(await settled(handle.ready), { value: undefined });
  assert.deepEqual(errors, []);
});

test('a frame that says hello again leaves overlay, rejects pending events and gets init again', async (t) => {
  const { win, iframe, handle, sent, receive } = embed(t);
  receive({ type: 'hello' });
  await tick();
  receive({ type: 'ready' });
  await handle.ready;
  win.document.documentElement.style.overflow = 'auto';
  receive({ type: 'overlay', on: true });
  await tick();
  assert.deepEqual([iframe.parentElement.style.position, win.document.documentElement.style.overflow], ['fixed', 'hidden']);
  const pending = handle.emit('submit');
  await tick();
  handle.update({ value: 'blue' });
  receive({ type: 'hello' });
  assert.equal((await settled(pending)).error?.message, 'Component reloaded');
  await tick();
  assert.deepEqual([iframe.parentElement.style.position, win.document.documentElement.style.overflow], ['absolute', 'auto']);
  const inits = sent.filter(({ message }) => message.type === 'init');
  assert.equal(inits.length, 2);
  assert.equal(inits[1].message.props.value, 'blue');
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
  const picker = components.mount(slots[0], { app: 'my_app', component: 'Picker', value: '#fff' });
  const badge = components.mount(slots[1], { app: 'my_app', component: 'Badge' });
  t.after(() => { picker.unmount(); badge.unmount(); });
  await flush();
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
  assert.throws(() => components.mount('#missing', { app: 'my_app', component: 'Picker' }), /Component container "#missing" not found/);
  await assert.rejects(components.mount(slot, { app: 'my_app', component: 'Picker' }).ready, /Cannot load components of app "my_app" \(503\)/);
  status = 200;
  await assert.rejects(components.mount(slot, { app: 'my_app', component: 'Nope' }).ready, /Component "Nope" not found in app "my_app"/);
  const handle = components.mount(slot, { app: 'my_app', component: 'Picker' });
  t.after(() => handle.unmount());
  await flush();
  assert.equal(urls[0], 'https://shop.test/api/apps/my_app/components');
  assert.equal(urls.length, 2);
  assert.ok(win.document.querySelector('iframe'));
});

function gatedApp(t) {
  let release;
  globalThis.fetch = () => new Promise(resolve => {
    release = () => resolve(Response.json({ settings: { theme: 'dark' }, components: [{ name: 'Picker', src: SRC }] }));
  });
  t.after(() => { globalThis.fetch = nativeFetch; });
  const win = hostWindow(t);
  const slot = win.document.body.appendChild(win.document.createElement('div'));
  const handle = createComponents({ storeId: 'store', publicKey: 'pk' }).mount(slot, { app: 'my_app', component: 'Picker', value: 'red', context: { id: 'r1' } });
  t.after(() => handle.unmount());
  return { win, handle, release: () => release() };
}

test('mount returns the handle at once and keeps updates and listeners made while the app loads', async (t) => {
  const { win, handle, release } = gatedApp(t);
  assert.equal(typeof handle.then, 'undefined');
  const changes = [];
  handle.on('change', value => changes.push(value));
  handle.update({ value: 'blue', readonly: true });
  await flush();
  assert.equal(win.document.querySelector('iframe'), null);
  release();
  await flush();
  const { sent, receive } = attachFrame(win);
  receive({ type: 'hello' });
  await tick();
  assert.deepEqual(sent[0].message.props, { value: 'blue', context: { id: 'r1' }, params: {}, settings: { theme: 'dark' }, locale: 'en', readonly: true });
  receive({ type: 'change', value: 'green' });
  receive({ type: 'ready' });
  await handle.ready;
  assert.deepEqual(changes, ['green']);
  const result = handle.emit('ping', 21);
  await tick();
  receive({ type: 'result', call: sent.at(-1).message.call, result: 42 });
  assert.equal(await result, 42);
});

test('unmount before the app loads creates no frame and rejects ready and pending events', async (t) => {
  const { win, handle, release } = gatedApp(t);
  const pending = handle.emit('submit');
  pending.catch(() => {});
  handle.unmount();
  release();
  await flush();
  assert.equal(win.document.querySelector('iframe'), null);
  assert.equal((await settled(handle.ready)).error?.message, 'Component unmounted');
  assert.equal((await settled(pending)).error?.message, 'Component unmounted');
});

test('a failed app load or an unknown component fires error and rejects ready', async (t) => {
  let status = 503;
  globalThis.fetch = async () => (status === 200 ? Response.json({ components: [] }) : new Response('', { status }));
  t.after(() => { globalThis.fetch = nativeFetch; });
  const win = hostWindow(t);
  const slot = win.document.body.appendChild(win.document.createElement('div'));
  const components = createComponents({ storeId: 'store', publicKey: 'pk' });
  for (const [code, message] of [[503, 'Cannot load components of app "my_app" (503)'], [200, 'Component "Picker" not found in app "my_app"']]) {
    status = code;
    const errors = [];
    const handle = components.mount(slot, { app: 'my_app', component: 'Picker' });
    handle.on('error', error => errors.push(error.message));
    await flush();
    assert.equal((await settled(handle.ready)).error?.message, message);
    assert.deepEqual(errors, [message]);
  }
  assert.equal(win.document.querySelector('iframe'), null);
});

test('handles ignore listeners for unknown events', (t) => {
  const { handle } = gatedApp(t);
  const off = handle.on('focus', () => {});
  assert.equal(typeof off, 'function');
  off();
  const { handle: embedded } = embed(t);
  embedded.on('focus', () => {})();
});

test('createComponents requires a store and a public key', () => {
  assert.throws(() => createComponents({ storeId: 'store' }), /requires storeId and publicKey/);
  assert.throws(() => createComponents({ publicKey: 'pk' }), /requires storeId and publicKey/);
});

const HOST_PROPS = { value: 'red', context: { id: 'r1' }, params: { max: 3 }, settings: { theme: 'dark' }, locale: 'en', readonly: false };

function startFrame(t, { module, search, gate, bundleUrl = 'https://cdn.test/picker.js' } = {}) {
  const win = new Window({ url: `${FRAME}/.swell/components/Picker?${search ?? `v=abc&parent=${encodeURIComponent(HOST)}&channel=c1`}` });
  t.after(() => win.happyDOM.close());
  const posted = [];
  const parent = { postMessage(data, origin) { posted.push({ message: unwrap(data, 'c1'), origin }); } };
  const calls = [];
  const component = module ?? {
    mount(root, props) { calls.push(['mount', props]); root.textContent = String(props.value); },
    update(root, props) { calls.push(['update', props]); root.textContent = String(props.value); },
    unmount() { calls.push(['unmount']); },
  };
  const imported = [];
  startComponentFrame({
    bundleUrl, window: win, parent,
    importModule: async url => { imported.push(url); await gate; if (component instanceof Error) throw component; return component; },
  });
  const send = (message, { origin = HOST, source = parent, channel = 'c1' } = {}) =>
    win.dispatchEvent(new win.MessageEvent('message', { data: wrap(channel, message), origin, source }));
  const types = () => posted.map(({ message }) => message.type);
  return { win, posted, calls, imported, send, types, root: () => win.document.getElementById('root') };
}

test('frame refuses to run outside a Swell host', (t) => {
  const plain = new Window({ url: `${FRAME}/.swell/components/Picker` });
  t.after(() => plain.happyDOM.close());
  assert.throws(() => startComponentFrame({ bundleUrl: 'x', window: plain, parent: { postMessage() {} } }), /must be embedded/);
  const top = new Window({ url: `${FRAME}/.swell/components/Picker?parent=${encodeURIComponent(HOST)}&channel=c1` });
  t.after(() => top.happyDOM.close());
  assert.throws(() => startComponentFrame({ bundleUrl: 'x', window: top }), /must be embedded/);
});

test('frame says hello, mounts the bundle with host props and reports ready', async (t) => {
  const { posted, calls, imported, send, types, root } = startFrame(t);
  assert.deepEqual([posted[0].message.type, posted[0].origin], ['hello', HOST]);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  assert.deepEqual(imported, ['https://cdn.test/picker.js']);
  const [[name, props]] = calls;
  assert.equal(name, 'mount');
  assert.deepEqual([props.value, props.context, props.params, props.settings, props.locale, props.readonly], ['red', { id: 'r1' }, { max: 3 }, { theme: 'dark' }, 'en', false]);
  assert.equal(root().textContent, 'red');
  // happy-dom may or may not fire ResizeObserver on observe(), so check the set, not the order.
  assert.equal(types()[0], 'hello');
  assert.equal(types().filter(type => type === 'ready').length, 1);
  assert.equal(types().filter(type => type === 'resize').length, 1);
});

test('component props send values and validity to the host', async (t) => {
  const { calls, send, posted } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  const props = calls[0][1];
  props.setValue('blue');
  props.setValidity('Required');
  props.setValidity(undefined);
  assert.deepEqual(posted.slice(-3).map(({ message }) => [message.type, message.type === 'change' ? message.value : message.error]),
    [['change', 'blue'], ['validity', 'Required'], ['validity', null]]);
});

test('updates re-render with merged props and a repeated init does not mount twice', async (t) => {
  const { calls, send, root } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  send({ type: 'update', props: { value: 'green', readonly: true } });
  await tick();
  assert.deepEqual([calls[1][0], calls[1][1].value, calls[1][1].readonly, calls[1][1].context], ['update', 'green', true, { id: 'r1' }]);
  assert.equal(root().textContent, 'green');
  send({ type: 'init', props: { ...HOST_PROPS, value: 'again' }, token: null });
  await tick();
  assert.deepEqual(calls.map(([name]) => name), ['mount', 'update', 'update']);
});

test('host events run the first handler and return its result or error', async (t) => {
  const { calls, send, posted } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  const props = calls[0][1];
  props.on('submit', data => ({ ok: data.n * 2 }));
  props.on('submit', () => 'second');
  props.on('fail', () => { throw new Error('Declined'); });
  send({ type: 'event', call: 1, name: 'submit', data: { n: 2 } });
  send({ type: 'event', call: 2, name: 'fail', data: null });
  send({ type: 'event', call: 3, name: 'unknown', data: null });
  await tick();
  const results = posted.filter(({ message }) => message.type === 'result').map(({ message }) => [message.call, message.result, message.error]);
  assert.deepEqual(results.sort(([a], [b]) => a - b), [[1, { ok: 4 }, undefined], [2, undefined, 'Declined'], [3, undefined, undefined]]);
});

test('fetch adds the component token only to requests to the frame origin', async (t) => {
  const { win, calls, send } = startFrame(t);
  const seen = [];
  win.fetch = async (input, init) => {
    seen.push([String(input), new Headers(init?.headers).get(TOKEN_HEADER)]);
    return new Response('{}');
  };
  send({ type: 'init', props: HOST_PROPS, token: 't1' });
  await tick();
  const { fetch } = calls[0][1];
  await fetch('/functions/my_app/risk');
  await fetch(`${FRAME}/app-api/risk`, { headers: { Accept: 'application/json' } });
  await fetch('https://api.stripe.com/v1/tokens');
  send({ type: 'token', token: 't2' });
  await tick();
  await fetch('/app-api/risk');
  send({ type: 'token', token: null });
  await tick();
  await fetch('/app-api/risk');
  assert.deepEqual(seen, [
    ['/functions/my_app/risk', 't1'],
    [`${FRAME}/app-api/risk`, 't1'],
    ['https://api.stripe.com/v1/tokens', null],
    ['/app-api/risk', 't2'],
    ['/app-api/risk', null],
  ]);
});

test('frame ignores messages from other origins, windows and channels', async (t) => {
  const { win, imported, send } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null }, { origin: 'https://evil.test' });
  send({ type: 'init', props: HOST_PROPS, token: null }, { source: win });
  send({ type: 'init', props: HOST_PROPS, token: null }, { channel: 'other' });
  await tick();
  assert.deepEqual(imported, []);
});

test('bundles without the module shape, and failed imports, are reported to the host', async (t) => {
  const bad = startFrame(t, { module: { mount() {} } });
  bad.send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  assert.deepEqual([bad.posted.at(-1).message.type, bad.posted.at(-1).message.message], ['error', 'Component bundle must export mount, update and unmount']);
  const failing = startFrame(t, { module: new Error('404 bundle') });
  failing.send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  assert.deepEqual([failing.posted.at(-1).message.type, failing.posted.at(-1).message.message], ['error', '404 bundle']);
});

test('a viewport-covering fixed element switches overlay on and off', async (t) => {
  const { win, send, posted, root } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  const modal = win.document.createElement('div');
  modal.style.position = 'fixed';
  modal.getBoundingClientRect = () => ({ top: 0, left: 0, width: win.innerWidth, height: win.innerHeight });
  win.document.body.appendChild(modal);
  await tick();
  await animationFrame(win);
  assert.equal(win.document.documentElement.style.overflow, 'hidden');
  send({ type: 'rect', rect: { top: 50, left: 10, width: 400 } });
  await tick();
  assert.deepEqual([root().style.position, root().style.top, root().style.left, root().style.width], ['absolute', '50px', '10px', '400px']);
  modal.remove();
  await tick();
  await animationFrame(win);
  assert.deepEqual(posted.filter(({ message }) => message.type === 'overlay').map(({ message }) => message.on), [true, false]);
  assert.equal(root().style.position, '');
  assert.equal(win.document.documentElement.style.overflow, '');
});

test('a slow handler does not hold back other events', async (t) => {
  const { calls, send, posted } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  const props = calls[0][1];
  props.on('submit', () => new Promise(() => {}));
  props.on('validate', () => 'ok');
  send({ type: 'event', call: 1, name: 'submit', data: null });
  send({ type: 'event', call: 2, name: 'validate', data: null });
  await tick();
  const results = posted.filter(({ message }) => message.type === 'result').map(({ message }) => [message.call, message.result]);
  assert.deepEqual(results, [[2, 'ok']]);
});

test('an update while the bundle loads is applied at mount', async (t) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { calls, send } = startFrame(t, { gate });
  send({ type: 'init', props: HOST_PROPS, token: null });
  send({ type: 'update', props: { value: 'blue' } });
  await tick();
  assert.deepEqual(calls, []);
  release();
  await tick();
  assert.deepEqual(calls.map(([type, props]) => [type, props.value]), [['mount', 'blue']]);
});

test('a second init while the bundle loads imports and mounts once', async (t) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { calls, imported, send, types } = startFrame(t, { gate });
  send({ type: 'init', props: HOST_PROPS, token: null });
  send({ type: 'init', props: { ...HOST_PROPS, value: 'green' }, token: null });
  release();
  await tick();
  assert.equal(imported.length, 1);
  assert.deepEqual(calls.map(([type, props]) => [type, props.value]), [['mount', 'green'], ['update', 'green']]);
  assert.equal(types().filter(type => type === 'ready').length, 1);
});

test('a component whose mount throws is reported and never updated', async (t) => {
  const calls = [];
  const module = {
    mount() { throw new Error('Mount failed'); },
    update() { calls.push('update'); },
    unmount() {},
  };
  const { send, posted, types } = startFrame(t, { module });
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  send({ type: 'update', props: { value: 'blue' } });
  await tick();
  assert.deepEqual(calls, []);
  assert.ok(!types().includes('ready'));
  assert.ok(posted.some(({ message }) => message.type === 'error' && message.message === 'Mount failed'));
});

const overlayMessages = posted => posted.filter(({ message }) => message.type === 'overlay').map(({ message }) => message.on);

test('a fixed element without area does not switch overlay on, even in a frame that is zero high', async (t) => {
  const { win, send, posted } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  win.happyDOM.setViewport({ width: 1024, height: 0 });
  const toasts = win.document.createElement('div');
  toasts.style.position = 'fixed';
  toasts.getBoundingClientRect = () => ({ top: 0, left: 0, width: win.innerWidth, height: 0 });
  win.document.body.appendChild(toasts);
  await tick();
  await animationFrame(win);
  assert.deepEqual(overlayMessages(posted), []);
  assert.equal(win.document.documentElement.style.overflow, '');
});

test('a frame resize switches overlay off when the element no longer covers the frame, and never back on', async (t) => {
  const { win, send, posted } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  win.happyDOM.setViewport({ width: 1024, height: 60 });
  const bar = win.document.createElement('div');
  bar.style.position = 'fixed';
  bar.getBoundingClientRect = () => ({ top: 0, left: 0, width: win.innerWidth, height: 60 });
  win.document.body.appendChild(bar);
  await tick();
  await animationFrame(win);
  assert.deepEqual(overlayMessages(posted), [true]);
  // Overlay makes the frame cover the host viewport, where the bar covers little
  win.happyDOM.setViewport({ width: 1024, height: 768 });
  await animationFrame(win);
  assert.deepEqual(overlayMessages(posted), [true, false]);
  assert.equal(win.document.documentElement.style.overflow, '');
  // Back at the component size the bar covers the frame again, but a resize does not flip overlay back on
  win.happyDOM.setViewport({ width: 1024, height: 60 });
  await animationFrame(win);
  assert.deepEqual(overlayMessages(posted), [true, false]);
});

test('component callbacks keep their identity across renders', async (t) => {
  const { calls, send } = startFrame(t);
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  send({ type: 'update', props: { value: 'green' } });
  await tick();
  const [[, mounted], [, updated]] = calls;
  for (const name of ['setValue', 'setValidity', 'on', 'fetch']) assert.equal(updated[name], mounted[name], name);
});

test('a relative bundle URL resolves against the frame page', async (t) => {
  const { imported, send } = startFrame(t, { bundleUrl: '/bundles/picker.js' });
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  assert.deepEqual(imported, [`${FRAME}/bundles/picker.js`]);
});

test('the frame reports ready once an async mount resolves and applies updates made meanwhile', async (t) => {
  let finish;
  const calls = [];
  const module = {
    mount(root, props) {
      calls.push(['mount', props.value]);
      return new Promise(resolve => { finish = resolve; });
    },
    update(root, props) { calls.push(['update', props.value]); },
    unmount() {},
  };
  const { send, types } = startFrame(t, { module });
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  send({ type: 'update', props: { value: 'blue' } });
  await tick();
  assert.deepEqual(calls, [['mount', 'red']]);
  assert.ok(!types().includes('ready'));
  finish();
  await tick();
  assert.deepEqual(calls, [['mount', 'red'], ['update', 'blue']]);
  assert.equal(types().filter(type => type === 'ready').length, 1);
});

test('an async mount that rejects is reported and never reports ready', async (t) => {
  const module = { mount: async () => { throw new Error('Async mount failed'); }, update() {}, unmount() {} };
  const { send, posted, types } = startFrame(t, { module });
  send({ type: 'init', props: HOST_PROPS, token: null });
  await tick();
  assert.ok(!types().includes('ready'));
  assert.ok(posted.some(({ message }) => message.type === 'error' && message.message === 'Async mount failed'));
});
