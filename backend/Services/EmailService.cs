using System.Net;
using System.Net.Mail;

namespace backend.Services;

public interface IEmailService 
{
    Task SendEmailAsync(string to, string subject, string body);
}

public class EmailService(IConfiguration config) : IEmailService
{
    public async Task SendEmailAsync(string to, string subject, string body)
    {
        // Use Mailpit/Mailtrap for local dev, or SendGrid/AWS SES for cloud
        var smtpClient = new SmtpClient(config["Email:Host"])
        {
            Port = config.GetValue<int>("Email:Port"),
            Credentials = new NetworkCredential(config["Email:User"], config["Email:Pass"]),
            EnableSsl = config.GetValue<bool>("Email:EnableSsl"),
        };

        var mailMessage = new MailMessage
        {
            From = new MailAddress(config["Email:From"]!),
            Subject = subject,
            Body = body,
            IsBodyHtml = true,
        };
        mailMessage.To.Add(to);

        await smtpClient.SendMailAsync(mailMessage);
    }
}