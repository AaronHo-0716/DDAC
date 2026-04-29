using System.Text.Json;

namespace backend.Services;

public static class PaymentLedgerHelper
{
    public static string? ExtractSessionId(string? metadataJson)
    {
        if (string.IsNullOrWhiteSpace(metadataJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(metadataJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return null;

            if (!doc.RootElement.TryGetProperty("session_id", out var sessionIdNode))
                return null;

            var sessionId = sessionIdNode.GetString();
            return string.IsNullOrWhiteSpace(sessionId) ? null : sessionId.Trim();
        }
        catch
        {
            return null;
        }
    }
}
