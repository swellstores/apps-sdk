import type { FrameMessage } from './components-protocol.js';

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]';
const GUARD = 'data-swell-focus-guard';

function isVisible(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  return element.getClientRects().length > 0 && style?.visibility !== 'hidden' && style?.visibility !== 'collapse';
}

// inert applies through shadow boundaries
function isInert(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null) {
    if (node.hasAttribute('inert')) return true;
  }
  return false;
}

// A custom element without a visible shadow root: its controls, if any, are in a closed shadow root we cannot search
const hidesFocus = (element: Element) => element.localName.includes('-') && !element.shadowRoot;

function isTabbable(element: HTMLElement): boolean {
  return element.matches(TABBABLE) && element.tabIndex >= 0 && !element.hasAttribute(GUARD) && !isInert(element) && isVisible(element);
}

// Tree order, descending into open shadow roots
function collect(parent: ParentNode, found: HTMLElement[]) {
  for (const child of Array.from(parent.children)) visit(child as HTMLElement, found);
}

function visit(element: HTMLElement, found: HTMLElement[]) {
  // A host that delegates focus is not a stop itself: Tab goes on to the controls in its shadow root
  if (!element.shadowRoot?.delegatesFocus && isTabbable(element)) found.push(element);
  if (element.shadowRoot) collect(element.shadowRoot, found);
  else if (element.localName === 'slot') {
    // A slot shows its assigned elements, or its own fallback content when nothing is assigned
    const assigned = (element as HTMLSlotElement).assignedElements?.({ flatten: true }) ?? [];
    if (assigned.length) for (const item of assigned) visit(item as HTMLElement, found);
    else collect(element, found);
  } else collect(element, found);
}

// One stop per radio group: the checked radio, else the first
function onePerRadioGroup(stops: HTMLElement[]): HTMLElement[] {
  const groups = new Map<object, Map<string, HTMLInputElement[]>>();
  const members = (radio: HTMLInputElement) => {
    const scope = radio.form ?? radio.getRootNode();
    const names = groups.get(scope) ?? new Map<string, HTMLInputElement[]>();
    groups.set(scope, names);
    const list = names.get(radio.name) ?? [];
    names.set(radio.name, list);
    return list;
  };
  const isRadio = (element: HTMLElement): element is HTMLInputElement => element.localName === 'input' && (element as HTMLInputElement).type === 'radio' && !!(element as HTMLInputElement).name;
  for (const stop of stops) if (isRadio(stop)) members(stop).push(stop);
  return stops.filter((stop) => {
    if (!isRadio(stop)) return true;
    const group = members(stop);
    return stop === (group.find(radio => radio.checked) ?? group[0]);
  });
}

/** Visible elements under `root` that Tab reaches, in tree order (open shadow roots included). */
export function tabbableIn(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  collect(root, found);
  return onePerRadioGroup(found);
}

export interface FocusGuardOptions {
  win: Window & typeof globalThis;
  /** The component root. */
  target: HTMLElement;
  post: (message: FrameMessage) => void;
  isOverlay: () => boolean;
  /** The element that covers the frame viewport while overlay is on. */
  getBlocker: () => Element | null;
}

export interface FocusGuards {
  /** Focuses the first or last control, as the host asks when Tab reaches the component. */
  enter(edge: 'first' | 'last'): void;
  /** Puts the guards around the root, or around the blocker while overlay is on. */
  place(): void;
  dispose(): void;
}

/**
 * Keyboard focus inside a component frame. Two guards, zero-size Tab stops, sit before and after the
 * root, so Tab or Shift+Tab out of the root lands on one of them. A guard that gets focus decides:
 *
 *   overlay on       wrap inside the blocker: the guard before it focuses its last stop, the one after its first
 *   entry pending    enter the root at the guard's own edge: the guard before enters first, the one after last
 *   otherwise        post focus-exit, so the host moves focus on past the component
 *
 * A control that gets focus outside overlay is reported as focus-rect, so the host scrolls it into view.
 */
export function installFocusGuards({ win, target, post, isOverlay, getBlocker }: FocusGuardOptions): FocusGuards {
  const document = win.document;
  const listening = new AbortController();
  const { signal } = listening;
  // Entry pending (Tab beat the host's focus message): set by window focus with nothing focused; cleared by enter(), pointerdown, focusin off a guard
  let awaitingEntry = false;
  // Our own focus() is running, so the focus events it causes move nothing: set and cleared around the call
  let moving = false;
  // Focus went into a nested frame, so its return is no entry: set by window blur; cleared by the next window focus
  let intoFrame = false;
  // A pointer press gave the frame focus, so that is no entry: set by pointerdown; cleared by the next window focus or blur
  let pressed = false;

  // Where keyboard focus belongs: the root, or during overlay the element that covers it (the root is under its backdrop)
  const reach = (): ParentNode => (isOverlay() ? getBlocker() ?? document.body : target);

  const focusQuietly = (element: HTMLElement) => {
    const was = moving;
    moving = true;
    try {
      element.focus();
    } finally {
      moving = was;
    }
  };

  const guard = (direction: 'next' | 'previous') => {
    const element = document.createElement('div');
    element.tabIndex = 0;
    element.setAttribute(GUARD, '');
    element.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:0;overflow:hidden;outline:none';
    element.addEventListener('focus', () => {
      if (moving) return;
      if (isOverlay()) {
        // The frame covers the viewport: keep focus inside the element that covers it, never on the root under it
        const stops = tabbableIn(reach());
        const stop = stops[direction === 'previous' ? stops.length - 1 : 0];
        if (stop) focusQuietly(stop);
      } else if (awaitingEntry) {
        // Tab came before the host's focus message: enter at this guard's own edge
        enter(direction === 'previous' ? 'first' : 'last');
      } else {
        post({ type: 'focus-exit', direction });
      }
    });
    // Right after a fallback entry the guard holds focus, so the very next Tab out of the component lands on it again
    element.addEventListener('keydown', (event) => {
      if (isOverlay() || event.key !== 'Tab' || event.shiftKey !== (direction === 'previous')) return;
      event.preventDefault();
      post({ type: 'focus-exit', direction });
    });
    return element;
  };
  const guards = { previous: guard('previous'), next: guard('next') };
  target.before(guards.previous);
  target.after(guards.next);

  // Overlay modals are body children after the root, so the guards move around them: the one before the modal
  // catches Shift+Tab from its first control, the one at the end of the body Tab from its last
  function place() {
    const { body } = document;
    const blocker = getBlocker();
    if (isOverlay() && blocker) {
      if (blocker.previousElementSibling !== guards.previous) blocker.before(guards.previous);
      if (body.lastElementChild !== guards.next) body.append(guards.next);
    } else if (!isOverlay()) {
      if (target.previousElementSibling !== guards.previous) target.before(guards.previous);
      if (target.nextElementSibling !== guards.next) target.after(guards.next);
    }
  }

  // Focus enters at an edge, of the root or during overlay of the modal. A component whose controls we cannot see
  // (closed shadow roots) is entered through the guard on that side; one with no controls at all is passed by.
  function enter(edge: 'first' | 'last') {
    awaitingEntry = false;
    const scope = reach();
    const stops = tabbableIn(scope);
    const stop = stops[edge === 'last' ? stops.length - 1 : 0];
    if (stop) focusQuietly(stop);
    else if (Array.from(scope.querySelectorAll('*')).some(hidesFocus)) {
      focusQuietly(guards[edge === 'first' ? 'previous' : 'next']);
    } else post({ type: 'focus-exit', direction: edge === 'last' ? 'previous' : 'next' });
  }

  // Focus comes back from a nested frame (in the root or in an overlay modal, such as a 3DS challenge) with
  // nothing focused, like a Tab entry does
  win.addEventListener('blur', () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    // A closed shadow root hides what has focus in it: a frame there shows only as focus on its host
    intoFrame = !!active && (active.localName === 'iframe' || hidesFocus(active));
    pressed = false;
  }, { signal });
  win.addEventListener('focus', () => {
    const none = !document.activeElement || document.activeElement === document.body;
    awaitingEntry = none && !intoFrame && !pressed;
    intoFrame = pressed = false;
  }, { signal });
  // A click fires pointerdown before the window focus it gives the frame
  document.addEventListener('pointerdown', () => {
    awaitingEntry = false;
    pressed = true;
  }, { capture: true, signal });
  document.addEventListener('focusin', (event) => {
    if (!(event.target instanceof win.Element) || event.target.hasAttribute(GUARD)) return;
    awaitingEntry = false;
    // The host scrolls the control into view: inside the frame there is nothing to scroll, the frame is as tall as the component
    if (isOverlay()) return;
    let focused: Element = event.target;
    while (focused.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    const box = focused.getBoundingClientRect();
    const base = target.getBoundingClientRect().top;
    post({ type: 'focus-rect', top: box.top - base, bottom: box.bottom - base });
  }, { signal });

  return {
    enter,
    place,
    dispose() {
      listening.abort();
      guards.previous.remove();
      guards.next.remove();
    },
  };
}
