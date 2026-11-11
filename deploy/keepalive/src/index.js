// Mantém a API (Render Free) e o banco (Supabase Free) acordados.
//
// A cada 5 minutos o Cron Trigger da Cloudflare chama o /health da API:
// - a API não chega aos 15 minutos sem tráfego que a fazem dormir;
// - o /health roda um SELECT 1 no Supabase, o que evita a pausa por inatividade.
//
// Uma falha (status diferente de 200 ou timeout) lança erro, para a execução
// aparecer como falha no painel da Cloudflare (Workers > agesto-keepalive > Logs).

// A primeira chamada a uma API que dormiu leva cerca de 1 minuto.
const TIMEOUT_MS = 90_000;

export async function ping(url, fetchImpl = fetch) {
  const inicio = Date.now();
  const resposta = await fetchImpl(url, {
    headers: { "User-Agent": "agesto-keepalive" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ms = Date.now() - inicio;
  if (!resposta.ok) {
    throw new Error(`health respondeu ${resposta.status} em ${ms} ms`);
  }
  return { status: resposta.status, ms };
}

export default {
  async scheduled(_event, env) {
    const { status, ms } = await ping(env.HEALTH_URL);
    console.log(`health ${status} em ${ms} ms`);
  },
};
