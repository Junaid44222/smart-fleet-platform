using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging.Abstractions;
using SmartFleet.Common.Diagnostics;
using Xunit;

namespace FleetService.Tests;

public class CorrelationIdMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_PreservesValidIncomingCorrelationId()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-ID"] = "request-123.a";
        var middleware = new CorrelationIdMiddleware(
            _ => Task.CompletedTask,
            NullLogger<CorrelationIdMiddleware>.Instance,
            Options.Create(new CorrelationIdOptions()));

        await middleware.InvokeAsync(context);

        Assert.Equal("request-123.a", context.Request.Headers["X-Correlation-ID"]);
        Assert.Equal("request-123.a", context.Response.Headers["X-Correlation-ID"]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("bad id")]
    [InlineData("invalid/character")]
    public async Task InvokeAsync_ReplacesInvalidIncomingCorrelationId(string invalidId)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-ID"] = invalidId;
        var middleware = new CorrelationIdMiddleware(
            _ => Task.CompletedTask,
            NullLogger<CorrelationIdMiddleware>.Instance,
            Options.Create(new CorrelationIdOptions()));

        await middleware.InvokeAsync(context);

        var correlationId = context.Response.Headers["X-Correlation-ID"].ToString();
        Assert.NotEqual(invalidId, correlationId);
        Assert.Matches("^[0-9a-f]{32}$", correlationId);
    }

    [Fact]
    public async Task InvokeAsync_UsesConfiguredHeaderAndMaximumLength()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Request-ID"] = new string('a', 33);
        var middleware = new CorrelationIdMiddleware(
            _ => Task.CompletedTask,
            NullLogger<CorrelationIdMiddleware>.Instance,
            Options.Create(new CorrelationIdOptions
            {
                HeaderName = "X-Request-ID",
                MaxLength = 32
            }));

        await middleware.InvokeAsync(context);

        var correlationId = context.Response.Headers["X-Request-ID"].ToString();
        Assert.Matches("^[0-9a-f]{32}$", correlationId);
    }
}
