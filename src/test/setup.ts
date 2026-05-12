// Vitest global setup: provide an in-memory IndexedDB for unit tests.
// fake-indexeddb/auto patches the global `indexedDB` and `IDBKeyRange`
// objects so the production code path (no test-only branches) works as-is.
import 'fake-indexeddb/auto';
