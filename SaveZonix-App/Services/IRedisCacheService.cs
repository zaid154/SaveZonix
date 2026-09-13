using System;
using System.Threading.Tasks;

namespace SaveZonix.Services;

public interface IRedisCacheService
{
    bool IsConnected { get; }
    string CacheProviderName { get; }

    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null);
    Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiry = null);
    Task<bool> RemoveAsync(string key);
    Task RemoveByPrefixAsync(string prefix);
    Task<long> IncrementAsync(string key, long value = 1, TimeSpan? expiry = null);
    Task ClearAllAsync();
}
