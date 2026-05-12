// Minimal DOM stub for tests that exercise DOM construction without
// jsdom/happy-dom. Implements the Element + Document surface that
// src/ui/* and src/app.ts actually touch — no more. Every method here
// is a claim about the real DOM contract; over-mocking masks regressions.

export interface DatasetMap {
  [key: string]: string | undefined;
}

class ClassList {
  // Shared with StubElement.className via the same Set instance, so
  // assigning element.className = "foo bar" is reflected in
  // classList.contains/add/remove and vice-versa.
  constructor(private readonly set: Set<string>) {}
  add(...names: string[]): void {
    for (const n of names) this.set.add(n);
  }
  remove(...names: string[]): void {
    for (const n of names) this.set.delete(n);
  }
  contains(name: string): boolean {
    return this.set.has(name);
  }
  toString(): string {
    return Array.from(this.set).join(' ');
  }
  values(): string[] {
    return Array.from(this.set);
  }
}

export class StubElement {
  tagName: string;
  textContent = '';
  private classes = new Set<string>();
  classList: ClassList;
  dataset: DatasetMap = {};
  children: StubElement[] = [];
  attributes = new Map<string, string>();
  parent: StubElement | null = null;
  ownerDocument: StubDocument;
  private listeners = new Map<string, ((e?: unknown) => void)[]>();

  constructor(tagName: string, ownerDocument: StubDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.classList = new ClassList(this.classes);
  }

  get className(): string {
    return Array.from(this.classes).join(' ');
  }

  set className(value: string) {
    this.classes.clear();
    for (const c of String(value).split(/\s+/).filter(Boolean)) {
      this.classes.add(c);
    }
  }

  appendChild(node: StubElement): StubElement {
    node.parent = this;
    this.children.push(node);
    return node;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.has(name) ? (this.attributes.get(name) as string) : null;
  }

  remove(): void {
    if (this.parent === null) return;
    const idx = this.parent.children.indexOf(this);
    if (idx >= 0) this.parent.children.splice(idx, 1);
    this.parent = null;
  }

  replaceChildren(...nodes: StubElement[]): void {
    for (const c of this.children) c.parent = null;
    this.children = [];
    for (const n of nodes) this.appendChild(n);
  }

  addEventListener(event: string, fn: (e?: unknown) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  dispatchEvent(event: string): void {
    const fns = this.listeners.get(event) ?? [];
    for (const fn of fns) fn();
  }

  querySelector(selector: string): StubElement | null {
    // Supports a tiny subset: ".class-name". Walk children depth-first.
    if (!selector.startsWith('.')) return null;
    const className = selector.slice(1);
    const stack: StubElement[] = [...this.children];
    while (stack.length > 0) {
      const node = stack.shift() as StubElement;
      if (node.classList.contains(className)) return node;
      stack.unshift(...node.children);
    }
    return null;
  }
}

export class StubDocument {
  createElement(tag: string): StubElement {
    return new StubElement(tag, this);
  }
  createTextNode(text: string): StubElement {
    const el = new StubElement('#text', this);
    el.textContent = text;
    return el;
  }
}

export function makeDoc(): StubDocument {
  return new StubDocument();
}

// Typed cast helper — bridges the StubElement surface to the DOM types
// our modules accept via parameter (Document/HTMLElement). The stub is
// structurally compatible enough for the methods our code touches.
export function asDocument(d: StubDocument): Document {
  return d as unknown as Document;
}

export function asHTMLElement(e: StubElement): HTMLElement {
  return e as unknown as HTMLElement;
}
