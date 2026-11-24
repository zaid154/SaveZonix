const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class FFmpegService {
    constructor() {
        this.ffmpegPath = this._locateFFmpeg();
    }

    _locateFFmpeg() {
        // 1. Check if ffmpeg-static npm package is available
        try {
            const ffmpegStatic = require('ffmpeg-static');
            if (ffmpegStatic && typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
                return ffmpegStatic;
            }
        } catch (e) {}

        // 2. Check platform-specific binary in parent directory
        const isWindows = process.platform === 'win32';
        const localBinary = path.resolve(__dirname, isWindows ? '../ffmpeg.exe' : '../ffmpeg');
        if (fs.existsSync(localBinary)) {
            return localBinary;
        }

        // 3. Fallback: system ffmpeg (available on Render or Linux path)
        return 'ffmpeg';
    }

    /**
     * Mux video and audio files into a single MP4 container
     */
    async muxVideoAndAudio(videoPath, audioPath, outputPath) {
        return new Promise((resolve, reject) => {
            const args = [
                '-y',
                '-i', videoPath,
                '-i', audioPath,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart',
                outputPath
            ];

            const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

            let errorOutput = '';
            proc.stderr.on('data', (d) => {
                errorOutput += d.toString();
            });

            proc.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputPath)) {
                    resolve(outputPath);
                } else {
                    reject(new Error(`FFmpeg muxing failed with code ${code}: ${errorOutput.slice(-300)}`));
                }
            });

            proc.on('error', (err) => reject(new Error(`FFmpeg process spawn error: ${err.message}`)));
        });
    }

    /**
     * Convert an audio stream or file to clean MP3
     */
    async convertToMp3(inputAudioPath, outputMp3Path, bitrate = '320k') {
        return new Promise((resolve, reject) => {
            const args = [
                '-y',
                '-i', inputAudioPath,
                '-vn',
                '-c:a', 'libmp3lame',
                '-b:a', bitrate,
                outputMp3Path
            ];

            const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

            let errorOutput = '';
            proc.stderr.on('data', (d) => {
                errorOutput += d.toString();
            });

            proc.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputMp3Path)) {
                    resolve(outputMp3Path);
                } else {
                    reject(new Error(`FFmpeg audio conversion failed with code ${code}: ${errorOutput.slice(-300)}`));
                }
            });

            proc.on('error', (err) => reject(new Error(`FFmpeg process spawn error: ${err.message}`)));
        });
    }

    /**
     * Mux remote video stream and audio stream on the fly directly into an Express HTTP response stream.
     * Uses lightweight stream-copying for video (-c:v copy) and AAC audio encoding without touching local disk.
     */
    muxStreamToResponse(videoUrl, audioUrl, res, fileName) {
        return new Promise((resolve, reject) => {
            const asciiFilename = fileName.replace(/[^\x20-\x7E]/g, '_');
            res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

            const args = [
                '-y',
                '-user_agent', userAgent,
                '-i', videoUrl,
                '-user_agent', userAgent,
                '-i', audioUrl,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', 'frag_keyframe+empty_moov',
                '-f', 'mp4',
                'pipe:1'
            ];

            const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

            proc.stdout.pipe(res);

            let stderrLog = '';
            proc.stderr.on('data', (d) => {
                stderrLog += d.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    console.warn(`[FFmpegService] Stream muxing ended with code ${code}. Stderr: ${stderrLog.slice(-300)}`);
                    resolve(); // Pipe has finished
                }
            });

            proc.on('error', (err) => {
                console.error('[FFmpegService] Stream muxing spawn error:', err);
                if (!res.headersSent) {
                    res.status(502).json({ success: false, message: 'FFmpeg stream mux error: ' + err.message });
                }
                reject(err);
            });

            res.on('close', () => {
                try {
                    proc.kill('SIGKILL');
                } catch {}
            });
        });
    }
}

module.exports = new FFmpegService();
