# Imagem da API do Agesto, usada pelo Render (render.yaml). Multi-arquitetura:
# o build gera a imagem para a arquitetura de quem compila.
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
