# Stage 1: Build and Publish
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore dependencies first to cache the layer
COPY ["backend.csproj", "./"]
RUN dotnet restore "backend.csproj"

# Copy remaining source code and build
COPY . .
RUN dotnet publish "backend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080

COPY --from=build /app/publish .

# Run as non-root user for security compliance
USER $APP_UID
ENTRYPOINT ["dotnet", "backend.dll"]
