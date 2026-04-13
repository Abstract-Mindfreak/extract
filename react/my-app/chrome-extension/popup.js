const LOCALHOST_PATTERNS = ["http://localhost:3000/*", "http://127.0.0.1:3000/*"];
const SYNC_SERVER_URL = "http://127.0.0.1:39017";
const SYNC_POLL_MS = 10000;
const MARKER_CHAR = "\u2591";

const USED_STORAGE_KEY = "mmss_ext_used_results_v1";
const SESSION_STORAGE_KEY = "mmss_ext_popup_session_v1";
const BINDINGS_STORAGE_KEY = "mmss_ext_bindings_v1";
const SYNC_META_STORAGE_KEY = "mmss_ext_sync_meta_v1";

const MARKER_COLORS = ["#6ec7ff", "#7aeb99", "#ffd56f", "#ff9acb", "#c2a7ff", "#ffb27d", "#9be8d8", "#f6a6a6"];

const state = {
  results: [],
  used: {},
  bindings: {},
  syncRevision: 0,
  pollTimer: null,
};

const els = {
  status: document.getElementById("status"),
  formula: document.getElementById("formula"),
  mode: document.getElementById("mode"),
  tagPreset: document.getElementById("tagPreset"),
  insertMode: document.getElementById("insertMode"),
  libraryInput: document.getElementById("libraryInput"),
  results: document.getElementById("results"),
  usageMap: document.getElementById("usageMap"),
  tabResults: document.getElementById("tabResults"),
  tabUsage: document.getElementById("tabUsage"),
  btnPing: document.getElementById("btnPing"),
  btnEnsure: document.getElementById("btnEnsure"),
  btnGenerate: document.getElementById("btnGenerate"),
  btnAdd: document.getElementById("btnAdd"),
  btnClearUsed: document.getElementById("btnClearUsed"),
  btnRefreshSync: document.getElementById("btnRefreshSync"),
  btnPushSync: document.getElementById("btnPushSync"),
};

init().catch((error) => setStatus(`Init failed: ${error.message}`));

async function init() {
  const stored = await chrome.storage.local.get([
    USED_STORAGE_KEY,
    SESSION_STORAGE_KEY,
    BINDINGS_STORAGE_KEY,
    SYNC_META_STORAGE_KEY,
  ]);
  state.used = stored[USED_STORAGE_KEY] || {};
  state.bindings = stored[BINDINGS_STORAGE_KEY] || {};
  state.syncRevision = Number(stored[SYNC_META_STORAGE_KEY]?.revision || 0);
  restoreSession(stored[SESSION_STORAGE_KEY]);

  bindAsync(els.btnPing, handlePing);
  bindAsync(els.btnEnsure, handleEnsure);
  bindAsync(els.btnGenerate, handleGenerate);
  bindAsync(els.btnAdd, handleAddToLibrary);
  bindAsync(els.btnClearUsed, handleClearUsed);
  bindAsync(els.btnRefreshSync, handleRefreshSync);
  bindAsync(els.btnPushSync, handlePushSync);
  bindAsync(els.tabResults, () => switchTab("results"));
  bindAsync(els.tabUsage, () => switchTab("usage"));

  els.formula.addEventListener("input", () => void persistSession());
  els.mode.addEventListener("change", () => void persistSession());
  els.tagPreset.addEventListener("change", () => void persistSession());
  els.insertMode.addEventListener("change", () => void persistSession());
  els.libraryInput.addEventListener("input", () => void persistSession());

  switchTab("results");
  renderAll();
  startPolling();
}

function bindAsync(element, handler) {
  element.addEventListener("click", () => {
    Promise.resolve(handler()).catch((error) => setStatus(error.message || "Operation failed"));
  });
}

function switchTab(tab) {
  const isResults = tab === "results";
  els.tabResults.classList.toggle("active", isResults);
  els.tabUsage.classList.toggle("active", !isResults);
  els.results.classList.toggle("active", isResults);
  els.usageMap.classList.toggle("active", !isResults);
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    handleRefreshSync(true).catch(() => {});
  }, SYNC_POLL_MS);
}

async function handlePing() {
  setStatus("Checking bridge...");
  const response = await requestBridge("ping", {});
  if (!response.ok) {
    setStatus(`Bridge unavailable: ${response.error}`);
    return;
  }
  setStatus(
    `Bridge OK. blocks=${response.response.blocks}, sequences=${response.response.sequences}, ready=${response.response.libraryReady}`
  );
}

async function handleEnsure() {
  setStatus("Loading library on localhost...");
  const response = await requestBridge("ensureLibraryReady", {});
  if (!response.ok) {
    setStatus(`Load failed: ${response.error}`);
    return;
  }
  setStatus("Library ready.");
}

async function handleGenerate() {
  setStatus("Generating batch via localhost...");
  const response = await requestBridge("generateBatch", {
    formula: els.formula.value,
    mode: els.mode.value,
    tagPreset: els.tagPreset.value,
  });
  if (!response.ok || !response.response?.ok) {
    setStatus(`Generate failed: ${response.error || response.response?.message || "Unknown error"}`);
    return;
  }

  state.results = (response.response.results || []).map((item) => {
    const text = ensureResultMarker(item.text);
    const key = resultKey({ ...item, text });
    ensureBinding(key);
    return { ...item, key, text };
  });
  await persistAll();
  await handlePushSync(true);
  renderAll();
  setStatus(
    `Generated ${state.results.length} result(s): ${response.response.batch.files}x${response.response.batch.items}.`
  );
}

async function handleAddToLibrary() {
  const text = String(els.libraryInput.value || "").trim();
  if (!text) {
    setStatus("Input is empty.");
    return;
  }
  setStatus("Adding data to MMSS library...");
  const response = await requestBridge("addBlocksFromInput", { text });
  if (!response.ok) {
    setStatus(`Add failed: ${response.error}`);
    return;
  }
  const data = response.response || {};
  if (!data.ok) {
    setStatus(data.message || "No blocks imported.");
    return;
  }
  setStatus(`Imported ${data.imported} block(s), mode=${data.mode}.`);
  els.libraryInput.value = "";
  await persistSession();
}

async function handleClearUsed() {
  state.used = {};
  await persistAll();
  await handlePushSync(true);
  renderAll();
  setStatus("Used state cleared.");
}

async function handleRefreshSync(silent = false) {
  const response = await fetch(`${SYNC_SERVER_URL}/state`, { method: "GET" }).catch(() => null);
  if (!response?.ok) {
    if (!silent) setStatus("Sync server unavailable. Start: npm run sync:server");
    return;
  }

  const payload = await response.json();
  if (!payload?.ok || !payload?.state) {
    if (!silent) setStatus("Sync state invalid.");
    return;
  }

  const incomingRevision = Number(payload.state.revision || 0);
  if (incomingRevision <= state.syncRevision) return;

  applySyncedState(payload.state);
  state.syncRevision = incomingRevision;
  await chrome.storage.local.set({ [SYNC_META_STORAGE_KEY]: { revision: incomingRevision } });
  await persistAll();
  renderAll();
  if (!silent) setStatus(`Sync loaded. revision=${incomingRevision}`);
}

async function handlePushSync(silent = false) {
  const payload = {
    results: state.results.slice(0, 256),
    used: state.used,
  };
  try {
    const response = await fetch(`${SYNC_SERVER_URL}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      if (!silent) setStatus("Sync push failed.");
      return;
    }
    const json = await response.json();
    if (!json?.ok || !json?.state) {
      if (!silent) setStatus("Sync push failed.");
      return;
    }
    applySyncedState(json.state);
    state.syncRevision = Number(json.state.revision || state.syncRevision);
    await chrome.storage.local.set({ [SYNC_META_STORAGE_KEY]: { revision: state.syncRevision } });
    await persistAll();
    renderAll();
    if (!silent) setStatus("Sync push complete.");
  } catch {
    if (!silent) setStatus("Sync push failed. Is sync server running?");
  }
}

async function copyResult(item) {
  await navigator.clipboard.writeText(item.text);
  await markUsed(item, "copied", null);
  setStatus(`Copied: ${item.title}`);
}

async function insertResult(item) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab for insertion.");
    return;
  }

  const binding = ensureBinding(item.key);
  const insertion = await chrome.tabs
    .sendMessage(tab.id, {
      type: "MMSS_INSERT_TEXT",
      payload: {
        key: item.key,
        text: ensureResultMarker(item.text),
        strictDuplicateCheck: els.insertMode.value === "skip_duplicates",
        marker: {
          bindNumber: binding.bindNumber,
          colorHex: binding.color,
        },
      },
    })
    .catch((error) => ({
      ok: false,
      error:
        error?.message?.includes("Receiving end does not exist")
          ? "No content script in this tab. Refresh this page once."
          : error?.message || "Insert failed",
    }));

  if (!insertion?.ok) {
    setStatus(insertion?.error || "Insertion failed.");
    return;
  }
  if (insertion.duplicate) {
    setStatus("Skipped: same block is already inserted in this field.");
    return;
  }

  const context = {
    ...(insertion.context || {}),
    tabId: tab.id,
    windowId: tab.windowId,
  };
  await markUsed(item, "inserted", context);
  await applyTabGrouping(tab, binding);
  setStatus(`Inserted: ${item.title}`);
}

function previewResult(item) {
  navigator.clipboard.writeText(item.text).catch(() => {});
  setStatus(`Quick copy: ${item.title}`);
}

async function markUsed(item, reason, context) {
  const binding = ensureBinding(item.key);
  const prev = state.used[item.key] || {};
  const nextContexts = [...(prev.contexts || [])];
  if (context) {
    nextContexts.push({
      url: context.url || "",
      title: context.title || "",
      selectorHint: context.selectorHint || "",
      tabId: context.tabId ?? null,
      windowId: context.windowId ?? null,
      at: Date.now(),
      bindNumber: binding.bindNumber,
      color: binding.color,
    });
  }

  state.used[item.key] = {
    used: true,
    reason,
    at: Date.now(),
    bindNumber: binding.bindNumber,
    color: binding.color,
    contexts: dedupeContexts(nextContexts).slice(-30),
  };
  await persistAll();
  await handlePushSync(true);
  renderAll();
}

function dedupeContexts(contexts) {
  const seen = new Set();
  const next = [];
  contexts.forEach((ctx) => {
    const marker = `${ctx.url}|${ctx.bindNumber}|${ctx.at}|${ctx.windowId}|${ctx.tabId}`;
    if (seen.has(marker)) return;
    seen.add(marker);
    next.push(ctx);
  });
  return next;
}

function renderAll() {
  renderResults();
  renderUsageMap();
}

function renderResults() {
  els.results.innerHTML = "";
  if (!state.results.length) {
    const empty = document.createElement("div");
    empty.className = "result-card";
    empty.textContent = "No generated results yet.";
    els.results.appendChild(empty);
    return;
  }

  state.results.forEach((item) => {
    ensureBinding(item.key);
    const binding = state.bindings[item.key];
    const usage = state.used[item.key];
    const used = Boolean(usage?.used);

    const card = document.createElement("article");
    card.className = `result-card ${used ? "used" : ""}`;

    const meta = document.createElement("div");
    meta.className = "result-meta";
    meta.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(
      `${item.mode} • ${item.blockIds?.length || 0} blocks`
    )}</span>`;

    const badge = document.createElement("span");
    badge.className = "bind-badge";
    badge.textContent = String(binding.bindNumber);
    badge.style.backgroundColor = binding.color;
    badge.style.color = "#081018";
    meta.appendChild(badge);

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = used ? "Copied/Used" : "Copy";
    copyBtn.addEventListener("click", () => void copyResult(item));

    const insertBtn = document.createElement("button");
    insertBtn.textContent = "Insert";
    insertBtn.addEventListener("click", () => void insertResult(item));

    const previewBtn = document.createElement("button");
    previewBtn.textContent = "Quick Copy";
    previewBtn.addEventListener("click", () => previewResult(item));

    actions.append(copyBtn, insertBtn, previewBtn);

    const preview = document.createElement("pre");
    preview.className = "result-preview";
    preview.textContent = item.text.slice(0, 900);

    card.append(meta, actions, preview);
    els.results.appendChild(card);
  });
}

function renderUsageMap() {
  els.usageMap.innerHTML = "";
  const allContexts = [];
  Object.entries(state.used).forEach(([key, usage]) => {
    (usage.contexts || []).forEach((ctx) => allContexts.push({ key, usage, ctx }));
  });

  if (!allContexts.length) {
    const empty = document.createElement("div");
    empty.className = "result-card";
    empty.textContent = "No usage contexts yet.";
    els.usageMap.appendChild(empty);
    return;
  }

  const byDomain = new Map();
  allContexts.forEach((entry) => {
    const domain = parseDomain(entry.ctx.url);
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain).push(entry);
  });

  [...byDomain.entries()].forEach(([domain, entries]) => {
    const domainEl = document.createElement("section");
    domainEl.className = "usage-domain";
    const title = document.createElement("strong");
    title.textContent = domain;
    domainEl.appendChild(title);

    const byPage = new Map();
    entries.forEach((entry) => {
      const url = entry.ctx.url || "unknown";
      const tab = entry.ctx.tabId ?? "na";
      const win = entry.ctx.windowId ?? "na";
      const pageKey = `${url}|w:${win}|t:${tab}`;
      if (!byPage.has(pageKey)) byPage.set(pageKey, []);
      byPage.get(pageKey).push(entry);
    });

    [...byPage.entries()].forEach(([pageKey, pageEntries]) => {
      const pageEl = document.createElement("div");
      pageEl.className = "usage-page";

      const ctxHead = pageEntries[pageEntries.length - 1]?.ctx || {};
      const url = ctxHead.url || "unknown";

      const head = document.createElement("div");
      head.className = "usage-page-head";
      const label = document.createElement("span");
      label.textContent = ctxHead.title || url;
      label.title = `${url} | w:${ctxHead.windowId ?? "?"} t:${ctxHead.tabId ?? "?"}`;
      const goBtn = document.createElement("button");
      goBtn.textContent = "Go to page";
      goBtn.addEventListener("click", () => void goToPage(ctxHead, url));
      head.append(label, goBtn);

      pageEl.append(head);

      const linkRow = document.createElement("div");
      linkRow.className = "usage-item";
      linkRow.innerHTML = `<span class="dot" style="background:#6ec7ff"></span><span>URL</span><span>${escapeHtml(
        url
      )}</span>`;
      pageEl.append(linkRow);

      const tabRow = document.createElement("div");
      tabRow.className = "usage-item";
      tabRow.innerHTML = `<span class="dot" style="background:#9be8d8"></span><span>Tab</span><span>w:${escapeHtml(
        String(ctxHead.windowId ?? "?")
      )} t:${escapeHtml(String(ctxHead.tabId ?? "?"))}</span>`;
      pageEl.append(tabRow);

      pageEntries.slice(-8).forEach(({ usage, ctx }) => {
        const row = document.createElement("div");
        row.className = "usage-item";
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = ctx.color || usage.color || "#6ec7ff";
        row.append(dot);
        const badge = document.createElement("span");
        badge.textContent = `#${ctx.bindNumber || usage.bindNumber || "?"}`;
        row.append(badge);
        const txt = document.createElement("span");
        txt.textContent = `${ctx.selectorHint || "target"} • ${formatTime(ctx.at)}`;
        txt.title = ctx.url || "";
        row.append(txt);
        pageEl.append(row);
      });

      domainEl.append(pageEl);
    });
    els.usageMap.append(domainEl);
  });
}

async function goToPage(context, url) {
  const tabId = context?.tabId;
  const windowId = context?.windowId;

  if (Number.isInteger(tabId)) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { active: true });
        if (Number.isInteger(windowId)) await chrome.windows.update(windowId, { focused: true });
        return;
      }
    } catch {
      // tab can be already closed
    }
  }

  if (!url) return;
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url === url);
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url, active: true });
}

async function requestBridge(action, payload) {
  const tab = await findLocalhostTab();
  if (!tab?.id) {
    return { ok: false, error: "Open MMSS React app at http://localhost:3000 first." };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "MMSS_BRIDGE_REQUEST", action, payload });
    if (!response?.ok) return { ok: false, error: response?.error || "No response from localhost bridge." };
    return response;
  } catch (error) {
    return {
      ok: false,
      error:
        error?.message?.includes("Receiving end does not exist")
          ? "No content script in localhost tab. Reload localhost page."
          : error.message,
    };
  }
}

async function findLocalhostTab() {
  const tabs = await chrome.tabs.query({ url: LOCALHOST_PATTERNS });
  return tabs[0] || null;
}

function ensureBinding(key) {
  if (state.bindings[key]) return state.bindings[key];
  const usedNumbers = new Set(Object.values(state.bindings).map((entry) => entry.bindNumber));
  let bindNumber = 1;
  while (usedNumbers.has(bindNumber)) bindNumber += 1;
  const color = MARKER_COLORS[(bindNumber - 1) % MARKER_COLORS.length];
  state.bindings[key] = { bindNumber, color };
  return state.bindings[key];
}

function applySyncedState(syncState) {
  if (!syncState || typeof syncState !== "object") return;
  const incomingResults = Array.isArray(syncState.results) ? syncState.results : [];
  state.results = incomingResults.map((item) => {
    const text = ensureResultMarker(item.text);
    const key = item.key || resultKey({ ...item, text });
    ensureBinding(key);
    return { ...item, key, text };
  });
  if (syncState.used && typeof syncState.used === "object") {
    state.used = syncState.used;
    Object.keys(state.used).forEach((key) => ensureBinding(key));
  }
}

function restoreSession(session) {
  if (!session || typeof session !== "object") return;
  if (typeof session.formula === "string") els.formula.value = session.formula;
  if (typeof session.mode === "string") els.mode.value = session.mode;
  if (typeof session.tagPreset === "string") els.tagPreset.value = session.tagPreset;
  if (typeof session.insertMode === "string") els.insertMode.value = session.insertMode;
  if (typeof session.libraryInput === "string") els.libraryInput.value = session.libraryInput;
  if (Array.isArray(session.results)) {
    state.results = session.results.slice(0, 64).map((item) => {
      const text = ensureResultMarker(item.text);
      return { ...item, key: item.key || resultKey({ ...item, text }), text };
    });
    state.results.forEach((item) => ensureBinding(item.key));
  }
}

async function persistSession() {
  const session = {
    formula: els.formula.value,
    mode: els.mode.value,
    tagPreset: els.tagPreset.value,
    insertMode: els.insertMode.value,
    libraryInput: els.libraryInput.value,
    results: state.results.slice(0, 64),
    savedAt: Date.now(),
  };
  await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
}

async function persistAll() {
  await chrome.storage.local.set({
    [USED_STORAGE_KEY]: state.used,
    [BINDINGS_STORAGE_KEY]: state.bindings,
  });
  await persistSession();
}

function ensureResultMarker(text) {
  const value = String(text || "");
  if (!value.trim()) return MARKER_CHAR;
  if (value.trimStart().startsWith(MARKER_CHAR)) return value;
  return `${MARKER_CHAR}${value}`;
}

function resultKey(item) {
  const text = ensureResultMarker(item?.text || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return `k_${hash.toString(36)}`;
}

function parseDomain(url) {
  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return "unknown";
  }
}

function formatTime(ts) {
  const date = new Date(ts || Date.now());
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
    2,
    "0"
  )}:${String(date.getSeconds()).padStart(2, "0")}`;
}

async function applyTabGrouping(tab, binding) {
  try {
    if (!tab?.id) return;
    const groupId = tab.groupId && tab.groupId !== -1 ? tab.groupId : await chrome.tabs.group({ tabIds: [tab.id] });
    await chrome.tabGroups.update(groupId, {
      color: colorToChromeGroup(binding.color),
      title: `MMSS #${binding.bindNumber}`,
    });
  } catch {
    // optional
  }
}

function colorToChromeGroup(hexColor) {
  const color = String(hexColor || "").toLowerCase();
  if (color.includes("ff9a") || color.includes("f6a6")) return "pink";
  if (color.includes("ffd5") || color.includes("ffb2")) return "yellow";
  if (color.includes("7aeb") || color.includes("9be8")) return "green";
  if (color.includes("c2a7")) return "purple";
  if (color.includes("6ec7")) return "blue";
  return "cyan";
}

function setStatus(text) {
  els.status.textContent = text;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
