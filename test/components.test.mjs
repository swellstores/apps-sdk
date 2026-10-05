import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { PROTOCOL, PROTOCOL_VERSION, TOKEN_HEADER, wrap, unwrap } from '../dist/components-protocol.js';
import { createFrameLayer } from '../dist/components-layer.js';
import { embedComponent } from '../dist/components-host.js';

const HOST = 'https://store.swell.test';
const FRAME = 'https://store--inst--app.swell.test';
const SRC = `${FRAME}/.swell/components/Picker?v=abc`;
const nativeFetch = globalThis.fetch;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const animationFrame = win => new Promise(resolve => win.requestAnimationFrame(resolve));

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
  let calls = 0;
  const { sent, receive } = embed(t, { getToken: async () => ({ token: `t${++calls}`, expires: Date.now() / 1000 + 60.2 }) });
  receive({ type: 'hello' });
  await tick();
  assert.equal(sent[0].message.token, 't1');
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.ok(sent.some(({ message }) => message.type === 'token' && message.token === 't2'));
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
