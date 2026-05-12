import { describe, expect, it, vi } from 'vitest';
import { showUpdateBanner } from './update-banner';
import { asDocument, asHTMLElement, makeDoc } from '../test/dom-stub';

interface FakeWorker {
  postMessage: ReturnType<typeof vi.fn>;
}

interface FakeReg {
  waiting: FakeWorker | null;
}

function makeReg(): FakeReg {
  return { waiting: { postMessage: vi.fn() } };
}

describe('showUpdateBanner', () => {
  it('mounts a banner with Apply and Dismiss controls', () => {
    const doc = makeDoc();
    const parent = doc.createElement('div');
    const reg = makeReg();
    showUpdateBanner(reg as unknown as ServiceWorkerRegistration, asHTMLElement(parent), asDocument(doc));
    const banner = parent.querySelector('.update-banner');
    expect(banner).not.toBeNull();
    expect(banner!.getAttribute('role')).toBe('status');
    expect(banner!.querySelector('.update-banner__apply')).not.toBeNull();
    expect(banner!.querySelector('.update-banner__dismiss')).not.toBeNull();
  });

  it('is idempotent — second call does not append a second banner', () => {
    const doc = makeDoc();
    const parent = doc.createElement('div');
    const reg = makeReg();
    showUpdateBanner(reg as unknown as ServiceWorkerRegistration, asHTMLElement(parent), asDocument(doc));
    showUpdateBanner(reg as unknown as ServiceWorkerRegistration, asHTMLElement(parent), asDocument(doc));
    expect(parent.children).toHaveLength(1);
  });

  it('Apply click posts SKIP_WAITING to the waiting worker', () => {
    const doc = makeDoc();
    const parent = doc.createElement('div');
    const reg = makeReg();
    vi.stubGlobal('navigator', {
      serviceWorker: { controller: {}, addEventListener: vi.fn() },
    });
    vi.stubGlobal('location', { reload: vi.fn() });
    showUpdateBanner(reg as unknown as ServiceWorkerRegistration, asHTMLElement(parent), asDocument(doc));
    const apply = parent.querySelector('.update-banner__apply')!;
    apply.dispatchEvent('click');
    expect(reg.waiting!.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
  });

  it('Dismiss click removes the banner', () => {
    const doc = makeDoc();
    const parent = doc.createElement('div');
    const reg = makeReg();
    showUpdateBanner(reg as unknown as ServiceWorkerRegistration, asHTMLElement(parent), asDocument(doc));
    const dismiss = parent.querySelector('.update-banner__dismiss')!;
    dismiss.dispatchEvent('click');
    expect(parent.children).toHaveLength(0);
  });
});
