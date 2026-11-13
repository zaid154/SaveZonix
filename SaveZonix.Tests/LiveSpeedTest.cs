using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using Xunit.Abstractions;
using Zonix.Core;
using YoutubeExplode;
using YoutubeExplode.Videos.Streams;

namespace SaveZonix.Tests;

public class LiveSpeedTest
{
    private readonly ITestOutputHelper _output;

    public LiveSpeedTest(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task LiveTest_YouTubeAudio_TurboSpeedDownload()
    {
        string videoId = "H7aOCLPhuZo"; // "Tu Tu Hai Wahi | The Royals" from user's screen
        string tempDir = Path.Combine(Path.GetTempPath(), "savezonix_live_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var ytClient = YouTubeClientFactory.SharedClient;
            _output.WriteLine($"[Test] Fetching stream manifest for video: {videoId}...");
            var manifest = await ytClient.Videos.Streams.GetManifestAsync(videoId);

            var audioStreams = manifest.GetAudioOnlyStreams().ToList();
            var bestAudio = audioStreams.OrderByDescending(s => s.Bitrate).FirstOrDefault();
            Assert.NotNull(bestAudio);

            _output.WriteLine($"[Test] Audio Stream Found: Bitrate={bestAudio.Bitrate}, Size={bestAudio.Size.Bytes / 1024.0 / 1024.0:F2} MB, Container={bestAudio.Container}");

            var downloader = new ParallelDownloader();
            string audioTempDir = Path.Combine(tempDir, "audio_chunks");

            long lastReportedBytes = 0;
            double reportedSpeed = 0.0;
            var progress = new Progress<DownloadProgressReport>(p =>
            {
                lastReportedBytes = p.TotalBytesDownloaded;
                reportedSpeed = p.SpeedMBps;
                _output.WriteLine($"[Download Progress] {p.Percentage:F1}% | Speed: {p.SpeedMBps:F2} MB/s | Threads: {p.ActiveThreads} | Status: {p.Status}");
            });

            var sw = Stopwatch.StartNew();
            var chunks = await downloader.DownloadDirectFileAsync(
                bestAudio.Url, 
                audioTempDir, 
                bestAudio.Size.Bytes, 
                maxConcurrency: 8, 
                progress: progress, 
                cancellationToken: CancellationToken.None);
            sw.Stop();

            double elapsedSec = sw.Elapsed.TotalSeconds;
            long totalBytes = chunks.Sum(c => c.SizeBytes);
            double speedMBps = (totalBytes / 1024.0 / 1024.0) / Math.Max(0.01, elapsedSec);

            _output.WriteLine("==================================================");
            _output.WriteLine($"⚡ RESULT - AUDIO DOWNLOAD TEST:");
            _output.WriteLine($"   File Size: {totalBytes / 1024.0 / 1024.0:F2} MB ({totalBytes:N0} bytes)");
            _output.WriteLine($"   Time Taken: {elapsedSec:F2} seconds");
            _output.WriteLine($"   Average Speed: {speedMBps:F2} MB/s");
            _output.WriteLine($"   Chunks Sliced: {chunks.Count} slices");
            _output.WriteLine("==================================================");

            Assert.NotEmpty(chunks);
            Assert.True(chunks.All(c => c.IsDownloaded && File.Exists(c.LocalTempPath)));
            Assert.True(elapsedSec < 10.0, $"Download took too long: {elapsedSec}s");

            // Merge test
            string mergedAudio = Path.Combine(tempDir, "final_song.mp3");
            bool merged = await SegmentMerger.MergeSegmentsAsync(chunks, mergedAudio, audioTempDir);
            Assert.True(merged, "Segment merger failed");
            Assert.True(File.Exists(mergedAudio), "Merged file does not exist");
            Assert.True(new FileInfo(mergedAudio).Length > 0, "Merged file is empty");

            _output.WriteLine($"✔ Audio file successfully merged: {mergedAudio} (Size: {new FileInfo(mergedAudio).Length:N0} bytes)");
        }
        finally
        {
            try { Directory.Delete(tempDir, true); } catch { }
        }
    }

    [Fact]
    public async Task LiveTest_YouTubeVideo_TurboSpeedDownload()
    {
        string videoId = "gmQu5XWgmPk"; // "Uyi Amma" from user's screen
        string tempDir = Path.Combine(Path.GetTempPath(), "savezonix_vid_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var ytClient = YouTubeClientFactory.SharedClient;
            _output.WriteLine($"[Test] Fetching video stream manifest for: {videoId}...");
            var manifest = await ytClient.Videos.Streams.GetManifestAsync(videoId);

            var videoStreams = manifest.GetVideoStreams().ToList();
            // Pick 720p or 1080p stream
            var targetVideo = videoStreams.FirstOrDefault(s => s.VideoQuality.Label.Contains("720"))
                           ?? videoStreams.FirstOrDefault(s => s.VideoQuality.Label.Contains("1080"))
                           ?? videoStreams.OrderByDescending(s => s.VideoQuality).FirstOrDefault();
            Assert.NotNull(targetVideo);

            _output.WriteLine($"[Test] Video Stream: Quality={targetVideo.VideoQuality.Label}, Size={targetVideo.Size.Bytes / 1024.0 / 1024.0:F2} MB, Container={targetVideo.Container}");

            var downloader = new ParallelDownloader();
            string vidTempDir = Path.Combine(tempDir, "video_chunks");

            var progress = new Progress<DownloadProgressReport>(p =>
            {
                _output.WriteLine($"[Video Progress] {p.Percentage:F1}% | Speed: {p.SpeedMBps:F2} MB/s | Threads: {p.ActiveThreads} | Status: {p.Status}");
            });

            var sw = Stopwatch.StartNew();
            var chunks = await downloader.DownloadDirectFileAsync(
                targetVideo.Url, 
                vidTempDir, 
                targetVideo.Size.Bytes, 
                maxConcurrency: 16, 
                progress: progress, 
                cancellationToken: CancellationToken.None);
            sw.Stop();

            double elapsedSec = sw.Elapsed.TotalSeconds;
            long totalBytes = chunks.Sum(c => c.SizeBytes);
            double speedMBps = (totalBytes / 1024.0 / 1024.0) / Math.Max(0.01, elapsedSec);

            _output.WriteLine("==================================================");
            _output.WriteLine($"⚡ RESULT - VIDEO DOWNLOAD TEST:");
            _output.WriteLine($"   Quality: {targetVideo.VideoQuality.Label}");
            _output.WriteLine($"   File Size: {totalBytes / 1024.0 / 1024.0:F2} MB ({totalBytes:N0} bytes)");
            _output.WriteLine($"   Time Taken: {elapsedSec:F2} seconds");
            _output.WriteLine($"   Average Speed: {speedMBps:F2} MB/s");
            _output.WriteLine($"   Chunks Sliced: {chunks.Count} slices");
            _output.WriteLine("==================================================");

            Assert.NotEmpty(chunks);
            Assert.True(chunks.All(c => c.IsDownloaded && File.Exists(c.LocalTempPath)));

            string mergedVideo = Path.Combine(tempDir, "final_video.mp4");
            bool merged = await SegmentMerger.MergeSegmentsAsync(chunks, mergedVideo, vidTempDir);
            Assert.True(merged, "Video segment merger failed");
            Assert.True(File.Exists(mergedVideo));
            Assert.True(new FileInfo(mergedVideo).Length > 0);

            _output.WriteLine($"✔ Video file successfully merged: {mergedVideo} (Size: {new FileInfo(mergedVideo).Length:N0} bytes)");
        }
        finally
        {
            try { Directory.Delete(tempDir, true); } catch { }
        }
    }
}
