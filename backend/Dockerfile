# Stage 1: Build and Publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore dependencies first to cache the layer
COPY ["NeighborHelp.Api/NeighborHelp.Api.csproj", "NeighborHelp.Api/"]
RUN dotnet restore "NeighborHelp.Api/NeighborHelp.Api.csproj"

# Copy remaining source code and build
COPY . .
WORKDIR "/src/NeighborHelp.Api"
RUN dotnet publish "NeighborHelp.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080

COPY --from=build /app/publish .

# Run as non-root user for security compliance
USER $APP_UID
ENTRYPOINT ["dotnet", "NeighborHelp.Api.dll"]
