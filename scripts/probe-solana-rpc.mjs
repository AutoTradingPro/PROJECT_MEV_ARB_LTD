import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv(file) {
  const map = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function first(env, keys) {
  for (const k of keys) {
    const v = (env[k] || "").trim();
    if (v) return { key: k, url: v };
  }
  return { key: "", url: "" };
}

function redact(u) {
  try {
    const x = new URL(u);
    const parts = x.pathname.split("/").filter(Boolean);
    const pathBit =
      parts.length > 0 ? `/${parts[0]}/***${parts.length > 1 ? "" : ""}` : "";
    return `${x.protocol}//${x.host}${parts.length ? "/***" : ""}`;
  } catch {
    return "(bad-url)";
  }
}

async function httpSlot(url, label) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [{ commitment: "processed" }],
      }),
    });
    const j = await res.json();
    const ms = Date.now() - t0;
    if (!res.ok) {
      return { label, ok: false, ms, detail: `HTTP ${res.status}`, host: redact(url) };
    }
    if (j.error) {
      return {
        label,
        ok: false,
        ms,
        detail: j.error.message || "rpc-error",
        host: redact(url),
      };
    }
    const slot = j.result;
    return {
      label,
      ok: typeof slot === "number" && slot > 0,
      ms,
      detail: `slot=${slot}`,
      host: redact(url),
    };
  } catch (e) {
    return {
      label,
      ok: false,
      ms: Date.now() - t0,
      detail: e instanceof Error ? e.message : String(e),
      host: redact(url),
    };
  }
}

function wssSlot(url, label, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let done = false;
    let ws;
    const finish = (ok, detail) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      resolve({ label, ok, ms: Date.now() - t0, detail, host: redact(url) });
    };
    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
    try {
      ws = new WebSocket(url);
    } catch (e) {
      finish(false, e instanceof Error ? e.message : String(e));
      return;
    }
    ws.on("open", () => {
      ws.send(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "slotSubscribe", params: [] })
      );
      // also ask getSlot over WS as fallback
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getSlot",
          params: [{ commitment: "processed" }],
        })
      );
    });
    ws.on("message", (buf) => {
      try {
        const j = JSON.parse(String(buf));
        if (j.method === "slotNotification") {
          const slot = j.params?.result?.slot ?? j.params?.result;
          finish(true, `slotNotify=${slot}`);
          return;
        }
        if (j.id === 1 && typeof j.result === "number") {
          finish(true, `subId=${j.result}`);
          return;
        }
        if (j.id === 2 && typeof j.result === "number" && j.result > 0) {
          finish(true, `wsGetSlot=${j.result}`);
          return;
        }
        if (j.error) {
          finish(false, j.error.message || "wss-error");
        }
      } catch {
        /* ignore */
      }
    });
    ws.on("error", (e) => finish(false, e.message || "ws-error"));
    ws.on("close", () => {
      if (!done) finish(false, "closed-before-slot");
    });
  });
}

function print(r) {
  const mark = r.ok ? "OK  " : "FAIL";
  console.log(`${mark}  ${r.label}  ${r.host}  ${r.ms}ms  ${r.detail}`);
}

const env = loadEnv(path.join(root, ".env.local"));
const scanHttp = first(env, [
  "ANKR_SOLANA_RPC_URL",
  "SOLANA_RPC_URL",
  "RPC_HTTP_URL_SOLANA",
]);
const scanWs = first(env, [
  "ANKR_SOLANA_WSS_URL",
  "SOLANA_WSS_URL",
  "SOLANA_WS_URL",
  "RPC_WSS_URL_SOLANA",
]);
const execHttp = first(env, [
  "SOLANA_EXECUTOR_RPC_URL",
  "QUICKNODE_SOLANA_RPC_URL",
  "SOLANA_EXEC_RPC_URL",
]);
const execWs = first(env, [
  "SOLANA_EXECUTOR_WS_URL",
  "QUICKNODE_SOLANA_WS_URL",
  "SOLANA_EXEC_WS_URL",
]);
const fbHttp = first(env, ["SOLANA_RPC_URL_2"]);
const fbWs = first(env, ["SOLANA_WS_URL_2"]);

console.log("=== Solana RPC / WSS probe ===");
const httpJobs = [];
if (scanHttp.url) httpJobs.push(httpSlot(scanHttp.url, `SCAN-HTTP (${scanHttp.key})`));
if (execHttp.url) httpJobs.push(httpSlot(execHttp.url, `EXEC-HTTP (${execHttp.key})`));
if (fbHttp.url) httpJobs.push(httpSlot(fbHttp.url, `FALLBACK-HTTP (${fbHttp.key})`));
for (const r of await Promise.all(httpJobs)) print(r);

const wsJobs = [];
if (scanWs.url) wsJobs.push(wssSlot(scanWs.url, `SCAN-WSS (${scanWs.key})`));
if (execWs.url) wsJobs.push(wssSlot(execWs.url, `EXEC-WSS (${execWs.key})`));
if (fbWs.url) wsJobs.push(wssSlot(fbWs.url, `FALLBACK-WSS (${fbWs.key})`));
for (const r of await Promise.all(wsJobs)) print(r);

console.log("=== /api/chain/head?chain=solana ===");
try {
  const res = await fetch("http://localhost:3000/api/chain/head?chain=solana");
  const j = await res.json();
  console.log(
    `live=${j.live} block=${j.block} transport=${j.transport || "-"} via=${j.via || "-"} skipped=${j.skipped || "-"} fee=${j.gasPriceWei || "-"}`
  );
} catch (e) {
  console.log(`HEAD API FAIL: ${e instanceof Error ? e.message : String(e)}`);
}
