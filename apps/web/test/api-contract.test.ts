import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "../src/api/mockBackend.ts";
import { assertSystemStateShape } from "../src/api/response-shapes.ts";

const realApiSnapshot = {
  timestamp: "2026-08-31T12:00:00.000Z",
  conexao: { online: true, fonte: "MQTT" },
  salas: [{
    id: "sala-1",
    nome: "Sala 1",
    climatizadorId: "clima-1",
    setpoint: 22,
    temperatura: 22.6,
    umidade: 51,
    co2: 640,
    vav: { abertura: 40, estado: "ok", modo: "auto", motivo: "estavel" },
    ultimaLeitura: "2026-08-31T12:00:00.000Z",
    status: { temperatura: "normal", umidade: "normal", co2: "normal" },
    fonte: "MQTT",
  }],
  climatizadores: [{ id: "clima-1", nome: "Climatizador A", salas: ["sala-1"], ligado: true, tempInsuflamento: 15 }],
  banheiros: [{ id: "ban-1", nome: "Banheiro 1", luz: false }],
  exaustao: { ligada: false, logica: "OR" },
};

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? [shape(value[0])] : [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape((value as Record<string, unknown>)[key])]));
  }
  return typeof value;
}

test("mock and Nest /estado snapshots expose identical public shape", () => {
  const mockSnapshot = assertSystemStateShape(mock.getSystemState());
  const apiSnapshot = assertSystemStateShape(realApiSnapshot);
  assert.deepEqual(shape(mockSnapshot), shape(apiSnapshot));
});

test("invalid real snapshot is rejected before reaching UI state", () => {
  const invalid = { ...realApiSnapshot, banheiros: undefined };
  assert.throws(() => assertSystemStateShape(invalid), /Resposta \/estado invalida/);
});
