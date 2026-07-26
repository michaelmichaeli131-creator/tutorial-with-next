import { cleanCode, cleanName, parseClientMessage, safeNumber } from "./protocol.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("sanitizes player identity", () => {
  assert(cleanName("  Pilot<script>  ") === "Pilotscript", "name must remove markup characters");
  assert(cleanName("") === "Pilot", "empty name must use fallback");
  assert(cleanCode(" ab-12o0 ") === "AB12O0", "room code must be normalized");
});

Deno.test("parses valid messages and rejects broken JSON", () => {
  const valid = parseClientMessage('{"type":"quick_match"}');
  assert(valid?.type === "quick_match", "valid message must parse");
  assert(parseClientMessage("not-json") === null, "invalid JSON must be rejected");
});

Deno.test("clamps numeric values", () => {
  assert(safeNumber(999, 0, 100) === 100, "upper clamp failed");
  assert(safeNumber(-4, 0, 100) === 0, "lower clamp failed");
  assert(safeNumber("12.9", 0, 100) === 12, "integer conversion failed");
});
