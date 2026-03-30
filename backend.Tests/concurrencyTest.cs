using System.Net;
using System.Net.Http.Json;
using backend.Models.DTOs;
using Microsoft.AspNetCore.Mvc.Testing;
using FluentAssertions;
using Xunit;

namespace backend.Tests;

public class ConcurrencyTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly string[] AllowedRoles = ["handyman", "homeowner", "admin"];

    public ConcurrencyTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Register_ConcurrentRequests_ShouldOnlyAllowOneSuccess()
    {
        // 1. Setup
        var client = _factory.CreateClient();
        var email = $"race_{Guid.NewGuid()}@example.com";

        // 2. Create the request using NAMED ARGUMENTS.
        // This solves CS7036 (constructor usage) and the "Invalid email format" error.
        // Ensure these parameter names (Name, Email, Password, Role) match your RegisterRequest definition exactly.
        var registerRequest = new RegisterRequest(
            Email: email,
            Password: "SecurePassword123!",
            Name: "Test User",
            Role: AllowedRoles[1] // "homeowner"
        );

        int numberOfConcurrentRequests = 5;
        var tasks = new List<Task<HttpResponseMessage>>();

        // 3. Act: Fire requests in parallel
        for (int i = 0; i < numberOfConcurrentRequests; i++)
        {
            tasks.Add(client.PostAsJsonAsync("/api/auth/register", registerRequest));
        }

        // Wait for all to finish
        var responses = await Task.WhenAll(tasks);

        // 4. Debug: If everything failed, show why
        if (!responses.Any(r => r.IsSuccessStatusCode))
        {
            var firstError = await responses[0].Content.ReadAsStringAsync();
            throw new Exception($"All requests failed. Server said: {firstError}");
        }

        // 5. Assert: In a race condition for a unique email, exactly 1 must succeed (200 OK)
        // and the others must fail (409 Conflict)
        int successCount = responses.Count(r => r.StatusCode == HttpStatusCode.OK);
        int conflictCount = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);

        successCount.Should().Be(1, "Exactly one registration should succeed for a unique email.");
        conflictCount.Should().Be(numberOfConcurrentRequests - 1, "All other concurrent requests should return 409 Conflict.");
    }
}
