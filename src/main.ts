import './styles.css';
import { mountApp } from './app';
import { registerServiceWorker } from './sw-register';
import { closeDb, openDb } from './data/db';

mountApp(document.getElementById('app'));
registerServiceWorker();

// Open ChapterWiseDB at boot so the schema upgrade (if any) runs before
// the first feature touches the DB. Failures are surfaced via console.error
// rather than thrown, so a missing/blocked DB doesn't kill the UI shell.
openDb().catch((err) => {
  console.error('[db] openDb failed:', err);
});

// HMR: dispose the open connection so the next reload can upgrade the DB
// without hitting `onblocked`. Wrapped so prod builds tree-shake it away.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void closeDb();
  });
}
