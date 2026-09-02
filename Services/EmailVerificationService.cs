using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace SaveZonix.Services;

public interface IEmailVerificationService
{
    bool IsDisposableEmail(string email);
    string GenerateAndStoreOtp(string email, string fullName, string password);
    (bool IsValid, string? Error, PendingRegistration? Data) VerifyOtp(string email, string otp);
    bool CanResendOtp(string email);
}

public class PendingRegistration
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddMinutes(10);
    public int ResendCount { get; set; } = 0;
    public DateTime LastResentAt { get; set; } = DateTime.UtcNow;
}

public class EmailVerificationService : IEmailVerificationService
{
    private static readonly ConcurrentDictionary<string, PendingRegistration> _pendingRegistrations = new();

    // Curated list of popular disposable / burner / temporary email domains
    private static readonly HashSet<string> _disposableDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org", "temp-mail.io",
        "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com",
        "throwawaymail.com", "yopmail.com", "yopmail.fr", "yopmail.net", "trashmail.com", "trashmail.net",
        "dispostable.com", "getairmail.com", "mohmal.com", "generator.email", "crazymailing.com",
        "sharklasers.com", "grr.la", "pokemail.net", "inboxkitten.com", "mytemp.email", "fakeinbox.com",
        "burnermail.io", "maildrop.cc", "dropmail.me", "emailondeck.com", "tempail.com", "fakemailgenerator.com",
        "harakirimail.com", "meltmail.com", "spambox.us", "jetable.org", "byom.de", "trashmail.de",
        "nada.ltd", "nada.email", "tempinbox.com", "inboxalias.com", "tempmailaddress.com", "discard.email",
        "getnada.com", "abovethecloud.top", "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu",
        "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us", "superstachel.de"
    };

    public bool IsDisposableEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return true;

        var domain = email.Split('@')[1].Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(domain)) return true;

        // Direct domain match
        if (_disposableDomains.Contains(domain)) return true;

        // Subdomain checks (e.g. mail.temp-mail.org)
        foreach (var disp in _disposableDomains)
        {
            if (domain.EndsWith("." + disp, StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    public string GenerateAndStoreOtp(string email, string fullName, string password)
    {
        var key = email.Trim().ToLowerInvariant();
        
        // Cryptographically secure 6-digit OTP (100000 - 999999)
        var otpNumber = RandomNumberGenerator.GetInt32(100000, 1000000);
        var otpString = otpNumber.ToString();

        var pending = new PendingRegistration
        {
            FullName = fullName,
            Email = key,
            Password = password,
            Otp = otpString,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            LastResentAt = DateTime.UtcNow
        };

        _pendingRegistrations[key] = pending;
        return otpString;
    }

    public (bool IsValid, string? Error, PendingRegistration? Data) VerifyOtp(string email, string otp)
    {
        var key = email.Trim().ToLowerInvariant();

        if (!_pendingRegistrations.TryGetValue(key, out var pending))
        {
            return (false, "Verification session expired. Please register again.", null);
        }

        if (DateTime.UtcNow > pending.ExpiresAt)
        {
            _pendingRegistrations.TryRemove(key, out _);
            return (false, "Verification code has expired. Please request a new code.", null);
        }

        if (!string.Equals(pending.Otp.Trim(), otp.Trim(), StringComparison.Ordinal))
        {
            return (false, "Incorrect verification code. Please check your email and try again.", null);
        }

        // Verification successful — remove from pending
        _pendingRegistrations.TryRemove(key, out _);
        return (true, null, pending);
    }

    public bool CanResendOtp(string email)
    {
        var key = email.Trim().ToLowerInvariant();
        if (_pendingRegistrations.TryGetValue(key, out var pending))
        {
            return (DateTime.UtcNow - pending.LastResentAt).TotalSeconds >= 45;
        }
        return true;
    }
}
