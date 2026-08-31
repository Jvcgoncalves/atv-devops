import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import BathroomExhaust from "../src/components/BathroomExhaust.tsx";
import ClimatizadorPanel from "../src/components/ClimatizadorPanel.tsx";
import RoomCard from "../src/components/RoomCard.tsx";
import StatusBadge from "../src/components/StatusBadge.tsx";
import { ConfigContext } from "../src/context/ConfigContext.tsx";
import { demoContextValue, demoRoom, demoState } from "./front-fixtures.ts";
import { stopSimulation } from "../src/api/mockBackend.ts";

afterEach(() => stopSimulation());

function renderWithContext(element, value = demoContextValue) {
  return create(<ConfigContext.Provider value={value}>{element}</ConfigContext.Provider>);
}

test("StatusBadge exposes status label and semantic class", () => {
  let renderer;
  act(() => {
    renderer = create(<StatusBadge status="critico" />);
  });

  const badge = renderer.root.findByType("span");
  assert.equal(badge.props.className, "badge badge--critico");
  assert.equal(badge.children[0], "Critico");
  renderer.unmount();
});

test("BathroomExhaust sends the selected bathroom light command", () => {
  const calls = [];
  const context = { ...demoContextValue, setBathroomLight: async (...args) => calls.push(args) };
  let renderer;
  act(() => {
    renderer = renderWithContext(<BathroomExhaust banheiros={demoState.banheiros} exaustao={demoState.exaustao} />, context);
  });

  const inputs = renderer.root.findAllByType("input");
  assert.equal(inputs.length, 2);
  act(() => {
    inputs[0].props.onChange({ target: { checked: true } });
  });
  assert.deepEqual(calls, [["ban-1", true]]);
  assert.equal(renderer.root.findByProps({ children: "LIGADO" }).children[0], "LIGADO");
  renderer.unmount();
});

test("ClimatizadorPanel sends power and supply-temperature commands", () => {
  const calls = [];
  const context = { ...demoContextValue, setClimatizador: async (...args) => calls.push(args) };
  let renderer;
  act(() => {
    renderer = renderWithContext(
      <ClimatizadorPanel climatizador={demoState.climatizadores[0]} salas={demoState.salas} />,
      context,
    );
  });

  const inputs = renderer.root.findAllByType("input");
  act(() => {
    inputs[0].props.onChange({ target: { checked: false } });
  });
  act(() => {
    inputs[1].props.onChange({ target: { value: "16.5" } });
  });
  assert.deepEqual(calls, [["clima-1", { ligado: false }], ["clima-1", { tempInsuflamento: 16.5 }]]);
  renderer.unmount();
});

test("RoomCard renders ESP32 live marker and commits manual VAV changes", () => {
  const calls = [];
  const context = { ...demoContextValue, setVav: async (...args) => calls.push(args) };
  let renderer;
  act(() => {
    renderer = renderWithContext(
      <RoomCard room={{ ...demoRoom, fonte: "ESP32" }} climatizador={demoState.climatizadores[0]} />,
      context,
    );
  });

  assert.equal(renderer.root.findByProps({ children: "● AO VIVO" }).children[0], "● AO VIVO");
  const slider = renderer.root.findByType("input");
  act(() => {
    slider.props.onChange({ target: { value: "55" } });
  });
  act(() => {
    slider.props.onMouseUp({ currentTarget: { value: "55" } });
  });
  assert.deepEqual(calls, [["sala-1", 55]]);
  renderer.unmount();
});
