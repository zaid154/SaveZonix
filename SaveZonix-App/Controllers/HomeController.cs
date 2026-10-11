using Microsoft.AspNetCore.Mvc;

namespace Zonix.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"] = "Ultra High-Speed Video Stream Downloader";
        ViewData["ActiveNav"] = "Home";
        return View();
    }

    public IActionResult Features()
    {
        ViewData["Title"] = "Features & Core Capabilities";
        ViewData["ActiveNav"] = "Features";
        return View();
    }

    public IActionResult HowItWorks()
    {
        ViewData["Title"] = "How It Works — Technical Architecture";
        ViewData["ActiveNav"] = "HowItWorks";
        return View();
    }

    public async Task<IActionResult> Download([FromServices] StreamHelper.Services.IAdminSettingsService adminSettings)
    {
        ViewData["Title"] = "Download Hub — Extension & Server";
        ViewData["ActiveNav"] = "Download";

        var settings = await adminSettings.GetAllSettingsAsync();
        var downloadUrl = settings.GetValueOrDefault("DownloadUrl", "https://github.com/zaid154/SaveZonix/releases");
        var latestVersion = settings.GetValueOrDefault("LatestAppVersion", "2.5.2");

        ViewData["AppDownloadUrl"] = downloadUrl;
        ViewData["LatestAppVersion"] = latestVersion;
        return View();
    }

    public IActionResult FAQ()
    {
        ViewData["Title"] = "Frequently Asked Questions";
        ViewData["ActiveNav"] = "FAQ";
        return View();
    }

    public IActionResult Contact()
    {
        ViewData["Title"] = "Contact & Technical Support";
        ViewData["ActiveNav"] = "Contact";
        return View();
    }

    [Route("/Home/Error")]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return RedirectToAction("Index");
    }
}
