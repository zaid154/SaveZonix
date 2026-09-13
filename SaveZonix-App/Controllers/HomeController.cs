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

    public IActionResult Download()
    {
        ViewData["Title"] = "Download Hub — Extension & Server";
        ViewData["ActiveNav"] = "Download";
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
}
