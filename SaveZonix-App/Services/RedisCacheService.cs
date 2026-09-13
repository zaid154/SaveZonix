using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace SaveZonix.Services;

public class RedisCacheService : IRedisCacheService
{
    private readonly IConnectionMultiplexer? _redis;
    private readonly IDatabase? _db;
    private readonly ILogger<RedisCacheService> _logger;
    private readonly ConcurrentDictionary<string, (object Value, DateTime Expiry)> _memoryFallback = new();
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public bool IsConnected => _redis != null && _redis.IsConnected;
    public string CacheProviderName => IsConnected ? "Redis v7.0 (StackExchange.Redis)" : "Memory-Cache Fallback";

    public RedisCacheService(IConfiguration config, ILogger<RedisCacheService> logger, IConnectionMultiplexer? redis = null)
    {
        _logger = logger;
        _redis = redis;

        if (_redis != null)
        {
            try
            {
                _db = _redis.GetDatabase();
                _logger.LogInformation("[Redis Cache] ⚡ Successfully connected to Redis distributed cache.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[Redis Cache Warning] Failed to initialize Redis database context: {Message}. Active in In-Memory Fallback mode.", ex.Message);
            }
        }
        else
        {
            _logger.LogInformation("[Redis Cache] Redis connection not configured. Running in high-performance Memory Fallback mode.");
        }
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return default;

        if (IsConnected && _db != null)
        {
            try
            {
                var val = await _db.StringGetAsync(key);
                if (val.HasValue)
                {
                    return JsonSerializer.Deserialize<T>(val.ToString(), _jsonOptions);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[Redis Cache] GetAsync error for key {Key}: {Message}. Checking memory fallback.", key, ex.Message);
            }
        }

        // Memory fallback
        if (_memoryFallback.TryGetValue(key, out var item))
        {
            if (DateTime.UtcNow <= item.Expiry)
            {
                if (item.Value is T typedVal) return typedVal;
                if (item.Value is string jsonStr)
                {
                    return JsonSerializer.Deserialize<T>(jsonStr, _jsonOptions);
                }
            }
            else
            {
                _memoryFallback.TryRemove(key, out _);
            }
        }

        return default;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        if (string.IsNullOrWhiteSpace(key) || value == null) return;

        var exp = expiry ?? TimeSpan.FromHours(6);
        string json = JsonSerializer.Serialize(value, _jsonOptions);

        if (IsConnected && _db != null)
        {
            try
            {
                await _db.StringSetAsync(key, json, exp);
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[Redis Cache] SetAsync error for key {Key}: {Message}. Storing in memory fallback.", key, ex.Message);
            }
        }

        _memoryFallback[key] = (value, DateTime.UtcNow.Add(exp));
    }

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiry = null)
    {
        var cached = await GetAsync<T>(key);
        if (cached != null) return cached;

        var fresh = await factory();
        if (fresh != null)
        {
            await SetAsync(key, fresh, expiry);
        }
        return fresh;
    }

    public async Task<bool> RemoveAsync(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;

        bool removed = false;
        if (IsConnected && _db != null)
        {
            try
            {
                removed = await _db.KeyDeleteAsync(key);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[Redis Cache] RemoveAsync error: {Message}", ex.Message);
            }
        }

        _memoryFallback.TryRemove(key, out _);
        return removed;
    }

    public async Task RemoveByPrefixAsync(string prefix)
    {
        if (string.IsNullOrWhiteSpace(prefix)) return;

        if (IsConnected && _redis != null)
        {
            try
            {
                var endpoints = _redis.GetEndPoints();
                foreach (var endpoint in endpoints)
                {
                    var server = _redis.GetServer(endpoint);
                    if (server.IsConnected)
                    {
                        var keys = server.Keys(pattern: prefix + "*").ToArray();
                        if (keys.Length > 0 && _db != null)
                        {
                            await _db.KeyDeleteAsync(keys);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[Redis Cache] RemoveByPrefixAsync error: {Message}", ex.Message);
            }
        }

        var toRemove = _memoryFallback.Keys.Where(k => k.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)).ToList();
        foreach (var k in toRemove)
        {
            _memoryFallback.TryRemove(k, out _);
        }
    }

    public async Task<long> IncrementAsync(string key, long value = 1, TimeSpan? expiry = null)
    {
        if (string.IsNullOrWhiteSpace(key)) return 0;

        if (IsConnected && _db != null)
        {
            try
            {
                long result = await _db.StringIncrementAsync(key, value);
                if (expiry.HasValue)
                {
                    await _db.KeyExpireAsync(key, expiry.Value);
                }
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[Redis Cache] IncrementAsync error: {Message}", ex.Message);
            }
        }

        return 1;
    }

    public async Task ClearAllAsync()
    {
        await RemoveByPrefixAsync("savezonix:");

        if (IsConnected && _redis != null)
        {
            try
            {
                var endpoints = _redis.GetEndPoints();
                foreach (var endpoint in endpoints)
                {
                    var server = _redis.GetServer(endpoint);
                    if (server.IsConnected)
                    {
                        try
                        {
                            await server.FlushDatabaseAsync();
                        }
                        catch { }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[Redis Cache] ClearAllAsync error: {Message}", ex.Message);
            }
        }

        _memoryFallback.Clear();
    }
}
