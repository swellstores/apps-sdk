import type { Rect } from './components-protocol.js';

export interface PlacedFrame {
  readonly iframe: HTMLIFrameElement;
  /** Sizes the placeholder, which the iframe fills, to the component's height. */
  setHeight(height: number): void;
  /** Covers the viewport while the component shows a modal. Returns the placeholder position. */
  setOverlay(on: boolean): Rect;
  destroy(): void;
}

// A plain block that fills the placeholder. During overlay the iframe is also a popover: these inline styles keep
// the user agent's popover border, padding and colors off it
const IN_FLOW: Record<string, string> = {
  display: 'block', position: 'static', inset: 'auto', margin: '0', padding: '0', border: '0',
  width: '100%', height: '100%', 'max-width': 'none', 'max-height': 'none', overflow: 'visible',
  background: 'transparent', 'color-scheme': 'normal', 'z-index': 'auto',
};
// The z-index only matters without the Popover API: the top layer is above every z-index
const COVER: Record<string, string> = { position: 'fixed', inset: '0px', width: '100vw', height: '100vh', 'z-index': '2147483647' };

function rectOf(element: HTMLElement): Rect {
  const { top, left, width } = element.getBoundingClientRect();
  return { top, left, width };
}

/**
 * Puts the component iframe in the placeholder, so it lays out, stacks, clips and takes focus like any other
 * element of the host page. For overlay the iframe enters the top layer as a manual popover: it covers the
 * viewport above everything else and escapes its ancestors' opacity, transform, filter and overflow, without
 * moving in the DOM (a moved iframe reloads). Without the Popover API it is a fixed box with the top z-index,
 * which a transformed or filtered ancestor still confines. During overlay the rest of the page is inert and
 * does not scroll.
 */
export function placeFrame(placeholder: HTMLElement, src: string, title: string, onOverlayRect: (rect: Rect) => void): PlacedFrame {
  const document = placeholder.ownerDocument;
  const window = document.defaultView;
  if (!window) throw new Error('Component placeholder must be attached to a window');
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = title;
  iframe.setAttribute('allow', 'payment *; publickey-credentials-get *');
  const style = (styles: Record<string, string>) => {
    for (const name in styles) iframe.style.setProperty(name, styles[name]);
  };
  style(IN_FLOW);
  // No height until the component reports one: an iframe without a height is 150px
  placeholder.style.height = '0px';
  placeholder.appendChild(iframe);

  let overlay = false;
  let frame = 0;
  let lastRect = '';
  let savedOverflow: string | null = null;
  // Elements made inert for the overlay, restored after it; elements that were inert already are left alone
  let inerted: Element[] = [];

  const keyOf = (rect: Rect) => `${rect.top}:${rect.left}:${rect.width}`;
  const follow = () => {
    const rect = rectOf(placeholder);
    const key = keyOf(rect);
    if (key !== lastRect) {
      lastRect = key;
      onOverlayRect(rect);
    }
    frame = window.requestAnimationFrame(follow);
  };

  // Everything beside the iframe's ancestors: focus and clicks cannot reach the page under the overlay
  const inertRest = () => {
    for (let node: Element = iframe; node.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling === node || sibling.hasAttribute('inert')) continue;
        sibling.setAttribute('inert', '');
        inerted.push(sibling);
      }
    }
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

  // The iframe is a popover only during overlay, so host styles for [popover] never reach it in the page.
  // showPopover throws for an iframe out of the page or already shown; the overlay styles apply either way
  const popover = (show: boolean) => {
    if (show) iframe.setAttribute('popover', 'manual');
    const toggle = show ? iframe.showPopover : iframe.hidePopover;
    try {
      if (typeof toggle === 'function') toggle.call(iframe);
    } catch {
      // Out of the page, or already in that state
    }
    if (!show) iframe.removeAttribute('popover');
  };

  const release = () => {
    window.cancelAnimationFrame(frame);
    for (const element of inerted) element.removeAttribute('inert');
    inerted = [];
    lockScroll(false);
  };

  return {
    iframe,
    setHeight(height) {
      placeholder.style.height = `${height}px`;
    },
    setOverlay(on) {
      const rect = rectOf(placeholder);
      if (on === overlay) return rect;
      overlay = on;
      if (on) {
        style(COVER);
        popover(true);
        lockScroll(true);
        inertRest();
        lastRect = keyOf(rect);
        frame = window.requestAnimationFrame(follow);
      } else {
        release();
        popover(false);
        style(IN_FLOW);
      }
      return rect;
    },
    destroy() {
      release();
      iframe.remove();
      placeholder.style.height = '';
    },
  };
}
