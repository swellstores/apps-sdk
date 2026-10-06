const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]';

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

function isTabbable(element: HTMLElement): boolean {
  return element.matches(TABBABLE) && element.tabIndex >= 0 && !element.hasAttribute('data-swell-focus-guard') && !isInert(element) && isVisible(element);
}

// Tree order, descending into open shadow roots. A host that delegates focus is one stop itself.
function collect(parent: ParentNode, found: HTMLElement[]) {
  for (const child of Array.from(parent.children) as HTMLElement[]) {
    const delegates = !!child.shadowRoot?.delegatesFocus;
    if (isTabbable(child) || (delegates && isVisible(child) && child.tabIndex >= 0 && !isInert(child))) found.push(child);
    if (delegates) continue;
    if (child.shadowRoot) collect(child.shadowRoot, found);
    else if (child.localName === 'slot') {
      const assigned = (child as HTMLSlotElement).assignedElements?.({ flatten: true }) ?? [];
      if (assigned.length) {
        const holder = { children: assigned } as unknown as ParentNode;
        collect(holder, found);
        continue;
      }
      collect(child, found);
    } else collect(child, found);
  }
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
