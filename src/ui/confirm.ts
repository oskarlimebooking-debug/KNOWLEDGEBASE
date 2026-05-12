// Generic confirmation modal.
//
// `openConfirm(stack, opts)` returns a promise that resolves true when
// the user clicks the confirm button, false when they cancel (click the
// cancel button, click the backdrop, or press Escape). Used by TA.6
// for delete-book confirmation; future tasks can reuse it.

import { buildElement, type ShellNode } from './dom';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

function tree(opts: ConfirmOptions): ShellNode {
  const confirmClass = opts.destructive === true
    ? 'modal__action modal__action--destructive'
    : 'modal__action';
  return {
    tag: 'div',
    className: 'modal',
    attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title' },
    children: [
      {
        tag: 'div',
        className: 'modal__header',
        children: [
          {
            tag: 'h2',
            className: 'modal__title',
            attrs: { id: 'confirm-title' },
            children: [opts.title],
          },
        ],
      },
      {
        tag: 'div',
        className: 'modal__body',
        children: [
          { tag: 'p', className: 'modal__message', children: [opts.message] },
          {
            tag: 'div',
            className: 'modal__actions',
            children: [
              {
                tag: 'button',
                className: 'modal__action modal__action--secondary',
                attrs: { type: 'button', 'data-role': 'cancel' },
                children: [opts.cancelLabel ?? 'Cancel'],
              },
              {
                tag: 'button',
                className: confirmClass,
                attrs: { type: 'button', 'data-role': 'confirm' },
                children: [opts.confirmLabel ?? 'OK'],
              },
            ],
          },
        ],
      },
    ],
  };
}

export function openConfirm(
  stack: HTMLElement,
  opts: ConfirmOptions,
  doc: Document = document,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const backdrop = doc.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = buildElement(tree(opts), doc);
    backdrop.appendChild(modal);
    stack.appendChild(backdrop);
    stack.setAttribute('aria-hidden', 'false');

    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      doc.removeEventListener('keydown', onKey);
      backdrop.remove();
      if (stack.children.length === 0) stack.setAttribute('aria-hidden', 'true');
      resolve(result);
    };

    const onKey = (e: Event): void => {
      if ((e as KeyboardEvent).key === 'Escape') finish(false);
    };

    const confirmBtn = modal.querySelector('[data-role="confirm"]') as HTMLElement | null;
    const cancelBtn = modal.querySelector('[data-role="cancel"]') as HTMLElement | null;
    confirmBtn?.addEventListener('click', () => finish(true));
    cancelBtn?.addEventListener('click', () => finish(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false);
    });
    doc.addEventListener('keydown', onKey);
  });
}
