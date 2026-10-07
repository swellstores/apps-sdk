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

// Components in a row between two host inputs; ?slots=A,B picks them, ?pre=0 and ?post=0 drop the inputs.
const FOCUS_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Focus host</title></head>
<body style="margin:0">
<div id="slots"></div>
<script type="module">
  import { createComponents } from '/dist/components.js';
  const query = new URLSearchParams(location.search);
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
  if (query.get('pre') !== '0') document.body.insertAdjacentHTML('afterbegin', '<input id="pre">');
  // ?shadow=1: two neighbours on each side whose inputs sit in open shadow roots
  if (query.get('shadow') === '1') {
    customElements.define('x-in', class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<input id="i">'; } });
    document.body.insertAdjacentHTML('afterbegin', '<x-in id="a1"></x-in><x-in id="a2"></x-in>');
  }
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
  if (query.get('post') !== '0') document.body.insertAdjacentHTML('beforeend', '<input id="post">');
  if (query.get('shadow') === '1') document.body.insertAdjacentHTML('beforeend', '<x-in id="b1"></x-in><x-in id="b2"></x-in>');
  // ?ready=0: a component that never starts is mounted too, so the page does not wait for it
  if (query.get('ready') !== '0') await Promise.all(handles.map(handle => handle.ready));
  window.mounted = true;
</script>
</body></html>`;

// A fixed modal over a long page: its scroller has sticky bars and scroll-padding that keeps focused controls
// clear of them, and holds a component taller than itself. ?variant= picks the bars.
const bar = (id, style, content) => `<div id="${id}" style="position:sticky;height:50px;background:#ccc;z-index:1;${style}">${content}</div>`;
const SCROLLER_VARIANTS = {
  plain: { scroller: '', top: bar('hdr', 'top:0', 'header'), bottom: bar('ftr', 'bottom:0', '<button id="save">Save</button>') },
  bordered: { scroller: 'border-top:2px solid #000;border-bottom:2px solid #000', top: bar('hdr', 'top:0', 'header'), bottom: bar('ftr', 'bottom:0', 'footer') },
  offset: { scroller: '', top: bar('hdr', 'top:8px', 'header'), bottom: bar('ftr', 'bottom:8px', 'footer') },
  // An actions bar stacked above a status bar, both sticky at the bottom, in DOM order
  stacked: { scroller: '', top: bar('hdr', 'top:0', 'header'), bottom: bar('act', 'bottom:40px;height:40px', 'actions') + bar('ftr', 'bottom:0;height:40px', 'status') },
};
const scrollerPage = ({ scroller, top, bottom }) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Scroller host</title></head>
<body style="margin:0"><div style="height:3000px">page</div>
<div id="modal" style="position:fixed;top:50px;left:50px;width:600px;height:400px;z-index:99999;overflow-y:auto;scroll-padding:50px 0;background:#fff;${scroller}">
  ${top}
  <input id="pre"><div style="height:600px"></div><div id="slot"></div><div style="height:100px"></div><input id="post"><div style="height:600px"></div>
  ${bottom}
</div>
<script type="module">
  import { createComponents } from '/dist/components.js';
  const components = createComponents({ storeId: 'demo', publicKey: 'pk_test', url: location.origin });
  await components.mount('#slot', { app: 'demo', component: 'Tall' }).ready;
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
// Modals that do not focus anything themselves: a wrapper with buttons, and a vendor frame appended without a wrapper
const openQuietModal = html => `window.openModal = () => { const modal = document.createElement('div'); modal.id = 'overlay'; Object.assign(modal.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.5)' }); modal.innerHTML = ${JSON.stringify(html)}; document.body.appendChild(modal); };`;
const openBareFrame = "window.openModal = () => { const frame = document.createElement('iframe'); frame.id = 'bare'; frame.srcdoc = '<input id=otp>'; Object.assign(frame.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', border: '0' }); document.body.appendChild(frame); };";
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
  ClosedNested: mod('<input id="x"><x-cn id="cn"></x-cn>', define('x-cn', 'closed', '<iframe id="cnf" srcdoc="<input id=num>" style="height:40px"></iframe>')),
  Icon: mod('<input id="x"><x-icon id="ic"></x-icon><input id="y">', define('x-icon', 'open', '<b>i</b>')),
  IconOnly: mod('<x-icon id="ic"></x-icon>', define('x-icon', 'open', '<b>i</b>')),
  Delegates: mod('<x-del id="dl"></x-del>', define('x-del', 'open', '<input id=d1><input id=d2>', ', delegatesFocus: true')),
  Modal: mod('<input id="x">', openModal('<button id="m1">One</button><button id="m2">Two</button>')),
  Modal3ds: mod('<input id="x">', openModal(`${TDS}<button id="m1">Cancel</button>`)),
  Modal3dsLast: mod('<input id="x">', openModal(`<button id="m1">Cancel</button>${TDS}`)),
  Label: mod('<p id="label">Card number</p><input id="x">'),
  ModalQuiet: mod('<button id="pay">Pay</button>', openQuietModal('<button id="m1">One</button><button id="m2">Two</button>')),
  ModalFrame: mod('<input id="x">', openBareFrame),
  Tall: mod('<input id="x"><div style="height:500px"></div><input id="y">'),
  // Mounts, then throws on every update: the frame reports an error after ready
  Throws: mod('<input id="x"><input id="y">').replace('export function update() {}', "export function update() { throw new Error('update failed'); }"),
  Dialog: mod('<input id="x"><div id="dlg"><button id="d1">1</button><button id="d2">2</button></div>', `const dialog = root.querySelector('#dlg'); dialog.addEventListener('keydown', (event) => { if (event.key !== 'Tab') return; if (!event.shiftKey && event.target.id === 'd2') { event.preventDefault(); dialog.querySelector('#d1').focus(); } if (event.shiftKey && event.target.id === 'd1') { event.preventDefault(); dialog.querySelector('#d2').focus(); } });`),
};
const BUNDLES = { Echo: ECHO_BUNDLE, Paragraphs: PARAGRAPHS_BUNDLE, ...FOCUS_BUNDLES };

let frameOrigin = '';
const hostServer = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://host');
  if (pathname === '/') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(HOST_PAGE);
  if (pathname === '/focus') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(FOCUS_PAGE);
  if (pathname === '/modal') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(MODAL_PAGE);
  if (pathname === '/confined') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(CONFINED_PAGE);
  if (pathname === '/scroller') {
    const variant = SCROLLER_VARIANTS[new URL(req.url, 'http://host').searchParams.get('variant') ?? 'plain'];
    return variant ? res.writeHead(200, { 'Content-Type': 'text/html' }).end(scrollerPage(variant)) : res.writeHead(404).end();
  }
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
  if (pathname.startsWith('/.swell/components/')) return res.writeHead(200, { 'Content-Type': 'text/html' }).end(SHELL_PAGE);
  if (pathname.startsWith('/dist/')) return sendDist(res, pathname);
  const bundle = /^\/bundle\/(\w+)\.js$/.exec(pathname)?.[1];
  if (Object.hasOwn(BUNDLES, bundle ?? '')) return res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(BUNDLES[bundle]);
  if (pathname === '/echo') return json(res, { token: req.headers['swell-component-token'] ?? null });
  res.writeHead(404, { 'Content-Type': 'text/html' }).end('<!doctype html><p>Not found</p>');
});

// Real Tab and Shift+Tab, one browser page at a time. Focus is named as: a host element id (host#inner inside its
// open shadow root), or iframeN:<element>
// where <element> is an id in the component frame, card>num inside a nested frame, host#inner inside a shadow root,
// BODY when nothing has focus.
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
  ['a closed shadow root', 'slots=Closed', '#pre', [[T, 'iframe0:cl#c1'], [T, 'iframe0:cl#c2'], [T, 'post'], [S, 'iframe0:cl#c2'], [S, 'iframe0:cl#c1'], [S, 'pre']]],
  // From outside, focus on a frame inside a closed shadow root shows only as focus on its host. Entry from below
  // lands on the last control the frame can see, x: the frame inside the closed root is skipped on the way back.
  ['a closed shadow root holding a nested frame', 'slots=ClosedNested', '#pre', [[T, 'post', { via: ['iframe0:x', 'iframe0:cn>num'] }], [S, 'pre', { via: ['iframe0:x'] }]]],
  ['an open shadow element without controls is no stop', 'slots=Icon', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'post'], [S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'pre']]],
  // A frame whose document has nothing to focus is one stop at most (its document), never a trap
  ['a component with only an open shadow element and no controls is passed by', 'slots=IconOnly', '#pre', [[T, 'post', { only: ['iframe0:BODY', 'post'], max: 2 }], [S, 'pre', { only: ['iframe0:BODY', 'pre'], max: 2 }]]],
  ['a delegatesFocus host without tabindex', 'slots=Delegates', '#pre', [[T, 'iframe0:dl#d1'], [T, 'iframe0:dl#d2'], [T, 'post'], [S, 'iframe0:dl#d2'], [S, 'iframe0:dl#d1'], [S, 'pre']]],
  ['neighbours in open shadow roots', 'slots=Two&shadow=1', '#post', [[S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'pre'], [S, 'a2#i'], [T, 'pre'], [T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'post'], [T, 'b1#i']]],
  ['neighbours in open shadow roots, with no light-DOM neighbours', 'slots=Two&shadow=1&pre=0&post=0', '#a2 #i', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'b1#i'], [S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'a2#i']]],
  ['a component whose frame never starts is no Tab stop', 'slots=Missing&ready=0', '#pre', [[T, 'post'], [S, 'pre']]],
  // An error after the component rendered (its update threw) leaves it in the Tab order
  ['a component that reported an error after ready is still a Tab stop', 'slots=Throws', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:y'], [T, 'post'], [S, 'iframe0:y'], [S, 'iframe0:x'], [S, 'pre']], async (focusPage) => {
    await focusPage.evaluate(() => handles[0].update({ value: 'z' }));
    await focusPage.waitForFunction(() => errors.length > 0);
  }],
  ['a radio group is one stop, the checked radio', 'slots=Radio', '#post', [[S, 'iframe0:r1'], [S, 'iframe0:x'], [S, 'pre'], [T, 'iframe0:x'], [T, 'iframe0:r1'], [T, 'post']]],
  ['a dialog that wraps Tab keeps focus inside', 'slots=Dialog', '#pre', [[T, 'iframe0:x'], [T, 'iframe0:d1'], [T, 'iframe0:d2'], [T, 'iframe0:d1'], [S, 'iframe0:d2']]],
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
  if (index < 0) return page.evaluate(el => (el.shadowRoot?.activeElement ? `${el.id}#${el.shadowRoot.activeElement.id}` : el.id || el.tagName), element);
  const owner = await element.contentFrame();
  if (!owner) return `iframe${index}:?`;
  return `iframe${index}:${await owner.evaluate(() => {
    const name = el => el?.id || el?.tagName;
    const active = document.activeElement;
    const inner = active?.shadowRoot?.activeElement ?? (active && active === window.__closed?.host ? window.__closed.activeElement : null);
    if (inner?.tagName === 'IFRAME') return `${name(active)}>${name(inner.contentDocument.activeElement)}`;
    if (inner) return `${name(active)}#${inner.id}`;
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
        for (let press = 0; press < (walk.max ?? 5) && path.at(-1) !== expected; press++) {
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

async function openScrollerPage(variant = 'plain') {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', error => pageErrors.push(error));
  await page.goto(`${hostOrigin}/scroller?variant=${variant}`);
  await page.waitForFunction(() => window.mounted === true, null, { timeout: 15000 });
  return page;
}

// Two animation frames: scrolling and layout have settled
async function settled(page) {
  await page.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
}

// Whether the control focused in the component frame shows inside the modal, clear of its sticky bars
async function focusedControlShows(page) {
  const frame = await (await page.$('iframe')).contentFrame();
  const inner = await frame.evaluate(() => {
    const box = document.activeElement.getBoundingClientRect();
    return { id: document.activeElement.id, top: box.top, bottom: box.bottom };
  });
  return page.evaluate((control) => {
    const frameBox = document.querySelector('iframe').getBoundingClientRect();
    const modal = document.querySelector('#modal').getBoundingClientRect();
    let top = modal.top;
    let bottom = modal.bottom;
    for (const bar of document.querySelectorAll('#modal > [id]')) {
      if (getComputedStyle(bar).position !== 'sticky') continue;
      const box = bar.getBoundingClientRect();
      if (box.top + box.bottom <= modal.top + modal.bottom) top = Math.max(top, box.bottom);
      else bottom = Math.min(bottom, box.top);
    }
    const controlTop = frameBox.top + control.top;
    const controlBottom = frameBox.top + control.bottom;
    return (controlTop >= top - 0.5 && controlBottom <= bottom + 0.5) || `${control.id} at ${Math.round(controlTop)}..${Math.round(controlBottom)}, clear part ${Math.round(top)}..${Math.round(bottom)}`;
  }, inner);
}

async function waitUntilShown(page, label) {
  let shown = await focusedControlShows(page);
  for (let wait = 0; shown !== true && wait < 30; wait++) {
    await page.waitForFunction(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(() => resolve(true), 30))));
    shown = await focusedControlShows(page);
  }
  assert.equal(shown, true, `${label}: ${shown}`);
}

async function scrollerCases() {
  // A component taller than the modal, straddling its sticky bars, stays under each bar: also with a bordered
  // scroller, bars offset from its edges, and two bars stacked at the bottom
  const straddles = {
    plain: [[380, 'ftr'], [250, 'ftr'], [70, 'hdr'], [-50, 'hdr']],
    bordered: [[-50, 'hdr'], [250, 'ftr']],
    offset: [[-50, 'hdr'], [250, 'ftr']],
    stacked: [[250, 'act'], [250, 'ftr'], [-50, 'hdr']],
  };
  for (const [variant, checks] of Object.entries(straddles)) {
    await attempt(async () => {
      const page = await openScrollerPage(variant);
      try {
        const covered = [];
        for (const [slotTop, id] of checks) {
          await page.evaluate((top) => {
            document.querySelector('#modal').scrollTop += document.querySelector('#slot').getBoundingClientRect().top - top;
          }, slotTop);
          await settled(page);
          const hit = await page.evaluate((barId) => {
            const box = document.getElementById(barId).getBoundingClientRect();
            const element = document.elementFromPoint(300, (box.top + box.bottom) / 2);
            return document.getElementById(barId).contains(element) ? barId : element?.id || element?.tagName;
          }, id);
          if (hit !== id) covered.push(`component top at ${slotTop}: ${hit} over ${id}`);
        }
        assert.deepEqual(covered, [], `${variant} scroller: a tall component paints over a sticky bar: ${covered.join('; ')}`);
      } finally {
        await page.close();
      }
    });
  }
  // A control that keyboard focus reaches inside the component is scrolled into the modal's view, clear of its bars
  await attempt(async () => {
    const page = await openScrollerPage();
    try {
      await page.locator('#pre').focus();
      await page.keyboard.press(T);
      await waitForFocus(page, name => name === 'iframe0:x', 'scroller: Tab into the component');
      await waitUntilShown(page, 'scroller: Tab into the component');
      await page.keyboard.press(T);
      await waitForFocus(page, name => name === 'iframe0:y', 'scroller: Tab inside the component');
      await waitUntilShown(page, 'scroller: Tab inside the component');
      await page.evaluate(() => { document.querySelector('#modal').scrollTop = 0; });
      await page.locator('#post').focus();
      await page.keyboard.press(S);
      await waitForFocus(page, name => name === 'iframe0:y', 'scroller: Shift+Tab into the component');
      await waitUntilShown(page, 'scroller: Shift+Tab into the component');
    } finally {
      await page.close();
    }
  });
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
  // Tab to a control below the viewport does not scroll the page behind the fixed modal
  await attempt(async () => {
    const page = await openScrollerPage();
    try {
      await page.locator('#pre').focus();
      await page.keyboard.press(T);
      await waitForFocus(page, name => name === 'iframe0:x', 'scroller: Tab into the component');
      await page.keyboard.press(T);
      await waitForFocus(page, name => name === 'iframe0:y', 'scroller: Tab to the control below the viewport');
      await settled(page);
      const scrolled = await page.evaluate(() => scrollY);
      assert.equal(scrolled, 0, `scroller: the page behind the fixed modal scrolled by ${scrolled}px`);
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
  await scrollerCases();
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
