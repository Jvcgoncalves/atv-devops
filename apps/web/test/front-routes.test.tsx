import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.tsx";
import { ConfigContext } from "../src/context/ConfigContext.tsx";
import { stopSimulation } from "../src/api/mockBackend.ts";
import { demoContextValue } from "./front-fixtures.ts";

globalThis.ResizeObserver = function ResizeObserver() {
  this.observe = () => undefined;
  this.unobserve = () => undefined;
  this.disconnect = () => undefined;
};

afterEach(() => stopSimulation());

function renderRoute(path) {
  let renderer;
  act(() => {
    renderer = create(
      <MemoryRouter initialEntries={[path]}>
        <ConfigContext.Provider value={demoContextValue}>
          <App />
        </ConfigContext.Provider>
      </MemoryRouter>,
    );
  });
  return renderer;
}

test("application routes render their expected page titles", () => {
  const routes = [
    ["/", "Visao Geral"],
    ["/parametros", "Parametros e Alertas"],
    ["/alertas", "Central de Alertas"],
    ["/logs", "Auditoria e Rastreabilidade"],
    ["/ao-vivo", "Sensor ao Vivo (ESP32)"],
  ];

  for (const [path, title] of routes) {
    const renderer = renderRoute(path);
    assert.equal(renderer.root.findByType("h1").children[0], title);
    renderer.unmount();
  }
});

test("unknown routes redirect to dashboard", () => {
  const renderer = renderRoute("/missing");
  assert.equal(renderer.root.findByType("h1").children[0], "Visao Geral");
  renderer.unmount();
});
