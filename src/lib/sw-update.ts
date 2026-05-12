// Service-worker update orchestration.
//
// The SW (public/sw.js) intentionally omits `skipWaiting()` and
// `clients.claim()`, so a newly-installed worker sits in the "waiting"
// state until the page explicitly tells it to take over. This module
// wires the page side of that flow:
//
//   watchForUpdates(reg, onWaiting)  — fires onWaiting() when a new
//                                       worker is installed and idle.
//   applyUpdate(reg)                  — postMessages SKIP_WAITING and
//                                       reloads once the new worker
//                                       becomes the controller.

export type WaitingHandler = (reg: ServiceWorkerRegistration) => void;

export function watchForUpdates(
  reg: ServiceWorkerRegistration,
  onWaiting: WaitingHandler,
): void {
  if (reg.waiting !== null) onWaiting(reg);
  reg.addEventListener('updatefound', () => {
    const newWorker = reg.installing;
    if (newWorker === null) return;
    newWorker.addEventListener('statechange', () => {
      if (
        newWorker.state === 'installed' &&
        navigator.serviceWorker.controller !== null
      ) {
        onWaiting(reg);
      }
    });
  });
}

export function applyUpdate(reg: ServiceWorkerRegistration): void {
  if (reg.waiting === null) return;
  let reloaded = false;
  const reload = (): void => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', reload);
  reg.waiting.postMessage('SKIP_WAITING');
}
