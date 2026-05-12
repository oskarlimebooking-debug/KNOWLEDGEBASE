// Toast — transient bottom-of-screen notification.
//
// `showToast(container, msg, kind)` appends a single toast element with
// the class `toast toast--<kind>` and the message as a text node. After
// the per-kind duration elapses, the element is removed via `el.remove()`.
// Caller may dismiss early via the returned handle.

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

const DURATIONS_MS: Readonly<Record<ToastKind, number>> = {
  info: 3000,
  success: 3000,
  warn: 5000,
  error: 6000,
};

interface ToastContainer {
  ownerDocument: Document;
  appendChild(node: HTMLElement): unknown;
}

export interface ToastHandle {
  element: HTMLElement;
  dismiss: () => void;
}

export function showToast(
  container: ToastContainer,
  msg: string,
  kind: ToastKind = 'info',
  durationMs?: number,
): ToastHandle {
  const doc = container.ownerDocument;
  const el = doc.createElement('div');
  el.className = `toast toast--${kind}`;
  el.setAttribute('role', kind === 'error' || kind === 'warn' ? 'alert' : 'status');
  el.setAttribute('aria-live', kind === 'error' || kind === 'warn' ? 'assertive' : 'polite');
  el.textContent = msg;
  container.appendChild(el);

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    el.remove();
  };
  const ms = durationMs ?? DURATIONS_MS[kind];
  setTimeout(dismiss, ms);
  return { element: el, dismiss };
}

export function toastDurationMs(kind: ToastKind): number {
  return DURATIONS_MS[kind];
}
