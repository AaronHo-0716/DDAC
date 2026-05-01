namespace backend.Constants;

public enum UploadTypes { JobImage, AvatarImage, IdentityCardImage, BankStatementProof, JobConversationAtt, SupportConversationAtt }

public static class UploadConstants
{
    public static string ToPrefixString(this UploadTypes t)  => t switch
    {
        UploadTypes.JobImage => "job-images",
        UploadTypes.AvatarImage => "avatars",
        UploadTypes.IdentityCardImage => "identity-cards",
        UploadTypes.BankStatementProof => "bank-statements",
        UploadTypes.JobConversationAtt => "chat-attachment",
        UploadTypes.SupportConversationAtt => "chat-attachment",
        _ => t.ToString().ToLower()
    };
}
