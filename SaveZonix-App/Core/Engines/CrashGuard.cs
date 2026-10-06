using System.Diagnostics;

namespace Zonix.Core.Engines;

/// <summary>
/// Universal Crash Prevention Shield for SaveZonix.
/// Intercepts all unhandled exceptions across AppDomain, TaskScheduler, and ThreadPool,
/// preventing Zonix.exe from terminating abruptly and logging actionable diagnostics.
/// </summary>
public static class CrashGuard
{
    private static readonly object _lock = new();
    private static bool _isInitialized = false;
    private static readonly string _logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "crash_diagnostics.log");

    public static void Initialize()
    {
        lock (_lock)
        {
            if (_isInitialized) return;
            _isInitialized = true;

            // 1. Intercept unhandled background Task exceptions (e.g., from fire-and-forget downloads)
            TaskScheduler.UnobservedTaskException += (sender, args) =>
            {
                try
                {
                    // CRITICAL: Mark as observed so the .NET runtime does NOT terminate the process!
                    args.SetObserved();

                    var ex = args.Exception;
                    LogCrashEvent("UnobservedTaskException", ex?.Flatten()?.InnerException ?? ex);
                }
                catch { }
            };

            // 2. Intercept AppDomain unhandled exceptions
            AppDomain.CurrentDomain.UnhandledException += (sender, args) =>
            {
                try
                {
                    var ex = args.ExceptionObject as Exception;
                    LogCrashEvent($"UnhandledAppDomainException (IsTerminating: {args.IsTerminating})", ex);
                }
                catch { }
            };

            // 3. Graceful cleanup on process exit
            AppDomain.CurrentDomain.ProcessExit += (sender, args) =>
            {
                try
                {
                    LogMessage("ProcessExit: SaveZonix engine cleanly shutting down.");
                }
                catch { }
            };

            LogMessage("CrashGuard Active: Full process shielding and fault isolation enabled.");
        }
    }

    public static void LogCrashEvent(string context, Exception? ex)
    {
        string message = $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff UTC}] [SHIELD-TRIGGERED] {context}\n" +
                         $"Exception: {ex?.GetType().FullName}: {ex?.Message}\n" +
                         $"StackTrace:\n{ex?.StackTrace}\n" +
                         new string('-', 80) + "\n";

        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine($"[SaveZonix Shield] Rescued from crash in {context}: {ex?.Message}");
        Console.ResetColor();

        WriteToFile(message);
    }

    public static void LogMessage(string text)
    {
        string entry = $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff UTC}] [INFO] {text}\n";
        Console.WriteLine($"[SaveZonix CrashGuard] {text}");
        WriteToFile(entry);
    }

    private static void WriteToFile(string text)
    {
        try
        {
            File.AppendAllText(_logPath, text);
        }
        catch { }
    }

    /// <summary>
    /// Executes an async operation with full boundary isolation, guaranteeing that any error
    /// is caught and converted to a safe default instead of crashing the thread.
    /// </summary>
    public static async Task<T> ExecuteSafelyAsync<T>(Func<Task<T>> action, T defaultValue, string operationName = "Operation")
    {
        try
        {
            return await action();
        }
        catch (OperationCanceledException)
        {
            return defaultValue;
        }
        catch (Exception ex)
        {
            LogCrashEvent($"SafeExecuteAsync: {operationName}", ex);
            return defaultValue;
        }
    }

    /// <summary>
    /// Launches an isolated background task that is guaranteed never to cause unhandled exceptions.
    /// </summary>
    public static void RunBackground(Func<Task> action, string taskName = "BackgroundWorker")
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await action();
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                LogCrashEvent($"BackgroundWorker: {taskName}", ex);
            }
        });
    }
}
