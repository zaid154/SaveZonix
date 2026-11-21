const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class FFmpegService {
    constructor() {
        this.ffmpegPath = this._locateFFmpeg();
    }

    _locateFFmpeg() {
        // Check platform-specific binary (Windows .exe vs Linux)
        const isWindows = process.platform === 'win32';
        const localBinary = path.resolve(__dirname, isWindows ? '../ffmpeg.exe' : '../ffmpeg');
        if (fs.existsSync(localBinary)) {
            return localBinary;
        }
        // Fallback: system ffmpeg (available on Render with apt-get install ffmpeg)
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
}

module.exports = new FFmpegService();
