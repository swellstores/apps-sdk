import type { Rect } from './components-protocol.js';

export interface FrameLayer {
  readonly iframe: HTMLIFrameElement;
  setHeight(height: number): void;
  /** Covers the viewport while the component shows a modal. Returns the placeholder position. */
  setOverlay(on: boolean): Rect;
  destroy(): void;
}

function rectOf(element: HTMLElement): Rect {
  const { top, left, width } = element.getBoundingClientRect();
  return { top, left, width };
}

/**
 * Keeps the iframe in a body-level layer over an in-flow placeholder, so styles on the
 * placeholder's ancestors (opacity, transform, filter, overflow) cannot clip or fade it.
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
  iframe.setAttribute('allow', 'payment *; publickey-credentials-get *');
  Object.assign(iframe.style, { display: 'block', width: '100%', height: '100%', border: '0', background: 'transparent', colorScheme: 'normal' });
  layer.appendChild(iframe);
  document.body.appendChild(layer);

  let height = 0;
  let overlay = false;
  let overlayRect = '';
  let savedOverflow: string | null = null;
  let frame = 0;

  const opacity = () => {
    let value = 1;
    for (let node: HTMLElement | null = placeholder; node && node !== document.body; node = node.parentElement) {
      value *= Number(window.getComputedStyle(node).opacity || 1);
    }
    return value;
  };

  const apply = () => {
    if (overlay) {
      Object.assign(layer.style, { position: 'fixed', top: '0px', left: '0px', width: '100vw', height: '100vh', zIndex: '2147483647', opacity: '1', visibility: 'visible' });
      const rect = rectOf(placeholder);
      const key = `${rect.top}:${rect.left}:${rect.width}`;
      if (key !== overlayRect) {
        overlayRect = key;
        onOverlayRect(rect);
      }
      return;
    }
    const { top, left, width } = rectOf(placeholder);
    Object.assign(layer.style, {
      position: 'absolute', top: `${top + window.scrollY}px`, left: `${left + window.scrollX}px`,
      width: `${width}px`, height: `${height}px`, zIndex: '1', opacity: String(opacity()),
      visibility: width > 0 ? 'visible' : 'hidden',
    });
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
