namespace backend.Models.Config;

public class StorageOptions
{
    public const string SectionName = "Storage";

    public string Provider { get; set; } = "S3";
    public S3StorageOptions S3 { get; set; } = new();
}

public class S3StorageOptions
{
    public string BucketName { get; set; } = string.Empty;
    public string Region { get; set; } = "ap-southeast-5";
    public string ServiceUrl { get; set; } = string.Empty;
    public string PublicBaseUrl { get; set; } = string.Empty;
    public bool ForcePathStyle { get; set; } = true;
    public string AccessKey { get; set; } = "test";
    public string SecretKey { get; set; } = "test";
    public bool AutoCreateBucket { get; set; } = true;
    public int MaxFileSizeMb { get; set; } = 10;
}
