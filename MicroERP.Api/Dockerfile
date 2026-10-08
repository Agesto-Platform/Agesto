# Imagem da API do Agesto. Multi-arquitetura: na VM Oracle (Ampere A1) o
# build gera ARM64 automaticamente; localmente gera a arquitetura da máquina.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY MicroERP.Api.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
# Imagem aspnet do .NET 8 já roda como usuário não-root "app".
USER app
ENTRYPOINT ["dotnet", "MicroERP.Api.dll"]
