namespace backend.Constants;

public enum UploadTypes { JobImage, AvatarImage, IdentityCardImage }

public static class UploadConstants
{
    public static string ToPrefixString(this UploadTypes t)  => t switch
    {
        UploadTypes.JobImage => "job-images",
        UploadTypes.AvatarImage => "avatars",
        UploadTypes.IdentityCardImage => "identity-cards",
        _ => t.ToString().ToLower()
    };
}