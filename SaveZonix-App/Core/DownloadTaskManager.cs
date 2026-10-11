using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using SaveZonix.Models;

namespace SaveZonix.Core;

public static class DownloadTaskManager
{
    private static readonly ConcurrentDictionary<string, DownloadTaskState> _tasks = new();

    public static ConcurrentDictionary<string, DownloadTaskState> Tasks => _tasks;

    public static bool IsTaskActive(string taskId) =>
        _tasks.TryGetValue(taskId, out var s) && !s.IsCompleted && !s.IsError && !s.IsPaused;

    public static ISet<string> GetActiveTaskIds() =>
        _tasks.Where(kv => !kv.Value.IsCompleted && !kv.Value.IsError && !kv.Value.IsPaused).Select(kv => kv.Key).ToHashSet();

    public static List<DownloadTaskState> GetActiveSingleTasks() =>
        _tasks.Where(kv => !kv.Value.IsCompleted && !kv.Value.IsError && !kv.Value.IsPaused).Select(kv => kv.Value).ToList();

    public static bool CancelTask(string taskId)
    {
        if (_tasks.TryGetValue(taskId, out var state))
        {
            state.Cts?.Cancel();
            state.IsPaused = true;
            state.Status = "Download Cancelled";
            return true;
        }
        return false;
    }

    public static void CancelAllTasks()
    {
        foreach (var kvp in _tasks)
        {
            var s = kvp.Value;
            if (!s.IsCompleted && !s.IsError)
            {
                try { s.Cts?.Cancel(); } catch { }
                s.IsPaused = true;
                s.Status = "Cancelled";
            }
        }
    }

    public static void RegisterTask(string taskId, DownloadTaskState state)
    {
        _tasks[taskId] = state;
    }

    public static DownloadTaskState? GetTask(string taskId)
    {
        _tasks.TryGetValue(taskId, out var state);
        return state;
    }
}
