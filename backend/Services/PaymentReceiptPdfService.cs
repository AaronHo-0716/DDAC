using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace backend.Services;

public interface IPaymentReceiptPdfService
{
    byte[] Generate(PaymentReceiptModel model);
}

public record PaymentReceiptModel(
    string ReceiptNumber,
    DateTime PaidAtUtc,
    string JobTitle,
    Guid JobId,
    Guid PaymentId,
    string HomeownerName,
    string HomeownerEmail,
    string HandymanName,
    string HandymanEmail,
    decimal BidAmount,
    decimal SstAmount,
    decimal HomeownerPlatformFee,
    decimal HandymanPlatformFee,
    decimal HomeownerTotal,
    decimal HandymanCredit,
    string Currency,
    string? StripeSessionId,
    string? StripePaymentIntentId,
    string CompanyName,
    string CompanyAddress,
    string CompanyTaxId,
    string CompanyEmail,
    string CompanyPhone
);

public class PaymentReceiptPdfService : IPaymentReceiptPdfService
{
    public byte[] Generate(PaymentReceiptModel model)
    {
        var document = new PaymentReceiptDocument(model);
        return document.GeneratePdf();
    }

    private sealed class PaymentReceiptDocument(PaymentReceiptModel model) : IDocument
    {
        private const string BrandBlue = "#0B74FF";
        private const string BrandDark = "#111827";
        private const string BrandMuted = "#6B7280";
        private const string BrandLight = "#E5E7EB";
        private const string BrandSoftBlue = "#DBEAFE";


        public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

        public void Compose(IDocumentContainer container)
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontFamily("DejaVu Sans").FontSize(11).FontColor(BrandDark));

                page.Header().Element(ComposeHeader);
                page.Content().Element(ComposeContent);
                page.Footer().AlignCenter().Text(text =>
                {
                    text.DefaultTextStyle(x => x.FontSize(9));
                    text.Span("This is a system-generated receipt for NeighbourHelp services. ");
                    text.Span("If you have questions, contact billing.").FontColor(BrandMuted);
                });
            });
        }

        private void ComposeHeader(IContainer container)
        {
            container.Background(BrandBlue).Padding(20).Row(row =>
            {
                row.RelativeItem().Column(column =>
                {
                    column.Item().Text("NeighbourHelp").FontColor("#FFFFFF").FontSize(20).SemiBold();
                    column.Item().Text("Payment receipt").FontColor(BrandSoftBlue).FontSize(11);
                });

                row.ConstantItem(160).AlignRight().Column(column =>
                {
                    column.Item().Text("Receipt").FontColor(BrandSoftBlue).FontSize(9);
                    column.Item().Text(model.ReceiptNumber).FontColor("#FFFFFF").FontSize(12).SemiBold();
                    column.Item().Text($"Paid {FormatDate(model.PaidAtUtc)}").FontColor(BrandSoftBlue).FontSize(9);
                });
            });
        }


        private void ComposeContent(IContainer container)
        {
            container.PaddingTop(18).Column(column =>
            {
                column.Spacing(16);

                column.Item().Element(ComposeSummarySection);
                column.Item().Element(ComposePartiesSection);
                column.Item().Element(ComposeBreakdownSection);
                column.Item().Element(ComposeIdentifiersSection);
                column.Item().Element(ComposeCompanySection);
            });
        }

        private void ComposeSummarySection(IContainer container)
        {
            container.Column(column =>
            {
                column.Item().Text("Payment summary").FontSize(13).SemiBold();

                column.Item().PaddingTop(8).Row(row =>
                {
                    row.RelativeItem().Element(section =>
                    {
                        section.Column(col =>
                        {
                            col.Item().Text("Job").FontSize(9).FontColor(BrandMuted);
                            col.Item().Text(model.JobTitle).FontSize(12).SemiBold();
                            col.Item().Text($"Job ID: {model.JobId}").FontSize(9).FontColor(BrandMuted);
                        });
                    });

                    row.RelativeItem().Element(section =>
                    {
                        section.Column(col =>
                        {
                            col.Item().Text("Total paid").FontSize(9).FontColor(BrandMuted);
                            col.Item().Text(FormatMoney(model.HomeownerTotal, model.Currency))
                                .FontSize(16)
                                .SemiBold()
                                .FontColor(BrandBlue);
                            col.Item().Text($"Payment ID: {model.PaymentId}").FontSize(9).FontColor(BrandMuted);
                        });
                    });
                });
            });
        }

        private void ComposePartiesSection(IContainer container)
        {
            container.Column(column =>
            {
                column.Item().Text("Parties").FontSize(13).SemiBold();
                column.Item().PaddingTop(8).Row(row =>
                {
                    row.RelativeItem().Element(section => ComposeParty(section, "Homeowner", model.HomeownerName, model.HomeownerEmail));
                    row.RelativeItem().Element(section => ComposeParty(section, "Handyman", model.HandymanName, model.HandymanEmail));
                });
            });
        }

        private void ComposeParty(IContainer container, string label, string name, string email)
        {
            container.Border(1).BorderColor(BrandLight).Padding(10).Column(column =>
            {
                column.Item().Text(label).FontSize(9).FontColor(BrandMuted);
                column.Item().Text(name).FontSize(12).SemiBold();
                column.Item().Text(email).FontSize(10).FontColor(BrandMuted);
            });
        }

        private void ComposeBreakdownSection(IContainer container)
        {
            container.Column(column =>
            {
                column.Item().Text("Fee breakdown").FontSize(13).SemiBold();

                column.Item().PaddingTop(8).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(3);
                        columns.RelativeColumn(1);
                    });

                    AddRow(table, "Bid amount", FormatMoney(model.BidAmount, model.Currency));
                    AddRow(table, "SST (6%)", FormatMoney(model.SstAmount, model.Currency));
                    AddRow(table, "Homeowner platform fee (3%)", FormatMoney(model.HomeownerPlatformFee, model.Currency));
                    AddRow(table, "Handyman platform fee (3%)", FormatMoney(model.HandymanPlatformFee, model.Currency));
                    AddRow(table, "Handyman credit", FormatMoney(model.HandymanCredit, model.Currency));

                    table.Cell().ColumnSpan(2).PaddingTop(6).LineHorizontal(1).LineColor(BrandLight);

                    AddRow(table, "Total paid", FormatMoney(model.HomeownerTotal, model.Currency), bold: true, highlight: true);
                });
            });
        }

        private void AddRow(TableDescriptor table, string label, string value, bool bold = false, bool highlight = false)
        {
            var labelStyle = TextStyle.Default.FontSize(10).FontColor(BrandMuted);
            var valueStyle = TextStyle.Default.FontSize(10).FontColor(BrandDark);

            if (bold)
            {
                labelStyle = labelStyle.SemiBold();
                valueStyle = valueStyle.SemiBold();
            }

            if (highlight)
            {
                valueStyle = valueStyle.FontColor(BrandBlue).FontSize(12);
            }

            table.Cell().PaddingVertical(4).Text(label).Style(labelStyle);
            table.Cell().AlignRight().PaddingVertical(4).Text(value).Style(valueStyle);
        }

        private void ComposeIdentifiersSection(IContainer container)
        {
            container.Column(column =>
            {
                column.Item().Text("Transaction details").FontSize(13).SemiBold();
                column.Item().PaddingTop(8).Border(1).BorderColor(BrandLight).Padding(10).Column(details =>
                {
                    details.Item().Text($"Stripe session ID: {model.StripeSessionId ?? "N/A"}").FontSize(9).FontColor(BrandMuted);
                    details.Item().Text($"Stripe payment intent: {model.StripePaymentIntentId ?? "N/A"}").FontSize(9).FontColor(BrandMuted);
                    details.Item().Text($"Currency: {model.Currency}").FontSize(9).FontColor(BrandMuted);
                });
            });
        }

        private void ComposeCompanySection(IContainer container)
        {
            container.Column(column =>
            {
                column.Item().Text("Company details").FontSize(13).SemiBold();
                column.Item().PaddingTop(8).Border(1).BorderColor(BrandLight).Padding(10).Column(details =>
                {
                    details.Item().Text(model.CompanyName).SemiBold();
                    details.Item().Text(model.CompanyAddress).FontSize(9).FontColor(BrandMuted);
                    details.Item().Text(model.CompanyTaxId).FontSize(9).FontColor(BrandMuted);
                    details.Item().Text($"Email: {model.CompanyEmail} | Phone: {model.CompanyPhone}")
                        .FontSize(9)
                        .FontColor(BrandMuted);
                });
            });
        }

        private static string FormatMoney(decimal amount, string currency)
        {
            var culture = CultureInfo.GetCultureInfo("en-MY");
            var formatted = string.Format(culture, "{0:N2}", amount);
            return currency.ToUpperInvariant() switch
            {
                "MYR" => $"RM {formatted}",
                _ => $"{currency.ToUpperInvariant()} {formatted}"
            };
        }

        private static string FormatDate(DateTime timestampUtc)
        {
            var culture = CultureInfo.GetCultureInfo("en-MY");
            return timestampUtc.ToLocalTime().ToString("dd MMM yyyy, HH:mm", culture);
        }
    }
}
