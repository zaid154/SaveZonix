using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using SaveZonix.Core;
using SaveZonix.Models;

namespace SaveZonix.Hubs;

public class DownloadHub : Hub
{
    public async Task JoinTask(string taskId)
    {
        if (!string.IsNullOrWhiteSpace(taskId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"task_{taskId}");
        }
    }

    public async Task LeaveTask(string taskId)
    {
        if (!string.IsNullOrWhiteSpace(taskId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"task_{taskId}");
        }
    }

    public async Task JoinQueue(string queueKey)
    {
        if (!string.IsNullOrWhiteSpace(queueKey))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"queue_{queueKey}");
        }
    }

    public async Task LeaveQueue(string queueKey)
    {
        if (!string.IsNullOrWhiteSpace(queueKey))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"queue_{queueKey}");
        }
    }

    public Task<DownloadTaskState?> GetTaskState(string taskId)
    {
        return Task.FromResult(DownloadTaskManager.GetTask(taskId));
    }

    public Task RequestPauseTask(string taskId)
    {
        var task = DownloadTaskManager.GetTask(taskId);
        if (task != null)
        {
            task.Status = "Paused";
            task.Cts?.Cancel();
        }
        return Task.CompletedTask;
    }

    public Task RequestCancelTask(string taskId)
    {
        DownloadTaskManager.CancelTask(taskId);
        return Task.CompletedTask;
    }

    public override Task OnConnectedAsync()
    {
        // Add connection to global telemetry broadcast group
        Groups.AddToGroupAsync(Context.ConnectionId, "global_telemetry");
        return base.OnConnectedAsync();
    }
}
