using Microsoft.AspNetCore.Mvc;

namespace Zonix.Controllers;

public class LegalController : Controller
{
    public IActionResult Privacy()
    {
        ViewData["Title"] = "Privacy Policy & Zero-Telemetry Transparency";
        return View();
    }

    public IActionResult Terms()
    {
        ViewData["Title"] = "Terms of Service & User Agreement";
        return View();
    }

    public IActionResult Copyright()
    {
        ViewData["Title"] = "Copyright Policy & Intellectual Property Protection";
        return View();
    }

    public IActionResult DMCA()
    {
        ViewData["Title"] = "DMCA & Copyright Takedown Procedure";
        return View();
    }

    public IActionResult Disclaimer()
    {
        ViewData["Title"] = "Legal Disclaimer & Neutral Technology Notice";
        return View();
    }

    public IActionResult Cookies()
    {
        ViewData["Title"] = "Cookie Policy & Local Storage Transparency";
        return View();
    }

    public IActionResult AcceptableUse()
    {
        ViewData["Title"] = "Acceptable Use Policy (AUP)";
        return View();
    }

    public IActionResult Grievance()
    {
        ViewData["Title"] = "Grievance Officer & Legal Escalation Contact";
        return View();
    }
}
