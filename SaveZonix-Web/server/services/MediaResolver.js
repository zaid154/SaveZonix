const path = require('path');
try { require('../patch-ytdl'); } catch {}
const { Ytdl, chooseFormat, Client } = require('@distube/ytdl-core');

const INFO_CACHE_TTL_MS = 2 * 60 * 1000;
const INFO_CACHE_MAX = 40;
const WARMUP_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

class MediaResolver {
    constructor() {
        const cookie = process.env.YOUTUBE_COOKIE || undefined;
        const isCloudDatacenter = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
        this._infoCache = new Map();
        this._inFlightFetches = new Map();
        this._recentSteps = [];
        this._nextFetchId = 1;
        this._warmupPromise = null;
        this._clientsLabel = isCloudDatacenter ? 'mweb' : 'visionos,mweb';
        this._warmupStatus = { state: 'idle', clients: this._clientsLabel, ms: 0, error: null };

        // VisionOS returns slow 403s on cloud datacenter IPs; Mweb uses cookie + patched base.js
        this.ytdl = new Ytdl({
            clients: isCloudDatacenter ? [Client.Mweb] : [Client.VisionOS, Client.Mweb],
            cookie,
            fetch: this._createPatchedFetch(),
            timeoutMs: 60000
        });
        this.ytdlVisionOS = this.ytdl;
        this.ytdlFast = this.ytdl;
    }

    _shortUrlTag(urlStr) {
        try {
            const u = new URL(urlStr);
            if (u.pathname.includes('/s/player/') && u.pathname.endsWith('/base.js')) return 'base.js';
            if (u.pathname.includes('/youtubei/v1/')) return `v1/${u.pathname.split('/youtubei/v1/')[1] || ''}`;
            if (u.pathname === '/' || u.pathname === '') return `${u.hostname}/`;
            const seg = u.pathname.split('/').filter(Boolean).slice(-1)[0] || u.pathname;
            return seg.slice(0, 24);
        } catch {
            return String(urlStr).slice(0, 24);
        }
    }

    /**
     * Patches YouTube player JS (e.g. b485e332) where ytdl-core's stripped solver AST
     * lacks Object.prototype inheritance setup for addOnDisposeCallback, and tracks fetch latencies.
     */
    _createPatchedFetch() {
        return async (input, init) => {
            const urlStr = typeof input === 'string' ? input : (input?.url || String(input));
            const tag = this._shortUrlTag(urlStr);
            const id = this._nextFetchId++;
            const startedAt = Date.now();
            this._inFlightFetches.set(id, { tag, startedAt });
            let status = 'err';
            try {
                const res = await fetch(input, init);
                status = res.status;
                if (urlStr.includes('/s/player/') && urlStr.includes('/base.js') && res.ok) {
                    let body = await res.text();
                    if (body.includes('addOnDisposeCallback')) {
                        const patch = 'var __szPatch=Object.defineProperty(Object.prototype,"addOnDisposeCallback",{value:function(){},configurable:true,writable:true});';
                        body = body.includes('var window=this;')
                            ? body.replace('var window=this;', `var window=this;${patch}`)
                            : `${patch}${body}`;
                    }
                    const headers = new Headers(res.headers);
                    headers.delete('content-length');
                    headers.delete('content-encoding');
                    return new Response(body, {
                        status: res.status,
                        statusText: res.statusText,
                        headers
                    });
                }
                return res;
            } catch (err) {
                status = err?.name === 'AbortError' ? 'abort' : 'err';
                throw err;
            } finally {
                const elapsed = Date.now() - startedAt;
                this._inFlightFetches.delete(id);
                this._recentSteps.push({ t: startedAt, label: `${tag}:${status}(${elapsed}ms)` });
                if (this._recentSteps.length > 20) this._recentSteps.shift();
            }
        };
    }

    _safeChooseFormat(formats, options) {
        if (!Array.isArray(formats) || formats.length === 0) return null;
        try {
            return chooseFormat(formats, options);
        } catch {
            return null;
        }
    }

    /**
     * Pre-warms player AST solver, BotGuard PoToken worker, and signed-in YouTube session
     * once at server startup so user requests resolve in ~1-3s instead of cold-starting on 0.1 vCPU.
     */
    warmup() {
        if (this._warmupPromise) return this._warmupPromise;
        const start = Date.now();
        this._warmupStatus = { state: 'running', clients: this._clientsLabel, ms: 0, error: null };
        console.log(`[MediaResolver] Starting background extractor warmup (${this._clientsLabel})...`);
        this._warmupPromise = this._getYtdlInfo(WARMUP_VIDEO_URL, 55000, { skipCache: true })
            .then(() => {
                const ms = Date.now() - start;
                this._warmupStatus = { state: 'ready', clients: this._clientsLabel, ms, error: null };
                console.log(`[MediaResolver] Warmup completed cleanly in ${ms}ms`);
            })
            .catch((err) => {
                const ms = Date.now() - start;
                this._warmupStatus = { state: 'failed', clients: this._clientsLabel, ms, error: err.message };
                console.warn(`[MediaResolver] Warmup finished with notice in ${ms}ms:`, err.message);
            });
        return this._warmupPromise;
    }

    /**
     * Resolve YouTube info using cached stream map (2m TTL) or VisionOS + Mweb with
     * abortable timeout and step-level breadcrumbs for timeout diagnostics.
     */
    async _getYtdlInfo(cleanUrl, timeoutMs = 23000, { skipCache = false } = {}) {
        const now = Date.now();
        if (!skipCache) {
            const cached = this._infoCache.get(cleanUrl);
            if (cached && cached.expiresAt > now) {
                return cached.info;
            }
            if (cached) this._infoCache.delete(cleanUrl);
        }

        const effectiveTimeout = Math.max(Number(timeoutMs) || 23000, 23000);
        const startedAt = Date.now();
        const controller = new AbortController();
        let timer = null;
        try {
            const info = await Promise.race([
                this.ytdl.getInfo(cleanUrl, { signal: controller.signal }),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error(`Stream resolution timeout after ${effectiveTimeout}ms`));
                    }, effectiveTimeout);
                })
            ]);

            if (!skipCache && info && (info.formats || []).some(f => Boolean(f.url))) {
                if (this._infoCache.size >= INFO_CACHE_MAX) {
                    const oldestKey = this._infoCache.keys().next().value;
                    if (oldestKey) this._infoCache.delete(oldestKey);
                }
                this._infoCache.set(cleanUrl, {
                    info,
                    expiresAt: Date.now() + INFO_CACHE_TTL_MS
                });
            }
            return info;
        } catch (err) {
            const attempts = Array.isArray(err?.attempts)
                ? err.attempts.map(a => `${a.client}${a.signedIn ? ':auth' : ''}=${a.code || a.reason || 'err'}`).join(', ')
                : '';
            let baseMsg = err?.message || 'YouTube stream resolution failed';
            if (baseMsg.startsWith('Stream resolution timeout')) {
                const done = this._recentSteps
                    .filter(s => s.t >= startedAt - 1000)
                    .slice(-8)
                    .map(s => s.label)
                    .join(', ');
                const pending = [...this._inFlightFetches.values()]
                    .map(p => `${p.tag}(${Date.now() - p.startedAt}ms)`)
                    .join(', ');
                const trace = [done ? `done: ${done}` : '', pending ? `pending: ${pending}` : '']
                    .filter(Boolean)
                    .join('; ');
                if (trace) baseMsg = `${baseMsg} [${trace}]`;
            }
            if (attempts && !baseMsg.includes(attempts)) {
                const enriched = new Error(`${baseMsg} [${attempts}]`);
                enriched.attempts = err.attempts;
                throw enriched;
            }
            throw baseMsg !== err?.message ? new Error(baseMsg) : err;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    /**
     * Normalizes all YouTube URL variations (shorts, youtu.be, embed, live) to canonical watch URL.
     * Throws immediately if an incomplete YouTube video ID is provided.
     */
    sanitizeUrl(url) {
        if (!url) return '';
        let str = '';
        if (typeof url === 'string') {
            str = url;
        } else if (typeof url === 'object' && url !== null) {
            str = url.url || url.targetUrl || '';
        } else {
            str = String(url);
        }
        const trimmed = str.trim();
        try {
            // Check for YouTube patterns
            const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]+)/i);
            if (match && match[1]) {
                const vid = match[1];
                if (vid.length < 11) {
                    throw new Error(`Incomplete YouTube link: ID "${vid}" has only ${vid.length} characters (must be 11). Please paste the complete video link.`);
                }
                return `https://www.youtube.com/watch?v=${vid.substring(0, 11)}`;
            }
            const u = new URL(trimmed);
            if (u.searchParams.has('v') && !trimmed.includes('/playlist')) {
                const vParam = u.searchParams.get('v');
                if (vParam && vParam.length < 11) {
                    throw new Error(`Incomplete YouTube link: ID "${vParam}" has only ${vParam.length} characters (must be 11). Please paste the complete video link.`);
                }
                return `https://www.youtube.com/watch?v=${(vParam || '').substring(0, 11)}`;
            }
        } catch (e) {
            if (e.message.includes('Incomplete YouTube link')) throw e;
        }
        return trimmed;
    }

    /**
     * Resolves complete metadata and available qualities for a YouTube or media URL
     */
    async resolveVideo(url) {
        if (!url) throw new Error('URL is required');

        const cleanUrl = this.sanitizeUrl(url);

        let info = null;
        let lastError = null;

        // Engine 1: Fast Ytdl with VisionOS-first priority & Mweb signed-in fallback
        try {
            info = await this._getYtdlInfo(cleanUrl, 23000);
        } catch (err1) {
            lastError = err1;
            const errStr = (err1?.message || '').toLowerCase();
            if (errStr.includes('incomplete youtube link')) {
                throw err1;
            }
            if (errStr.includes('unavailable') || errStr.includes('private') || errStr.includes('not found') || errStr.includes('404') || errStr.includes('does not exist')) {
                throw new Error("This video is unavailable or private on YouTube.");
            }
            console.warn('[MediaResolver] Ytdl client failed, falling back to oEmbed metadata:', err1.message);
        }

        // Engine 3: If all stream extractors failed, try oEmbed to at least extract metadata
        if (!info) {
            try {
                const oRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`, {
                    signal: AbortSignal.timeout(4000)
                });
                if (oRes.ok) {
                    const oData = await oRes.json();
                    const ytMatch = cleanUrl.match(/(?:watch\?v=|shorts\/)([a-zA-Z0-9_-]{11})/);
                    const vid = ytMatch ? ytMatch[1] : '';
                    return {
                        id: vid,
                        url: cleanUrl,
                        title: oData.title || 'YouTube Video',
                        author: oData.author_name || 'YouTube Creator',
                        durationSeconds: 0,
                        formattedDuration: '00:00',
                        thumbnailUrl: oData.thumbnail_url || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : ''),
                        availableQualities: ['1080p', '720p', '480p', '360p', 'MP3'],
                        availableFormats: ['MP4', 'WebM', 'MP3', 'M4A'],
                        throttledCloud: true,
                        cloudError: lastError?.message || undefined,
                        bestAudioStream: null,
                        bestVideoStream: null,
                        allFormats: []
                    };
                }
            } catch (oErr) {
                console.warn('[MediaResolver] oEmbed fallback failed:', oErr.message);
            }

            const errStr = (lastError?.message || '').toLowerCase();
            if (errStr.includes('incomplete youtube link')) {
                throw lastError;
            }
            if (errStr.includes('not a youtube video url') || errStr.includes('not a youtube watch url')) {
                throw new Error("Invalid YouTube link format. Please copy the complete video URL from the YouTube app.");
            }
            if (errStr.includes('unavailable') || errStr.includes('private') || errStr.includes('not found') || errStr.includes('404')) {
                throw new Error("This video is unavailable, private, or deleted on YouTube.");
            }
            throw new Error(lastError?.message || "YouTube throttled cloud servers for this video. Please use the SaveZonix Extension or local companion for instant downloads.");
        }

        const details = info.videoDetails;
        const formats = (info.formats || []).filter(f => Boolean(f.url));
        if (formats.length === 0) {
            return {
                id: details.videoId,
                url: details.video_url || cleanUrl,
                title: details.title || 'YouTube Video',
                author: details.author ? details.author.name : 'YouTube Creator',
                durationSeconds: parseInt(details.lengthSeconds || '0', 10),
                formattedDuration: this._formatDuration(parseInt(details.lengthSeconds || '0', 10)),
                thumbnailUrl: details.thumbnails && details.thumbnails.length > 0
                    ? details.thumbnails[details.thumbnails.length - 1].url
                    : `https://i.ytimg.com/vi/${details.videoId}/hqdefault.jpg`,
                availableQualities: ['1080p', '720p', '480p', '360p', 'MP3'],
                availableFormats: ['MP4', 'WebM', 'MP3', 'M4A'],
                throttledCloud: true,
                cloudError: 'Extractor returned formats without direct stream URLs',
                bestAudioStream: null,
                bestVideoStream: null,
                allFormats: []
            };
        }

        return this._buildResponsePayload({
            videoId: details.videoId,
            url: details.video_url || cleanUrl,
            title: details.title,
            author: details.author ? details.author.name : 'YouTube',
            durationSeconds: parseInt(details.lengthSeconds || '0', 10),
            thumbnailUrl: details.thumbnails && details.thumbnails.length > 0 
                ? details.thumbnails[details.thumbnails.length - 1].url 
                : `https://i.ytimg.com/vi/${details.videoId}/hqdefault.jpg`,
            formats
        });
    }

    _buildResponsePayload({ videoId, url, title, author, durationSeconds, thumbnailUrl, formats }) {
        const videoStreams = formats.filter(f => f.qualityLabel);
        const audioStreams = formats.filter(f => !f.qualityLabel && f.audioBitrate);

        const availableQualities = [];
        const qualityMap = new Map();

        const standardLabels = ['4K', '2160p', '1440p', '2K', '1080p', '720p', '480p', '360p'];
        for (const label of standardLabels) {
            const match = videoStreams.find(v => v.qualityLabel && v.qualityLabel.includes(label.replace('4K', '2160').replace('2K', '1440')));
            if (match && !qualityMap.has(label)) {
                qualityMap.set(label, match);
                availableQualities.push(label);
            }
        }
        if (!availableQualities.includes('MP3')) {
            availableQualities.push('MP3');
        }

        const bestAudio = this._safeChooseFormat(formats, { quality: 'highestaudio' }) || audioStreams[0] || formats.find(f => f.hasAudio) || formats[0];
        const bestVideo = this._safeChooseFormat(formats, { quality: 'highestvideo' }) || videoStreams[0] || formats.find(f => f.hasVideo) || formats[0];

        return {
            id: videoId,
            url,
            title,
            author,
            durationSeconds,
            formattedDuration: this._formatDuration(durationSeconds),
            thumbnailUrl,
            availableQualities,
            availableFormats: ['MP4', 'WebM', 'MP3', 'M4A'],
            bestAudioStream: bestAudio ? {
                url: bestAudio.url,
                mimeType: bestAudio.mimeType,
                bitrate: bestAudio.audioBitrate,
                sizeBytes: parseInt(bestAudio.contentLength || '0', 10)
            } : null,
            bestVideoStream: bestVideo ? {
                url: bestVideo.url,
                qualityLabel: bestVideo.qualityLabel,
                mimeType: bestVideo.mimeType,
                sizeBytes: parseInt(bestVideo.contentLength || '0', 10)
            } : null,
            allFormats: formats.map(f => ({
                itag: f.itag,
                qualityLabel: f.qualityLabel,
                audioBitrate: f.audioBitrate,
                mimeType: f.mimeType,
                contentLength: parseInt(f.contentLength || '0', 10),
                url: f.url
            }))
        };
    }

    /**
     * Resolves a specific requested quality format (e.g. "1080p", "720p", "MP3")
     */
    async resolveSpecificStream(url, quality = '1080p') {
        const cleanUrl = this.sanitizeUrl(url);
        let info = null;
        let lastErr = null;

        // Engine 1: Cached or live VisionOS + Mweb Ytdl pool
        try {
            info = await this._getYtdlInfo(cleanUrl, 23000);
        } catch (e1) {
            lastErr = e1;
            console.warn('[MediaResolver] Ytdl failed in resolveSpecificStream:', e1.message);
        }

        const playableFormats = (info?.formats || []).filter(f => Boolean(f.url));
        if (info && playableFormats.length > 0) {
            const formats = playableFormats;
            const title = info.videoDetails?.title || 'YouTube Video';
            const vidId = info.videoDetails?.videoId || '';
            const thumbnailUrl = info.videoDetails?.thumbnails?.length
                ? info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url
                : (vidId ? `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg` : '');

            const pickBestAudio = () =>
                formats.find(f => !f.hasVideo && f.hasAudio && f.mimeType?.includes('audio/mp4') && f.url)
                || this._safeChooseFormat(formats, { quality: 'highestaudio' })
                || formats.find(f => f.url && f.hasAudio)
                || formats[0];

            if (quality.toUpperCase() === 'MP3' || quality.toUpperCase() === 'AUDIO') {
                const audio = pickBestAudio();
                return {
                    type: 'audio',
                    stream: audio,
                    title: info.videoDetails?.title || 'YouTube Audio',
                    thumbnailUrl,
                    sizeBytes: parseInt(audio?.contentLength || '0', 10)
                };
            }

            const targetLabel = quality.toLowerCase().replace('p', '');

            // Priority 1: Combined format (video+audio in one stream) matching requested quality
            const combinedFormat = formats.find(f =>
                f.qualityLabel &&
                f.qualityLabel.toLowerCase().includes(targetLabel) &&
                f.hasAudio && f.hasVideo && f.url
            );

            if (combinedFormat) {
                return {
                    type: 'video',
                    videoStream: combinedFormat,
                    audioStream: null,
                    title,
                    thumbnailUrl,
                    sizeBytes: parseInt(combinedFormat.contentLength || '0', 10)
                };
            }

            // Priority 2: Separate video stream (prefer H.264/MP4 for instant muxing) + audio stream
            const matchingByQuality = formats.filter(f => f.qualityLabel && f.qualityLabel.toLowerCase().includes(targetLabel) && f.url && f.hasVideo);
            const video = matchingByQuality.find(f => f.mimeType?.includes('video/mp4') && f.mimeType?.includes('avc1'))
                       || matchingByQuality.find(f => f.mimeType?.includes('video/mp4'))
                       || matchingByQuality[0]
                       || formats.find(f => f.url && f.hasVideo && f.mimeType?.includes('video/mp4'))
                       || formats.find(f => f.url && f.hasVideo)
                       || this._safeChooseFormat(formats, { quality: 'highestvideo' })
                       || formats[0];
            const audio = video?.hasAudio ? null : pickBestAudio();

            return {
                type: 'video',
                videoStream: video,
                audioStream: audio,
                title,
                thumbnailUrl,
                sizeBytes: (parseInt(video?.contentLength || '0', 10)) + (parseInt(audio?.contentLength || '0', 10))
            };
        }

        throw new Error(lastErr ? lastErr.message : 'Could not resolve playable stream from YouTube.');
    }

    _formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

module.exports = new MediaResolver();
