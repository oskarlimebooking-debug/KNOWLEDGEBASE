// App shell mount.
//
// Audit P2-#1 (phase-A): never use `innerHTML`, `insertAdjacentHTML`, or
// any HTML-string sink for app content. Express the tree as data via
// `renderShell()` and let `buildElement()` materialise it with
// `createElement` + `textContent`, so user/AI-generated strings can
// never be interpreted as markup. If you need to add a node, add it to
// the data tree — not as a string.

interface ShellNode {
  tag: string;
  className?: string;
  children: ReadonlyArray<ShellNode | string>;
}

export function renderShell(): ShellNode {
  return {
    tag: 'main',
    className: 'shell',
    children: [
      { tag: 'h1', children: ['Headway'] },
      {
        tag: 'p',
        className: 'tagline',
        children: ['Personal knowledge platform — READ / RESEARCH / WRITE.'],
      },
      {
        tag: 'p',
        className: 'status',
        children: ['Phase A scaffold — hello, world.'],
      },
    ],
  };
}

function buildElement(node: ShellNode): HTMLElement {
  const el = document.createElement(node.tag);
  if (node.className !== undefined) el.className = node.className;
  for (const child of node.children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else el.appendChild(buildElement(child));
  }
  return el;
}

export function mountApp(root: HTMLElement | null): void {
  if (!root) {
    throw new Error('mountApp: #app root element not found');
  }
  root.replaceChildren(buildElement(renderShell()));
}
