const path = require('path');
const { Ytdl, chooseFormat, Client } = require('@distube/ytdl-core');

class MediaResolver {
    constructor() {
        const cookie = process.env.YOUTUBE_COOKIE || undefined;
        // VisionOS avoids JS player parsing when accepted; Mweb uses cookie + patched base.js on datacenter IPs
        this.ytdl = new Ytdl({
            clients: [Client.VisionOS, Client.Mweb],
            cookie,
            fetch: this._createPatchedFetch()
        });
        this.ytdlVisionOS = this.ytdl;
        this.ytdlFast = this.ytdl;
    }

    /**
     * Patches YouTube player JS (e.g. b485e332) where ytdl-core's stripped solver AST
     * lacks Object.prototype inheritance setup for addOnDisposeCallback.
     */
    _createPatchedFetch() {
        return async (input, init) => {
            const urlStr = typeof input === 'string' ? input : (input?.url || String(input));
            const res = await fetch(input, init);
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
     * Resolve YouTube info using VisionOS + Mweb (with signed-in cookie support if configured)
     * and abortable timeout so stalled attempts surface clear diagnostic codes.
     */
    async _getYtdlInfo(cleanUrl, timeoutMs = 18000) {
        const effectiveTimeout = Math.max(Number(timeoutMs) || 18000, 18000);
        const controller = new AbortController();
        let timer = null;
        try {
            return await Promise.race([
                this.ytdl.getInfo(cleanUrl, { signal: controller.signal }),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error(`Stream resolution timeout after ${effectiveTimeout}ms`));
                    }, effectiveTimeout);
                })
            ]);
        } catch (err) {
            const attempts = Array.isArray(err?.attempts)
                ? err.attempts.map(a => `${a.client}${a.signedIn ? ':auth' : ''}=${a.code || a.reason || 'err'}`).join(', ')
                : '';
            const baseMsg = err?.message || 'YouTube stream resolution failed';
            if (attempts && !baseMsg.includes(attempts)) {
                const enriched = new Error(`${baseMsg} [${attempts}]`);
                enriched.attempts = err.attempts;
                throw enriched;
            }
            throw err;
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

        // Engine 1: Fast Ytdl with VisionOS-first priority
        try {
            info = await this._getYtdlInfo(cleanUrl, 10000);
        } catch (err1) {
            lastError = err1;
            const errStr = (err1?.message || '').toLowerCase();
            if (errStr.includes('incomplete youtube link')) {
                throw err1;
            }
            if (errStr.includes('unavailable') || errStr.includes('private') || errStr.includes('not found') || errStr.includes('404') || errStr.includes('does not exist')) {
                throw new Error("This video is unavailable or private on YouTube.");
            }
            console.warn('[MediaResolver] Ytdl client failed, trying secondary engines:', err1.message);
        }

        // Engine 2: High-Availability Piped Cloud Proxy Fallback (Bypasses all cloud datacenter 403 blocks)
        if (!info) {
            const vidMatch = cleanUrl.match(/(?:watch\?v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            if (vidMatch && vidMatch[1]) {
                try {
                    const piped = await this._resolveViaPiped(vidMatch[1], '1080p');
                    if (piped && piped.videoStream) {
                        return {
                            id: vidMatch[1],
                            url: cleanUrl,
                            title: piped.title,
                            author: 'YouTube',
                            durationSeconds: 0,
                            formattedDuration: '00:00',
                            thumbnailUrl: `https://i.ytimg.com/vi/${vidMatch[1]}/hqdefault.jpg`,
                            availableQualities: ['1080p', '720p', '480p', '360p', 'MP3'],
                            availableFormats: ['MP4', 'WebM', 'MP3', 'M4A'],
                            bestAudioStream: null,
                            bestVideoStream: piped.videoStream,
                            allFormats: [{
                                qualityLabel: piped.videoStream.qualityLabel,
                                url: piped.videoStream.url,
                                mimeType: piped.videoStream.mimeType
                            }]
                        };
                    }
                } catch (pErr) {
                    console.warn('[MediaResolver] Piped resolveVideo fallback failed:', pErr.message);
                }
            }
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

        // Engine 1: VisionOS-first Ytdl pool
        try {
            info = await this._getYtdlInfo(cleanUrl, 10000);
        } catch (e1) {
            lastErr = e1;
            console.warn('[MediaResolver] Ytdl failed in resolveSpecificStream, trying secondary fallbacks:', e1.message);
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

        // Engine 2: Fast parallel Piped Cloud Stream Fallback (max 3.5s)
        const vidMatch = cleanUrl.match(/(?:watch\?v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (vidMatch && vidMatch[1]) {
            try {
                console.log('[MediaResolver] Attempting Piped fallback in resolveSpecificStream for:', vidMatch[1]);
                const piped = await this._resolveViaPiped(vidMatch[1], quality);
                if (piped) {
                    return piped;
                }
            } catch (pipedErr) {
                console.warn('[MediaResolver] Piped resolveSpecificStream failed:', pipedErr.message);
            }
        }

        throw new Error(lastErr ? lastErr.message : 'Could not resolve playable stream from YouTube.');
    }

    async _resolveViaPiped(videoId, quality = '1080p') {
        const instances = [
            'https://api.piped.private.coffee',
            'https://pipedapi.kavin.rocks',
            'https://pipedapi.adminforge.de'
        ];
        try {
            const data = await Promise.any(
                instances.map(async (inst) => {
                    const res = await fetch(`${inst}/streams/${videoId}`, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                        signal: AbortSignal.timeout(3500)
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const json = await res.json();
                    if (!json || (!json.videoStreams?.length && !json.audioStreams?.length)) {
                        throw new Error('Empty streams');
                    }
                    return json;
                })
            );

            const title = data.title || 'YouTube Video';
            const targetLabel = quality.toLowerCase().replace('p', '');

            if (quality.toUpperCase() === 'MP3' || quality.toUpperCase() === 'AUDIO') {
                const audio = (data.audioStreams || [])[0];
                if (audio?.url) {
                    return {
                        type: 'audio',
                        stream: { url: audio.url, mimeType: audio.mimeType || 'audio/mp4' },
                        title,
                        sizeBytes: audio.bitrate || 0
                    };
                }
            }

            const video = (data.videoStreams || []).find(v => v.quality && v.quality.includes(targetLabel) && v.url)
                       || (data.videoStreams || []).find(v => v.url)
                       || (data.videoStreams || [])[0];
            const audio = (data.audioStreams || [])[0];

            if (video?.url) {
                return {
                    type: 'video',
                    videoStream: {
                        url: video.url,
                        mimeType: video.mimeType || 'video/mp4',
                        qualityLabel: video.quality || quality,
                        hasAudio: !video.videoOnly
                    },
                    audioStream: (video.videoOnly && audio?.url) ? {
                        url: audio.url,
                        mimeType: audio.mimeType || 'audio/mp4'
                    } : null,
                    title,
                    sizeBytes: 0
                };
            }
        } catch {
            return null;
        }
        return null;
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
