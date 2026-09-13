$analyzeBody = @{ url = 'https://www.pornhub.org/view_video.php?viewkey=69a9fc7b0895d' } | ConvertTo-Json
Write-Host 'Analyzing stream...'
$analyzeRes = Invoke-RestMethod -Uri 'http://localhost:5000/api/analyze' -Method Post -Body $analyzeBody -ContentType 'application/json' -TimeoutSec 60
$bestQ = $analyzeRes.qualities[0]

Write-Host "Stream ready:  |  | Est Size: "

$downloadPayload = @{
    streamUrl = $bestQ.url
    fileName = 'Caught_Stealing_Big_Step_Sister.mp4'
    format = 'MP4'
    concurrency = 8
    durationSeconds = $analyzeRes.durationSeconds
    estimatedSizeBytes = $bestQ.estimatedSizeBytes
    title = $analyzeRes.title
    originalPageUrl = 'https://www.pornhub.org/view_video.php?viewkey=69a9fc7b0895d'
    isDirectFile = $bestQ.isDirectFile
    expectedResolution = $bestQ.resolution
} | ConvertTo-Json

Write-Host 'Triggering download...'
$downloadRes = Invoke-RestMethod -Uri 'http://localhost:5000/api/download' -Method Post -Body $downloadPayload -ContentType 'application/json'
$taskId = $downloadRes.taskId
Write-Host "Task ID: $taskId"

for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 3
    $prog = Invoke-RestMethod -Uri "http://localhost:5000/api/progress/$taskId" -Method Get
    $mbDown = ($prog.totalBytesDownloaded / 1MB).ToString('F1')
    $mbTotal = ($prog.estimatedTotalBytes / 1MB).ToString('F1')
    Write-Host "[$i] Segs: $($prog.downloadedSegments)/$($prog.totalSegments) | $mbDown MB / $mbTotal MB ($($prog.percentage)%) | Speed: $($prog.speedMBps.ToString('F1')) MB/s | Status: $($prog.status)"
    
    if ($prog.isCompleted -or $prog.isError) {
        Write-Host "FINISHED! Completed: $($prog.isCompleted), Error: $($prog.isError), Msg: $($prog.errorMessage)"
        break
    }
}
