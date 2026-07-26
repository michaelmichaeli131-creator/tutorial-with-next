import { cleanCode, cleanName, cleanSkin, cleanTableName, parseClientMessage, safeNumber } from "./protocol.ts";

Deno.test("protocol sanitizers", () => {
  if (cleanName("  Pilot<script>  ") !== "Pilotscript") throw new Error("name sanitizer failed");
  if (cleanCode("a-b 12") !== "AB12") throw new Error("code sanitizer failed");
  if (cleanSkin("Solar_Gold") !== "solar_gold") throw new Error("skin sanitizer failed");
  if (cleanSkin("../../bad") !== "nova") throw new Error("unsafe skin accepted");
  if (cleanTableName("My <Arena>") !== "My Arena") throw new Error("table sanitizer failed");
  if (safeNumber(999, 0, 10) !== 10) throw new Error("number clamp failed");
});

Deno.test("parses valid client message", () => {
  const message = parseClientMessage(JSON.stringify({ type: "launch_core", seq: 3 }));
  if (!message || message.type !== "launch_core") throw new Error("message parser failed");
});
