#!/usr/bin/env node
// contracts/compile.mjs
// ─────────────────────────────────────────────────────────────
// Compiles approval.teal + clear.teal via the Algorand TestNet
// REST API and automatically updates APPROVAL_B64 / CLEAR_B64
// inside src/lib/blockchain.ts.
//
// Usage:  node contracts/compile.mjs
// Needs:  Node 18+ (uses built-in fetch)
// ─────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ALGOD_URL = "https://testnet-api.algonode.cloud";

async function compileTeal(source) {
  const res = await fetch(`${ALGOD_URL}/v2/teal/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/x-binary" },
    body: source,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TEAL compile failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json.result; // base64 string
}

async function main() {
  console.log("📦  Reading TEAL sources...");
  const approvalSrc = readFileSync(join(__dirname, "approval.teal"), "utf8");
  const clearSrc    = readFileSync(join(__dirname, "clear.teal"),    "utf8");

  console.log("🔨  Compiling approval.teal via TestNet algod...");
  const approvalB64 = await compileTeal(approvalSrc);
  console.log(`    ✅  approval → ${approvalB64.length} chars of base64`);

  console.log("🔨  Compiling clear.teal via TestNet algod...");
  const clearB64 = await compileTeal(clearSrc);
  console.log(`    ✅  clear    → ${clearB64.length} chars of base64`);

  // ── Patch blockchain.ts ──────────────────────────────────────
  const tsPath = join(root, "src", "lib", "blockchain.ts");
  let ts = readFileSync(tsPath, "utf8");

  // Replace APPROVAL_B64 = "...";
  ts = ts.replace(
    /const APPROVAL_B64\s*=\s*"[^"]*"/,
    `const APPROVAL_B64 = "${approvalB64}"`
  );
  // Replace CLEAR_B64 = "...";
  ts = ts.replace(
    /const CLEAR_B64\s*=\s*"[^"]*"/,
    `const CLEAR_B64    = "${clearB64}"`
  );

  writeFileSync(tsPath, ts, "utf8");
  console.log("✏️   Patched src/lib/blockchain.ts with compiled programs.");

  // ── Also write build artefacts ───────────────────────────────
  const { mkdirSync } = await import("fs");
  mkdirSync(join(__dirname, "build"), { recursive: true });
  writeFileSync(join(__dirname, "build", "approval.b64"), approvalB64);
  writeFileSync(join(__dirname, "build", "clear.b64"),    clearB64);
  console.log("💾  Saved contracts/build/approval.b64 and clear.b64");

  console.log("\n🎉  Done! You can now run `npm run dev` to start the app.");
}

main().catch((err) => {
  console.error("❌  Compile error:", err.message);
  process.exit(1);
});
