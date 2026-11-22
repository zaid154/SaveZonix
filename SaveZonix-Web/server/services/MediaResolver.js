const { Ytdl, chooseFormat, Client } = require('@distube/ytdl-core');
let play = null;
try {
    play = require('play-dl');
} catch {}

class MediaResolver {
    constructor() {
        const cookie = process.env.YOUTUBE_COOKIE || undefined;
        // Priority 1: Client.Tv generates direct unthrottled googlevideo.com URLs without player.js worker decipher overhead
        // WebEmbedded is a secondary fallback that accepts cookies
        this.ytdlFast = new Ytdl({
            clients: [Client.Tv, Client.WebEmbedded],
            cookie
        });
        this.ytdlDefault = new Ytdl({
            clients: [Client.Tv, Client.VisionOS, Client.WebEmbedded],
            cookie
        });
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

        // Engine 1: Fast Ytdl with Tv client (direct googlevideo URLs, no player decipher)
        try {
            info = await Promise.race([
                this.ytdlFast.getInfo(cleanUrl),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Tv client resolution timeout')), 12000))
            ]);
        } catch (err1) {
            lastError = err1;
            const errStr = (err1?.message || '').toLowerCase();
            if (errStr.includes('incomplete youtube link')) {
                throw err1;
            }
            if (errStr.includes('unavailable') || errStr.includes('private') || errStr.includes('not found') || errStr.includes('404') || errStr.includes('does not exist')) {
                throw new Error("This video is unavailable or private on YouTube.");
            }
            console.warn('[MediaResolver] Fast Tv client failed, trying secondary client:', err1.message);
        }

        // Engine 2: Default Ytdl with multi-clients fallback
        if (!info) {
            try {
                info = await Promise.race([
                    this.ytdlDefault.getInfo(cleanUrl),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Secondary client resolution timeout')), 12000))
                ]);
            } catch (err2) {
                lastError = err2;
                console.warn('[MediaResolver] Secondary Ytdl client failed:', err2.message);
            }
        }

        // Engine 3: play-dl fallback
        if (!info && play) {
            try {
                console.log('[MediaResolver] Attempting play-dl fallback for:', cleanUrl);
                const pInfo = await Promise.race([
                    play.video_info(cleanUrl),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('play-dl timeout')), 10000))
                ]);
                if (pInfo && pInfo.video_details) {
                    const vd = pInfo.video_details;
                    const pFormats = (pInfo.format || []).map(f => ({
                        itag: f.itag,
                        qualityLabel: f.qualityLabel,
                        audioBitrate: f.audioBitrate,
                        mimeType: f.mimeType,
                        contentLength: parseInt(f.contentLength || '0', 10),
                        url: f.url
                    }));
                    return this._buildResponsePayload({
                        videoId: vd.id,
                        url: vd.url || cleanUrl,
                        title: vd.title,
                        author: vd.channel ? vd.channel.name : 'YouTube',
                        durationSeconds: vd.durationInSec || 0,
                        thumbnailUrl: vd.thumbnails && vd.thumbnails.length > 0 
                            ? vd.thumbnails[vd.thumbnails.length - 1].url 
                            : `https://i.ytimg.com/vi/${vd.id}/hqdefault.jpg`,
                        formats: pFormats
                    });
                }
            } catch (err3) {
                lastError = err3;
                console.warn('[MediaResolver] play-dl fallback failed:', err3.message);
            }
        }

        // Engine 4: If all stream extractors failed, try oEmbed to at least extract metadata
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
            throw new Error("YouTube throttled cloud servers for this video. Please use the SaveZonix Extension or local companion for instant downloads.");
        }

        const details = info.videoDetails;
        const formats = info.formats || [];

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

        const bestAudio = chooseFormat(formats, { quality: 'highestaudio' }) || audioStreams[0];
        const bestVideo = chooseFormat(formats, { quality: 'highestvideo' }) || videoStreams[0];

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

        try {
            info = await this.ytdlFast.getInfo(cleanUrl);
        } catch (e1) {
            lastErr = e1;
            try {
                info = await this.ytdlDefault.getInfo(cleanUrl);
            } catch (e2) {
                lastErr = e2;
                console.warn('[MediaResolver] Both ytdl clients failed in resolveSpecificStream:', e2.message);
            }
        }

        if (info && info.formats && info.formats.length > 0) {
            const formats = info.formats || [];

            if (quality.toUpperCase() === 'MP3' || quality.toUpperCase() === 'AUDIO') {
                const audio = chooseFormat(formats, { quality: 'highestaudio' }) || formats[0];
                return {
                    type: 'audio',
                    stream: audio,
                    title: info.videoDetails?.title || 'YouTube Audio',
                    sizeBytes: parseInt(audio?.contentLength || '0', 10)
                };
            }

            const targetLabel = quality.toLowerCase().replace('p', '');

            // Priority 1: Combined format (video+audio in one stream) — no FFmpeg muxing needed on cloud
            const combinedFormat = formats.find(f =>
                f.qualityLabel &&
                f.qualityLabel.toLowerCase().includes(targetLabel) &&
                f.hasAudio && f.hasVideo
            );
            if (combinedFormat) {
                return {
                    type: 'video',
                    videoStream: combinedFormat,
                    audioStream: null,
                    title: info.videoDetails?.title || 'YouTube Video',
                    sizeBytes: parseInt(combinedFormat.contentLength || '0', 10)
                };
            }

            // Priority 2: Separate video + audio streams
            const video = formats.find(f => f.qualityLabel && f.qualityLabel.toLowerCase().includes(targetLabel))
                       || chooseFormat(formats, { quality: 'highestvideo' })
                       || formats[0];
            const audio = chooseFormat(formats, { quality: 'highestaudio' }) || formats[0];

            return {
                type: 'video',
                videoStream: video,
                audioStream: audio,
                title: info.videoDetails?.title || 'YouTube Video',
                sizeBytes: (parseInt(video?.contentLength || '0', 10)) + (parseInt(audio?.contentLength || '0', 10))
            };
        }

        // Engine 2: play-dl fallback when @distube/ytdl-core fails on Render
        if (play) {
            try {
                console.log('[MediaResolver] Attempting play-dl fallback in resolveSpecificStream for:', cleanUrl);
                const pInfo = await Promise.race([
                    play.video_info(cleanUrl),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('play-dl timeout')), 10000))
                ]);
                if (pInfo && pInfo.video_details) {
                    const formats = pInfo.format || [];
                    const title = pInfo.video_details.title || 'YouTube Video';

                    if (quality.toUpperCase() === 'MP3' || quality.toUpperCase() === 'AUDIO') {
                        const audioOnly = formats.filter(f => !f.qualityLabel && f.url);
                        const bestAudio = audioOnly.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0] || formats[0];
                        return {
                            type: 'audio',
                            stream: { url: bestAudio?.url, mimeType: bestAudio?.mimeType },
                            title,
                            sizeBytes: parseInt(bestAudio?.contentLength || '0', 10)
                        };
                    }

                    const targetLabel = quality.toLowerCase().replace('p', '');
                    const matchingVideo = formats.find(f => f.qualityLabel && f.qualityLabel.includes(targetLabel) && f.url)
                                       || formats.filter(f => f.qualityLabel && f.url).sort((a, b) => parseInt(b.qualityLabel || '0') - parseInt(a.qualityLabel || '0'))[0]
                                       || formats[0];

                    return {
                        type: 'video',
                        videoStream: { url: matchingVideo?.url, mimeType: matchingVideo?.mimeType, qualityLabel: matchingVideo?.qualityLabel },
                        audioStream: null,
                        title,
                        sizeBytes: parseInt(matchingVideo?.contentLength || '0', 10)
                    };
                }
            } catch (playErr) {
                console.warn('[MediaResolver] play-dl resolveSpecificStream fallback failed:', playErr.message);
            }
        }

        throw new Error(lastErr ? lastErr.message : 'Could not resolve stream from YouTube.');
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
