import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../site/pamainu-grafikas/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../site/assets/phase-5-6-8.js", import.meta.url), "utf8");

test("shift schedules expose visual cycle and shift editors, with raw JSON kept in advanced settings", () => {
  assert.match(page, /id="shift-cycle-code"/);
  assert.match(page, /id="shift-cycle-items"/);
  assert.match(page, /id="shift-definition-list"/);
  assert.match(page, /<details><summary>Papildomi nustatymai ir JSON/);
  assert.match(script, /Perkelti aukštyn/);
  assert.match(script, /Perkelti žemyn/);
  assert.match(script, /Pirmiausia pašalinkite šią žymą iš ciklo/);
  assert.match(script, /persistDraft\(\)/);
});
