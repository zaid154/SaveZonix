// src/download/chunk-storage.js — High-Performance Persistent OPFS & IndexedDB Chunk Storage (Zero-RAM Streaming)

(function (root) {
    const DB_NAME = 'StreamHelper_ChunkStorage';
    const DB_VERSION = 1;
    const STORE_META = 'download_metadata';
    const STORE_CHUNKS = 'download_chunks';

    // âââ 1. INDEXEDDB PERSISTENT METADATA & FALLBACK CHUNK STORE âââââââââââââ
    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                return reject(new Error('IndexedDB is not supported in this environment'));
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(STORE_META, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
                    const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: 'chunkKey' });
                    chunkStore.createIndex('downloadId', 'downloadId', { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // âââ 2. OPFS (ORIGIN PRIVATE FILE SYSTEM) STREAMING SINK âââââââââââââââââ
    class ChunkStorage {
        constructor() {
            this.hasOPFS = typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
            this.dbPromise = (typeof indexedDB !== 'undefined') ? openDatabase().catch(() => null) : Promise.resolve(null);
        }

        // Initialize persistent disk slot for a download
        async initSlot(downloadId, totalBytes, url, threadCount) {
            const meta = {
                id: downloadId,
                url: url,
                totalBytes: totalBytes,
                threadCount: threadCount,
                completedRanges: [],
                totalDownloadedBytes: 0,
                updatedAt: Date.now(),
                isCompleted: false
            };

            const db = await this.dbPromise;
            if (db) {
                await new Promise((res, rej) => {
                    const tx = db.transaction(STORE_META, 'readwrite');
                    tx.objectStore(STORE_META).put(meta);
                    tx.oncomplete = () => res();
                    tx.onerror = () => rej(tx.error);
                });
            }

            // If OPFS supported, pre-create the disk file
            if (this.hasOPFS) {
                try {
                    const opfsRoot = await navigator.storage.getDirectory();
                    const fileHandle = await opfsRoot.getFileHandle(`dl_${downloadId}.dat`, { create: true });
                    const writable = await fileHandle.createWritable({ keepExistingData: true });
                    if (totalBytes > 0) {
                        await writable.truncate(totalBytes);
                    }
                    await writable.close();
                } catch (e) {
                    console.warn('[ChunkStorage] OPFS allocation fallback to IndexedDB:', e.message);
                }
            }

            return meta;
        }

        // Write a downloaded byte block directly to disk at byte offset
        async writeSlice(downloadId, offset, uint8Array, sliceIndex) {
            if (!uint8Array || uint8Array.byteLength === 0) return;

            let writtenToOPFS = false;
            if (this.hasOPFS) {
                try {
                    const opfsRoot = await navigator.storage.getDirectory();
                    const fileHandle = await opfsRoot.getFileHandle(`dl_${downloadId}.dat`, { create: false });
                    const writable = await fileHandle.createWritable({ keepExistingData: true });
                    await writable.seek(offset);
                    await writable.write(uint8Array);
                    await writable.close();
                    writtenToOPFS = true;
                } catch (err) {
                    writtenToOPFS = false;
                }
            }

            // If OPFS was not available or failed, store in IndexedDB chunk store
            if (!writtenToOPFS) {
                const db = await this.dbPromise;
                if (db) {
                    await new Promise((res, rej) => {
                        const tx = db.transaction(STORE_CHUNKS, 'readwrite');
                        tx.objectStore(STORE_CHUNKS).put({
                            chunkKey: `${downloadId}_${sliceIndex}_${offset}`,
                            downloadId: downloadId,
                            sliceIndex: sliceIndex,
                            offset: offset,
                            bytes: uint8Array,
                            length: uint8Array.byteLength
                        });
                        tx.oncomplete = () => res();
                        tx.onerror = () => rej(tx.error);
                    });
                }
            }

            // Update persistent progress tracking
            await this._updateProgressMeta(downloadId, offset, uint8Array.byteLength);
        }

        async _updateProgressMeta(downloadId, offset, byteLength) {
            const db = await this.dbPromise;
            if (!db) return;

            try {
                const tx = db.transaction(STORE_META, 'readwrite');
                const store = tx.objectStore(STORE_META);
                const meta = await new Promise((res) => {
                    const req = store.get(downloadId);
                    req.onsuccess = () => res(req.result || null);
                    req.onerror = () => res(null);
                });

                if (meta) {
                    meta.completedRanges.push({ start: offset, end: offset + byteLength - 1 });
                    meta.totalDownloadedBytes += byteLength;
                    meta.updatedAt = Date.now();
                    store.put(meta);
                }
            } catch { }
        }

        // Get saved download metadata for seamless resume across reloads
        async getMetadata(downloadId) {
            const db = await this.dbPromise;
            if (!db) return null;

            return new Promise((res) => {
                const tx = db.transaction(STORE_META, 'readonly');
                const req = tx.objectStore(STORE_META).get(downloadId);
                req.onsuccess = () => res(req.result || null);
                req.onerror = () => res(null);
            });
        }

        // Assemble and return the complete File/Blob directly from persistent storage
        async exportFinalFile(downloadId, mimeType = 'video/mp4') {
            if (this.hasOPFS) {
                try {
                    const opfsRoot = await navigator.storage.getDirectory();
                    const fileHandle = await opfsRoot.getFileHandle(`dl_${downloadId}.dat`, { create: false });
                    const file = await fileHandle.getFile();
                    return new Blob([file], { type: mimeType });
                } catch { }
            }

            // Fallback: Read chunks sequentially from IndexedDB
            const db = await this.dbPromise;
            if (!db) return null;

            return new Promise((res, rej) => {
                const tx = db.transaction(STORE_CHUNKS, 'readonly');
                const index = tx.objectStore(STORE_CHUNKS).index('downloadId');
                const req = index.getAll(downloadId);

                req.onsuccess = () => {
                    const chunks = req.result || [];
                    chunks.sort((a, b) => a.offset - b.offset);
                    const byteArrays = chunks.map(c => c.bytes);
                    const blob = new Blob(byteArrays, { type: mimeType });
                    res(blob);
                };
                req.onerror = () => rej(req.error);
            });
        }

        // Clean up temporary disk files when download completes or is cancelled
        async cleanSlot(downloadId) {
            if (this.hasOPFS) {
                try {
                    const opfsRoot = await navigator.storage.getDirectory();
                    await opfsRoot.removeEntry(`dl_${downloadId}.dat`);
                } catch { }
            }

            const db = await this.dbPromise;
            if (db) {
                try {
                    const tx = db.transaction([STORE_META, STORE_CHUNKS], 'readwrite');
                    tx.objectStore(STORE_META).delete(downloadId);
                    
                    const chunkStore = tx.objectStore(STORE_CHUNKS);
                    const index = chunkStore.index('downloadId');
                    const req = index.getAllKeys(downloadId);
                    req.onsuccess = () => {
                        (req.result || []).forEach(k => chunkStore.delete(k));
                    };
                } catch { }
            }
        }
    }

    root.ChunkStorage = new ChunkStorage();
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
