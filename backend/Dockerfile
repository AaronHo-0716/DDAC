FROM mcr.microsoft.com/dotnet/sdk:8.0
WORKDIR /app

# Enable Hot Reload for Docker
ENV DOTNET_USE_POLLING_FILE_WATCHER=1
ENV ASPNETCORE_ENVIRONMENT=Development

# Copy csproj and restore as distinct layers for faster builds
COPY *.csproj ./
RUN dotnet restore

# Copy everything else
COPY . .

# Expose the internal port
EXPOSE 8080

# Use dotnet watch to run the app. 
# --non-interactive prevents the tool from waiting for keyboard input
ENTRYPOINT ["dotnet", "watch", "run", "--urls", "http://0.0.0.0:8080", "--non-interactive"]
