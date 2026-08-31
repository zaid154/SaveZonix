# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY ["Zonix.csproj", "./"]
RUN dotnet restore "Zonix.csproj"

COPY . .
RUN dotnet publish "Zonix.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "Zonix.dll"]
