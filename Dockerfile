# Multi-stage Dockerfile for SaveZonix (ASP.NET Core + FFmpeg + SQLite/MongoDB)
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY ["Zonix.csproj", "./"]
RUN dotnet restore "Zonix.csproj"

COPY . .
RUN dotnet publish "Zonix.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app

# Install FFmpeg for 1080p multiplexing
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

ENV PORT=5000
ENV ASPNETCORE_URLS=http://0.0.0.0:5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "SaveZonix.dll"]
