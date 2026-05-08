namespace backend.Middleware;

public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        
        headers.Append("X-Frame-Options", "DENY");
        headers.Append("X-Content-Type-Options", "nosniff");
        headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
        headers.Append("X-XSS-Protection", "1; mode=block");

        var isSwagger = context.Request.Path.StartsWithSegments("/swagger");
        if (isSwagger)
        {
            headers.Append("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://online.swagger.io;");
        }
        else
        {
            headers.Append("Content-Security-Policy", "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';");
        }
        
        await next(context);
    }
}