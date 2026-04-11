namespace backend.Middleware;

public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers.Append("X-Frame-Options", "DENY");
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
        context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

        // Check if the request is for Swagger
        var isSwagger = context.Request.Path.StartsWithSegments("/swagger");

        if (isSwagger)
        {
            // Relaxed CSP for Swagger UI to work
            context.Response.Headers.Append("Content-Security-Policy", 
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data: https://online.swagger.io;");
        }
        else
        {
            // Strict CSP for the rest of the API
            context.Response.Headers.Append("Content-Security-Policy", 
                "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';");
        }
        
        await next(context);
    }
}
