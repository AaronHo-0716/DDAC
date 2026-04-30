namespace backend.Models.Config;

public class SiteOptions
{
    public const string SectionName = "SiteSettings";
    public string FrontendUrl { get; set; } = string.Empty;
}