import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_API_BASE, resolveApiBase, resolveApiMode } from "../src/api/runtime-config.ts";

test("real API mode is opt-in; missing or invalid values stay mock", () => {
  assert.equal(resolveApiMode("real"), "real");
  assert.equal(resolveApiMode("mock"), "mock");
  assert.equal(resolveApiMode(undefined), "mock");
  assert.equal(resolveApiMode("staging"), "mock");
});

test("API base defaults to /api and removes trailing slashes", () => {
  assert.equal(resolveApiBase(undefined), DEFAULT_API_BASE);
  assert.equal(resolveApiBase(""), DEFAULT_API_BASE);
  assert.equal(resolveApiBase(" /api/ "), "/api");
  assert.equal(resolveApiBase("https://api.example.test/v1///"), "https://api.example.test/v1");
});
