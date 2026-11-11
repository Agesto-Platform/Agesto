// Teste rápido, sem dependências: node --test deploy/keepalive/src
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { ping } from "./index.js";

const resposta = (status) => async () => new Response("", { status });

test("health 200 resolve com o status e o tempo", async () => {
  const r = await ping("https://api.exemplo/health", resposta(200));
  assert.equal(r.status, 200);
  assert.ok(r.ms >= 0);
});

test("health fora do ar lança erro, para a execução aparecer como falha", async () => {
  await assert.rejects(() => ping("https://api.exemplo/health", resposta(503)), /503/);
});

test("o agendamento chama a URL configurada", async () => {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    chamadas.push(url);
    return new Response("", { status: 200 });
  };
  try {
    await worker.scheduled({}, { HEALTH_URL: "https://api.exemplo/health" });
  } finally {
    globalThis.fetch = original;
  }
  assert.deepEqual(chamadas, ["https://api.exemplo/health"]);
});
