const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isVisible(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  return element.getClientRects().length > 0 && style?.visibility !== 'hidden' && style?.visibility !== 'collapse';
}

/** Visible elements under `root` that Tab reaches, in document order. */
export function tabbableIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(isVisible);
}
