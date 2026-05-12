// View system.
//
// The app root is a single <div class="app"> with four sibling panes:
// `.view-library`, `.view-book`, `.view-chapter`, `.view-modal-stack`.
// `setView(root, name)` toggles a modifier class on the root
// (`view-library` | `view-book` | `view-chapter`) and writes the same
// value to `root.dataset.view`. CSS uses both signals — the dataset
// attribute selects which pane is visible, and the modifier class is a
// convenience hook for view-specific styling.
//
// Back stack: an in-module array. `backView(root)` pops it and re-runs
// `setView` against the previous view, returning what it restored to
// (or null when at root). Re-pressing setView with the current view is
// a no-op for the stack (no double-push, no re-render trigger).

export type ViewName = 'library' | 'book' | 'chapter';

const ALL_VIEWS: ReadonlyArray<ViewName> = ['library', 'book', 'chapter'];
const VIEW_PREFIX = 'view-';

interface ViewableRoot {
  classList: { add(c: string): void; remove(c: string): void };
  dataset: { view?: string };
}

let currentView: ViewName = 'library';
const stack: ViewName[] = [];

function viewClassFor(name: ViewName): string {
  return `${VIEW_PREFIX}${name}`;
}

function applyView(root: ViewableRoot, name: ViewName): void {
  for (const v of ALL_VIEWS) root.classList.remove(viewClassFor(v));
  root.classList.add(viewClassFor(name));
  root.dataset.view = name;
}

export function setView(root: ViewableRoot, name: ViewName): void {
  if (name === currentView) return;
  stack.push(currentView);
  applyView(root, name);
  currentView = name;
}

export function backView(root: ViewableRoot): ViewName | null {
  const prev = stack.pop();
  if (prev === undefined) return null;
  applyView(root, prev);
  currentView = prev;
  return prev;
}

export function getCurrentView(): ViewName {
  return currentView;
}

export function canGoBack(): boolean {
  return stack.length > 0;
}

// Test-only: reset module state. Production code never calls this.
export function resetViewState(): void {
  currentView = 'library';
  stack.length = 0;
}
