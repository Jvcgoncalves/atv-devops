import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { ConfigProvider, useSystem } from "../src/context/ConfigContext.tsx";
import { stopSimulation } from "../src/api/mockBackend.ts";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("ConfigProvider loads mock state and propagates action updates", async () => {
  let current;
  let renderer;
  function Probe() {
    current = useSystem();
    return <span>{current.state?.salas.length ?? 0}</span>;
  }

  try {
    await act(async () => {
      renderer = create(
        <ConfigProvider>
          <Probe />
        </ConfigProvider>,
      );
      await wait(150);
    });

    assert.equal(current.mode, "mock");
    assert.equal(current.state.salas.length, 4);
    assert.equal(current.thresholds["sala-1"].co2.critical, 1000);

    await act(async () => {
      await current.setBathroomLight("ban-1", true);
      await wait(150);
    });

    assert.equal(current.state.banheiros.find((item) => item.id === "ban-1").luz, true);
    assert.equal(current.state.exaustao.ligada, true);
  } finally {
    renderer?.unmount();
    stopSimulation();
  }
});
