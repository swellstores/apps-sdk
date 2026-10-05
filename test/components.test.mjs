import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { PROTOCOL, PROTOCOL_VERSION, TOKEN_HEADER, wrap, unwrap } from '../dist/components-protocol.js';
import { createFrameLayer } from '../dist/components-layer.js';

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
