import { describe, expect, it, vi } from 'vitest';
import { applyUpdate, watchForUpdates } from './sw-update';

// Minimal SW + Worker mocks. The real types are too heavy to drag in
// here; we test the orchestration logic by hand-rolling the surface
// we touch.
interface FakeWorker {
  state: 'installing' | 'installed' | 'activated';
  postMessage: ReturnType<typeof vi.fn>;
  _listeners: Map<string, Array<() => void>>;
  addEventListener(event: string, fn: () => void): void;
  _fire(event: string): void;
}

interface FakeRegistration {
  waiting: FakeWorker | null;
  installing: FakeWorker | null;
  _listeners: Map<string, Array<() => void>>;
  addEventListener(event: string, fn: () => void): void;
  _fire(event: string): void;
}

function makeWorker(state: FakeWorker['state']): FakeWorker {
  const listeners = new Map<string, Array<() => void>>();
  return {
    state,
    postMessage: vi.fn(),
    _listeners: listeners,
    addEventListener(event: string, fn: () => void) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    },
    _fire(event: string) {
      for (const fn of listeners.get(event) ?? []) fn();
    },
  };
}

function makeReg(waiting: FakeWorker | null = null, installing: FakeWorker | null = null): FakeRegistration {
  const listeners = new Map<string, Array<() => void>>();
  return {
    waiting,
    installing,
    _listeners: listeners,
    addEventListener(event: string, fn: () => void) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    },
    _fire(event: string) {
      for (const fn of listeners.get(event) ?? []) fn();
    },
  };
}

describe('watchForUpdates', () => {
  it('fires immediately if a waiting worker already exists', () => {
    const onWaiting = vi.fn();
    const reg = makeReg(makeWorker('installed'));
    watchForUpdates(reg as unknown as ServiceWorkerRegistration, onWaiting);
    expect(onWaiting).toHaveBeenCalledOnce();
    expect(onWaiting).toHaveBeenCalledWith(reg);
  });

  it('fires on updatefound after the new worker reaches installed', () => {
    const onWaiting = vi.fn();
    const reg = makeReg(null, null);
    watchForUpdates(reg as unknown as ServiceWorkerRegistration, onWaiting);
    expect(onWaiting).not.toHaveBeenCalled();

    // Stub the controller so the "post-install with existing controller"
    // branch fires (a fresh install with no controller is a first-load,
    // not an update).
    vi.stubGlobal('navigator', {
      serviceWorker: { controller: {}, addEventListener: vi.fn() },
    });

    const installing = makeWorker('installing');
    (reg as unknown as { installing: FakeWorker }).installing = installing;
    reg._fire('updatefound');
    installing.state = 'installed';
    installing._fire('statechange');
    expect(onWaiting).toHaveBeenCalledOnce();
  });

  it('does NOT fire on first install (no existing controller)', () => {
    const onWaiting = vi.fn();
    const reg = makeReg(null, null);
    watchForUpdates(reg as unknown as ServiceWorkerRegistration, onWaiting);

    vi.stubGlobal('navigator', {
      serviceWorker: { controller: null, addEventListener: vi.fn() },
    });

    const installing = makeWorker('installing');
    (reg as unknown as { installing: FakeWorker }).installing = installing;
    reg._fire('updatefound');
    installing.state = 'installed';
    installing._fire('statechange');
    expect(onWaiting).not.toHaveBeenCalled();
  });
});

describe('applyUpdate', () => {
  it('posts SKIP_WAITING and reloads on controllerchange', () => {
    const reload = vi.fn();
    const listeners = new Map<string, Array<() => void>>();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        controller: {},
        addEventListener(event: string, fn: () => void) {
          if (!listeners.has(event)) listeners.set(event, []);
          listeners.get(event)!.push(fn);
        },
      },
    });
    vi.stubGlobal('location', { reload });

    const waiting = makeWorker('installed');
    const reg = makeReg(waiting);
    applyUpdate(reg as unknown as ServiceWorkerRegistration);
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING');
    expect(reload).not.toHaveBeenCalled();
    for (const fn of listeners.get('controllerchange') ?? []) fn();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('is a no-op if no waiting worker exists', () => {
    vi.stubGlobal('navigator', {
      serviceWorker: { controller: {}, addEventListener: vi.fn() },
    });
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const reg = makeReg(null);
    expect(() =>
      applyUpdate(reg as unknown as ServiceWorkerRegistration),
    ).not.toThrow();
    expect(reload).not.toHaveBeenCalled();
  });
});
