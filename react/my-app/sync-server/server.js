const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.MMSS_SYNC_PORT || 39017);
const STORE_DIR = path.join(__dirname, ".data");
const STORE_FILE = path.join(STORE_DIR, "sync-state.json");

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify(
        {
          version: 1,
          updatedAt: Date.now(),
          revision: 1,
          results: [],
          used: {},
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function loadState() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch (error) {
    return {
      version: 1,
      updatedAt: Date.now(),
      revision: 1,
      results: [],
      used: {},
    };
  }
}

function saveState(state) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function mergeResults(current, incoming) {
  const byKey = new Map((Array.isArray(current) ? current : []).map((item) => [item.key, item]));
  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    if (!item || !item.key) return;
    byKey.set(item.key, {
      ...byKey.get(item.key),
      ...item,
    });
  });
  return [...byKey.values()].slice(0, 256);
}

function mergeUsed(current, incoming) {
  const next = { ...(current || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    const prev = next[key] || {};
    const contexts = [...(prev.contexts || []), ...(value?.contexts || [])];
    const uniq = [];
    const seen = new Set();
    contexts.forEach((ctx) => {
      const marker = `${ctx?.url || ""}|${ctx?.bindNumber || ""}|${ctx?.at || ""}`;
      if (seen.has(marker)) return;
      seen.add(marker);
      uniq.push(ctx);
    });
    next[key] = {
      used: Boolean(prev.used || value?.used),
      reason: value?.reason || prev.reason || "",
      at: Math.max(prev.at || 0, value?.at || 0),
      contexts: uniq.slice(-40),
      bindNumber: value?.bindNumber || prev.bindNumber || null,
      color: value?.color || prev.color || null,
    };
  });
  return next;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/state") {
    sendJson(res, 200, { ok: true, state: loadState() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/merge") {
    try {
      const body = await parseBody(req);
      const current = loadState();
      const next = {
        ...current,
        updatedAt: Date.now(),
        revision: Number(current.revision || 0) + 1,
        results: mergeResults(current.results, body.results),
        used: mergeUsed(current.used, body.used),
      };
      saveState(next);
      sendJson(res, 200, { ok: true, state: next });
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/replace") {
    try {
      const body = await parseBody(req);
      const next = {
        version: 1,
        updatedAt: Date.now(),
        revision: Number((loadState().revision || 0) + 1),
        results: Array.isArray(body.results) ? body.results.slice(0, 256) : [],
        used: body.used && typeof body.used === "object" ? body.used : {},
      };
      saveState(next);
      sendJson(res, 200, { ok: true, state: next });
      return;
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
      return;
    }
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, () => {
  ensureStore();
  // eslint-disable-next-line no-console
  console.log(`[MMSS Sync Server] listening on http://localhost:${PORT}`);
});
