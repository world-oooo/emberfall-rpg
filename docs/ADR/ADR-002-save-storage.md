# ADR-002: Save storage = IndexedDB via idb-keyval; settings in localStorage

**Date:** 2026-09-05 · **Status:** accepted

## Decision
- Save slots are structured objects stored in IndexedDB using `idb-keyval` 6.3.x (Apache-2.0, ~300 B brotli, maintained 2026).
  Custom store `emberfall/saves`, keys `slot_1`, `autosave`, `meta`.
- `SaveGame.saveVersion` is mandatory; `SaveSystem.load` applies ordered migrations.
- After the first successful save we call `navigator.storage.persist()` and surface the result in Settings.
- Export/Import (JSON text) is part of the architecture (Settings → "Copy save code" / "Paste save code") because private
  windows keep IndexedDB in memory only and Safari can evict after 7 days without interaction.
- Settings (volumes, shake, fullscreen) go to `localStorage` — tiny and synchronous at boot.

## Rejected
- Raw IndexedDB: more code, versionchange/blocked edge cases, no benefit for 3 keys.
- `idb`: indexing/cursors not needed.
- Backend/cloud: out of scope by the master prompt.
