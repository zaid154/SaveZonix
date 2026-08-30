// hook.js — Runs in page context (MAIN World)
// Observes legitimate active player media stream buffers (MSE) & network manifests
(function () {
    let bufferingEnabled = true;

    // 1. Dispatcher to ISOLATED content script
    function emitToExtension(type, detail) {
        window.dispatchEvent(new CustomEvent('__media_inspector_event__', {
            detail: { type, ...detail }
        }));
    }

    // 2. Hook MediaSource SourceBuffer.prototype.appendBuffer
    if (window.SourceBuffer && SourceBuffer.prototype.appendBuffer) {
        const originalAppendBuffer = SourceBuffer.prototype.appendBuffer;
        
        SourceBuffer.prototype.appendBuffer = function (data) {
            if (bufferingEnabled && data) {
                try {
                    let bufferCopy = null;
                    if (data instanceof ArrayBuffer) {
                        bufferCopy = data.slice(0);
                    } else if (ArrayBuffer.isView(data)) {
                        bufferCopy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
                    }

                    if (bufferCopy && bufferCopy.byteLength > 0) {
                        emitToExtension('segment_received', {
                            byteLength: bufferCopy.byteLength,
                            timestamp: Date.now()
                        });

                        // Post chunk data safely via window messaging
                        window.postMessage({
                            source: '__media_inspector_chunk__',
                            chunk: Array.from(new Uint8Array(bufferCopy))
                        }, '*');
                    }
                } catch { }
            }
            return originalAppendBuffer.apply(this, arguments);
        };
    }

    // 3. Hook fetch to detect active manifests (HLS/DASH)
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : (input ? input.url : '');
        
        if (url) {
            if (url.includes('.m3u8') || url.includes('manifest') || url.includes('.mpd')) {
                let format = 'HLS (.m3u8)';
                if (url.includes('.mpd')) format = 'MPEG-DASH (.mpd)';
                
                emitToExtension('manifest_detected', {
                    url: url,
                    format: format,
                    timestamp: Date.now()
                });
            }
        }
        return originalFetch.apply(this, arguments);
    };

    // 4. Hook XMLHttpRequest for legacy players
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === 'string') {
            if (url.includes('.m3u8') || url.includes('.mpd')) {
                emitToExtension('manifest_detected', {
                    url: url,
                    format: url.includes('.mpd') ? 'MPEG-DASH (.mpd)' : 'HLS (.m3u8)',
                    timestamp: Date.now()
                });
            }
        }
        return originalOpen.apply(this, arguments);
    };

    // 5. Listen for control events from extension
    window.addEventListener('__media_inspector_control__', (e) => {
        if (e.detail && typeof e.detail.enabled === 'boolean') {
            bufferingEnabled = e.detail.enabled;
        }
    });
})();
