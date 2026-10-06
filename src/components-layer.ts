import type { Rect } from './components-protocol.js';

export interface FrameLayer {
  readonly iframe: HTMLIFrameElement;
  setHeight(height: number): void;
  /** Covers the viewport while the component shows a modal. Returns the placeholder position. */
  setOverlay(on: boolean): Rect;
  destroy(): void;
}

const OCCLUDER = '[data-swell-component-occluder]';
const TOP_LAYER = '2147483647';
const POSITIONED = /^(?:relative|absolute|fixed|sticky)$/;
const CLIPS = /^(?:hidden|scroll|auto|clip)$/;
// overflow does not apply to these boxes, and display: contents has no rect to clip to
const NO_CLIP_BOX = /^(?:inline|contents)$/;

const isSet = (value: string | undefined) => !!value && value !== 'none';

// Ancestors that become the containing block of fixed descendants (computed values missing in the environment count as unset)
function makesFixedBlock(style: CSSStyleDeclaration): boolean {
  return isSet(style.transform) || isSet(style.filter) || isSet(style.perspective) ||
    /\b(?:paint|layout|strict|content)\b/.test(style.contain || '') ||
    /\b(?:transform|filter|perspective)\b/.test(style.willChange || '') ||
    isSet(style.getPropertyValue('backdrop-filter'));
}

function rectOf(element: HTMLElement): Rect {
  const { top, left, width } = element.getBoundingClientRect();
  return { top, left, width };
}

/**
 * Keeps the iframe in a body-level layer over an in-flow placeholder, so styles on the
 * placeholder's ancestors (opacity, transform, filter, overflow) cannot clip or fade it.
 * Instead the layer mirrors what those ancestors do to the placeholder: their opacity, the
 * z-index of the outermost positioned ancestor that has one, the visible part inside scrolling
 * ancestors, and an inherited visibility: hidden.
 * An iframe reloads when it is moved in the DOM, so it is created inside the layer.
 */
export function createFrameLayer(placeholder: HTMLElement, src: string, title: string, onOverlayRect: (rect: Rect) => void): FrameLayer {
  const document = placeholder.ownerDocument;
  const window = document.defaultView;
  if (!window) throw new Error('Component placeholder must be attached to a window');
  const layer = document.createElement('div');
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = title;
  // Focus reaches the frame through the sentinel in the placeholder, so the iframe is not a Tab stop itself
  iframe.tabIndex = -1;
  iframe.setAttribute('allow', 'payment *; publickey-credentials-get *');
  Object.assign(iframe.style, { display: 'block', width: '100%', height: '100%', border: '0', background: 'transparent', colorScheme: 'normal' });
  layer.setAttribute('data-swell-component-layer', '');
  layer.appendChild(iframe);
  document.body.appendChild(layer);

  let height = 0;
  let overlay = false;
  let overlayRect = '';
  let savedOverflow: string | null = null;
  let frame = 0;
  const written: Record<string, string> = {};

  // Runs on every animation frame for every layer, so only changed styles are written
  const write = (styles: Record<string, string>) => {
    for (const name in styles) {
      if (written[name] !== styles[name]) {
        written[name] = styles[name];
        layer.style.setProperty(name, styles[name]);
      }
    }
  };

  const follow = () => {
    const { top, left, width } = rectOf(placeholder);
    const right = left + width;
    const bottom = top + height;
    let opacity = 1;
    let zIndex = '1';
    let stackingRoot: HTMLElement = document.body;
    let hidden = width <= 0;
    let clipTop = -Infinity;
    let clipRight = Infinity;
    let clipBottom = Infinity;
    let clipLeft = -Infinity;
    // 'flow': ancestors clip as usual; 'absolute' / 'fixed': skipped until the containing block of the box below
    let escape: 'flow' | 'absolute' | 'fixed' = 'flow';
    for (let node: HTMLElement | null = placeholder; node && node !== document.body; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      opacity *= Number(style.opacity || 1);
      // The outermost one wins. The layer comes later in the DOM, so an equal z-index paints above it.
      if (POSITIONED.test(style.position) && /^-?\d+$/.test(style.zIndex)) {
        zIndex = style.zIndex;
        stackingRoot = node;
      }
      let ends = false;
      let clips = false;
      if (node === placeholder) {
        hidden ||= style.visibility === 'hidden' || style.visibility === 'collapse';
      } else {
        ends = escape === 'absolute' ? POSITIONED.test(style.position) || makesFixedBlock(style) : escape === 'fixed' && makesFixedBlock(style);
        clips = escape === 'flow' || ends;
      }
      const clipX = clips && CLIPS.test(style.overflowX);
      const clipY = clips && CLIPS.test(style.overflowY);
      if ((clipX || clipY) && !NO_CLIP_BOX.test(style.display)) {
        const box = node.getBoundingClientRect();
        if (clipX) {
          clipLeft = Math.max(clipLeft, box.left);
          clipRight = Math.min(clipRight, box.right);
        }
        if (clipY) {
          clipTop = Math.max(clipTop, box.top);
          clipBottom = Math.min(clipBottom, box.bottom);
        }
      }
      if (ends) escape = 'flow';
      if (escape === 'flow') escape = style.position === 'absolute' ? 'absolute' : style.position === 'fixed' ? 'fixed' : 'flow';
    }
    // Host bars (sticky headers, footers) in the same stacking context paint over the placeholder's content, but not over the layer
    const bars = stackingRoot.querySelectorAll<HTMLElement>(OCCLUDER);
    for (let index = 0; index < bars.length; index++) {
      const bar = bars[index];
      if (bar.contains(placeholder) || placeholder.contains(bar)) continue;
      // A bar that is visibility: hidden or fully transparent covers nothing (browsers without checkVisibility count it)
      if (bar.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) === false) continue;
      const box = bar.getBoundingClientRect();
      if (box.right <= box.left || box.bottom <= box.top || box.left >= right || box.right <= left) continue;
      // A bar counts at the edges of the visible part: a component taller than its scroller passes under both bars
      const spanTop = Math.max(top, clipTop);
      const spanBottom = Math.min(bottom, clipBottom);
      if (box.top <= spanTop && box.bottom > spanTop) clipTop = Math.max(clipTop, box.bottom);
      else if (box.top < spanBottom && box.bottom >= spanBottom) clipBottom = Math.min(clipBottom, box.top);
    }
    hidden ||= clipTop >= bottom || clipBottom <= top || clipLeft >= right || clipRight <= left;
    const insets = [clipTop - top, right - clipRight, bottom - clipBottom, clipLeft - left].map(inset => Math.max(0, inset));
    write({
      position: 'absolute', top: `${top + window.scrollY}px`, left: `${left + window.scrollX}px`,
      width: `${width}px`, height: `${height}px`, 'z-index': zIndex, opacity: String(opacity),
      visibility: hidden ? 'hidden' : 'visible',
      'clip-path': insets.some(Boolean) ? `inset(${insets.map(inset => `${inset}px`).join(' ')})` : 'none',
    });
  };

  const apply = () => {
    if (!overlay) return follow();
    write({ position: 'fixed', top: '0px', left: '0px', width: '100vw', height: '100vh', 'z-index': TOP_LAYER, opacity: '1', visibility: 'visible', 'clip-path': 'none' });
    const rect = rectOf(placeholder);
    const key = `${rect.top}:${rect.left}:${rect.width}`;
    if (key !== overlayRect) {
      overlayRect = key;
      onOverlayRect(rect);
    }
  };

  const loop = () => {
    apply();
    frame = window.requestAnimationFrame(loop);
  };

  const lockScroll = (lock: boolean) => {
    const root = document.documentElement;
    if (lock && savedOverflow === null) {
      savedOverflow = root.style.overflow;
      root.style.overflow = 'hidden';
    }
    if (!lock && savedOverflow !== null) {
      root.style.overflow = savedOverflow;
      savedOverflow = null;
    }
  };

  loop();
  return {
    iframe,
    setHeight(next) {
      height = next;
      placeholder.style.height = `${next}px`;
      apply();
    },
    setOverlay(on) {
      overlay = on;
      lockScroll(on);
      const rect = rectOf(placeholder);
      overlayRect = `${rect.top}:${rect.left}:${rect.width}`;
      apply();
      return rect;
    },
    destroy() {
      window.cancelAnimationFrame(frame);
      lockScroll(false);
      layer.remove();
      placeholder.style.height = '';
    },
  };
}
