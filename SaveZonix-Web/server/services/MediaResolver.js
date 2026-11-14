const { Ytdl, chooseFormat, Client } = require('@distube/ytdl-core');

class MediaResolver {
    constructor() {
        // Primary: VisionOS, Tv, Mweb, WebEmbedded clients do not require player.js / decipher worker threads
        // This eliminates "Could not prepare player" and worker timeout errors on cloud datacenter IPs
        this.ytdlFast = new Ytdl({
            clients: [Client.VisionOS, Client.Tv, Client.Mweb, Client.WebEmbedded]
        });
        this.ytdlDefault = new Ytdl();
    }

    /**
     * Resolves complete metadata and available qualities for a YouTube or media URL
     */
    async resolveVideo(url) {
        if (!url) throw new Error('URL is required');

        // Sanitize single video URLs: support youtu.be short links & strip dynamic mix params
        let cleanUrl = url;
        try {
            const parsed = new URL(url);
            if (parsed.hostname.includes('youtu.be')) {
                const vid = parsed.pathname.replace(/^\//, '');
                if (vid) cleanUrl = `https://www.youtube.com/watch?v=${vid}`;
            } else if (parsed.searchParams.has('v')) {
                cleanUrl = `https://www.youtube.com/watch?v=${parsed.searchParams.get('v')}`;
            }
        } catch {}

        let info;
        try {
            // Priority 1: Fast multi-client resolution without player.js worker decipher overhead
            info = await Promise.race([
                this.ytdlFast.getInfo(cleanUrl),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Fast resolution timeout')), 16000))
            ]);
        } catch (primaryErr) {
            const errStr = (primaryErr?.message || '').toLowerCase();
            if (errStr.includes('unavailable') || errStr.includes('private') || errStr.includes('not found') || errStr.includes('404') || errStr.includes('does not exist')) {
                throw new Error("This video is unavailable or private on YouTube.");
            }
            console.warn('[MediaResolver] Fast client fallback triggering for:', cleanUrl, primaryErr.message);

            // Priority 2: Fallback to standard client resolution
            try {
                const infoPromise = this.ytdlDefault.getInfo(cleanUrl);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Resolution timed out. YouTube throttled shared cloud IPs. Please use the SaveZonix Extension or local engine for instant downloads.")), 14000)
                );
                info = await Promise.race([infoPromise, timeoutPromise]);
            } catch (fallbackErr) {
                const fallbackStr = (fallbackErr?.message || '').toLowerCase();
                if (fallbackStr.includes('unavailable') || fallbackStr.includes('private') || fallbackStr.includes('not found') || fallbackStr.includes('404')) {
                    throw new Error("This video is unavailable or private on YouTube.");
                }
                throw fallbackErr;
            }
        }

        const details = info.videoDetails;

        // Group qualities and audio streams
        const formats = info.formats || [];
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
            id: details.videoId,
            url: details.video_url || url,
            title: details.title,
            author: details.author ? details.author.name : 'YouTube',
            durationSeconds: parseInt(details.lengthSeconds || '0', 10),
            formattedDuration: this._formatDuration(parseInt(details.lengthSeconds || '0', 10)),
            thumbnailUrl: details.thumbnails && details.thumbnails.length > 0 
                ? details.thumbnails[details.thumbnails.length - 1].url 
                : `https://i.ytimg.com/vi/${details.videoId}/hqdefault.jpg`,
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
        let info;
        try {
            info = await this.ytdlVision.getInfo(url);
        } catch {
            info = await this.ytdlDefault.getInfo(url);
        }
        const formats = info.formats || [];

        if (quality.toUpperCase() === 'MP3' || quality.toUpperCase() === 'AUDIO') {
            const audio = chooseFormat(formats, { quality: 'highestaudio' });
            return {
                type: 'audio',
                stream: audio,
                title: info.videoDetails.title,
                sizeBytes: parseInt(audio?.contentLength || '0', 10)
            };
        }

        const targetLabel = quality.toLowerCase().replace('p', '');
        const video = formats.find(f => f.qualityLabel && f.qualityLabel.toLowerCase().includes(targetLabel))
                   || chooseFormat(formats, { quality: 'highestvideo' });
        const audio = chooseFormat(formats, { quality: 'highestaudio' });

        return {
            type: 'video',
            videoStream: video,
            audioStream: audio,
            title: info.videoDetails.title,
            sizeBytes: (parseInt(video?.contentLength || '0', 10)) + (parseInt(audio?.contentLength || '0', 10))
        };
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
