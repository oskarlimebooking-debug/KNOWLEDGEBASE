// Shared DOM-tree builder.
//
// Audit P2-#1 (phase-A): UI code never uses `innerHTML` /
// `insertAdjacentHTML` / any HTML-string sink. Modules express their
// output as a `ShellNode` data tree; this module materialises it via
// `createElement` + `createTextNode` + `setAttribute`. User/AI strings
// can only enter through string-child text nodes, which the DOM treats
// as text — there is no path from authored data to script execution.

export interface ShellNode {
  tag: string;
  className?: string;
  attrs?: Readonly<Record<string, string>>;
  children?: ReadonlyArray<ShellNode | string>;
}

export function buildElement(node: ShellNode, doc: Document = document): HTMLElement {
  const el = doc.createElement(node.tag);
  if (node.className !== undefined) el.className = node.className;
  if (node.attrs !== undefined) {
    for (const [k, v] of Object.entries(node.attrs)) el.setAttribute(k, v);
  }
  for (const child of node.children ?? []) {
    if (typeof child === 'string') el.appendChild(doc.createTextNode(child));
    else el.appendChild(buildElement(child, doc));
  }
  return el;
}
