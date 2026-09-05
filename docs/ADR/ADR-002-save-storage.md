# ADR-002: Save storage = IndexedDB via idb-keyval; settings in localStorage

**Date:** 2026-09-05 · **Status:** accepted

## Decision
- Save slots are structured objects stored in IndexedDB using `idb-keyval` 6.3.x (Apache-2.0, ~300 B brotli, maintained 2026).
  Custom store `emberfall/saves`, keys `slot_1`, `autosave`, `meta`.
- `SaveGame.saveVersion` is mandatory; `SaveSystem.load` applies ordered migrations.
- After the first successful save we call `navigator.storage.persist()` once, without awaiting it: Firefox
  answers with a permission prompt, and a promise that waits on that prompt must never sit in the save queue.
- Export/Import is part of the architecture because private windows can keep IndexedDB in memory only and some
  browsers may evict inactive origin storage. The RC UI downloads `emberfall-save.json` and imports a local
  JSON file only after `SaveSystem.parseImport` validates the structure.
- Settings (volumes, shake, display mode, hints, fullscreen preference) and keyboard bindings go to
  `localStorage` — tiny and synchronous at boot.

## Rejected
- Raw IndexedDB: more code, versionchange/blocked edge cases, no benefit for 3 keys.
- `idb`: indexing/cursors not needed.
- Backend/cloud: out of scope by the master prompt.
