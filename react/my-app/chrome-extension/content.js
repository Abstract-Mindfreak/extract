const PENDING = new Map();
let lastFocusedElement = null;

const SESSION_STORAGE_KEY = "mmss_ext_popup_session_v1";
const BINDINGS_STORAGE_KEY = "mmss_ext_bindings_v1";
const USED_STORAGE_KEY = "mmss_ext_used_results_v1";
const PAGE_SCAN_MS = 10000;
const MARKER_CHAR = "\u2591";

document.addEventListener(
  "focusin",
  (event) => {
    lastFocusedElement = event.target;
  },
  true
);

if (isLocalhostMmss()) {
  injectPageBridge();
}
startPageScanner();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data || {};
  if (data.source !== "MMSS_EXT_PAGE" || data.type !== "MMSS_BRIDGE_RESPONSE" || !data.requestId) return;
  const resolver = PENDING.get(data.requestId);
  if (!resolver) return;
  PENDING.delete(data.requestId);
  resolver(data);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "MMSS_BRIDGE_REQUEST") {
    if (!isLocalhostMmss()) {
      sendResponse({ ok: false, error: "This tab is not MMSS localhost page." });
      return true;
    }
    relayToPageBridge(message.action, message.payload)
      .then((response) => sendResponse({ ok: true, response }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "MMSS_INSERT_TEXT") {
    const payload = message.payload || {};
    const target = resolveEditableTarget();
    if (!target) {
      sendResponse({ ok: false, error: "No focused editable field." });
      return true;
    }

    const inserted = insertIntoTarget(
      target,
      String(payload.text || ""),
      Boolean(payload.strictDuplicateCheck),
      payload.marker || {},
      String(payload.key || "")
    );
    sendResponse(inserted);
    return true;
  }
  return false;
});

function isLocalhostMmss() {
  return location.origin === "http://localhost:3000" || location.origin === "http://127.0.0.1:3000";
}

function injectPageBridge() {
  if (document.getElementById("mmss-ext-page-bridge")) return;
  const script = document.createElement("script");
  script.id = "mmss-ext-page-bridge";
  script.src = chrome.runtime.getURL("pageBridge.js");
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
}

function relayToPageBridge(action, payload) {
  return new Promise((resolve, reject) => {
    const requestId = `r_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timeout = setTimeout(() => {
      PENDING.delete(requestId);
      reject(new Error("Bridge timeout"));
    }, 10000);

    PENDING.set(requestId, (data) => {
      clearTimeout(timeout);
      if (!data.ok) {
        reject(new Error(data.error || "Bridge error"));
        return;
      }
      resolve(data.response);
    });

    window.postMessage(
      {
        source: "MMSS_EXT_CONTENT",
        type: "MMSS_BRIDGE_REQUEST",
        requestId,
        action,
        payload,
      },
      "*"
    );
  });
}

function resolveEditableTarget() {
  const producerTarget = resolveProducerTextarea();
  if (producerTarget) return producerTarget;
  const active = document.activeElement;
  if (isEditable(active)) return active;
  if (isEditable(lastFocusedElement)) return lastFocusedElement;
  return null;
}

function resolveProducerTextarea() {
  const host = (location.hostname || "").toLowerCase();
  if (!host.includes("producer")) return null;
  const textareas = [...document.querySelectorAll("textarea")].filter(isVisible);
  return textareas[textareas.length - 1] || null;
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isEditable(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName === "INPUT") {
    const type = (element.getAttribute("type") || "text").toLowerCase();
    return ["text", "search", "email", "url", "tel", "password"].includes(type);
  }
  return false;
}

function ensureMarkerText(text) {
  const value = String(text || "");
  if (!value.trim()) return MARKER_CHAR;
  if (value.trimStart().startsWith(MARKER_CHAR)) return value;
  return `${MARKER_CHAR}${value}`;
}

function insertIntoTarget(target, text, strictDuplicateCheck, marker, key) {
  if (!text.trim()) return { ok: false, error: "Empty text payload." };
  const normalizedText = ensureMarkerText(text);

  if (strictDuplicateCheck && isLikelyDuplicate(target, normalizedText, marker)) {
    return { ok: true, duplicate: true, inserted: false, context: buildContext(target) };
  }

  if (target.isContentEditable) {
    target.focus();
    document.execCommand("insertText", false, normalizedText);
  } else {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.setRangeText(normalizedText, start, end, "end");
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  markElementUsed(target, marker, key);
  return {
    ok: true,
    duplicate: false,
    inserted: true,
    context: buildContext(target),
  };
}

function isLikelyDuplicate(target, text, marker) {
  const existing = normalizeForCompare(readText(target));
  const incoming = normalizeForCompare(text);
  if (!incoming) return false;
  if (existing.includes(incoming) || existing.includes(incoming.slice(0, 160))) return true;
  if (marker?.bindNumber) {
    if (String(target.dataset.mmssBind || "") === String(marker.bindNumber)) return true;
    const pageMarkers = document.querySelectorAll(`[data-mmss-bind="${String(marker.bindNumber)}"]`);
    if (pageMarkers.length > 0) return true;
  }
  return false;
}

function readText(target) {
  if (!target) return "";
  if (target.isContentEditable) return target.innerText || target.textContent || "";
  return target.value || "";
}

function normalizeForCompare(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\{\}\[\]":,._\- \u2591]/gu, "")
    .trim();
}

function buildContext(target) {
  return {
    url: location.href,
    title: document.title || "",
    selectorHint: getSelectorHint(target),
  };
}

function getSelectorHint(target) {
  if (!target || !target.tagName) return "";
  const id = target.id ? `#${target.id}` : "";
  const cls =
    typeof target.className === "string" && target.className.trim()
      ? `.${target.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
  return `${target.tagName.toLowerCase()}${id}${cls}`;
}

function markElementUsed(target, marker, key = "") {
  const color = marker.colorHex || "#6ec7ff";
  target.style.outline = `2px solid ${color}`;
  target.style.backgroundColor = withAlpha(color, 0.12);
  target.dataset.mmssUsed = "1";
  target.dataset.mmssBind = String(marker.bindNumber || "");
  target.dataset.mmssKey = key;
  drawTargetBadge(target, marker);
  setFaviconBadge(marker);
}

function drawTargetBadge(target, marker) {
  const bindNumber = marker.bindNumber || "";
  if (!bindNumber) return;
  const rect = target.getBoundingClientRect();
  const badgeId = `mmss-marker-${bindNumber}`;
  let badge = document.getElementById(badgeId);
  if (!badge) {
    badge = document.createElement("div");
    badge.id = badgeId;
    badge.style.position = "fixed";
    badge.style.zIndex = "2147483646";
    badge.style.width = "22px";
    badge.style.height = "22px";
    badge.style.borderRadius = "999px";
    badge.style.display = "grid";
    badge.style.placeItems = "center";
    badge.style.fontSize = "11px";
    badge.style.fontWeight = "700";
    badge.style.color = "#041018";
    badge.style.boxShadow = "0 2px 8px rgba(0,0,0,.25)";
    badge.textContent = String(bindNumber);
    document.documentElement.appendChild(badge);
  }
  badge.style.background = marker.colorHex || "#6ec7ff";
  badge.style.left = `${Math.max(6, rect.left - 10)}px`;
  badge.style.top = `${Math.max(6, rect.top - 12)}px`;
}

function setFaviconBadge(marker) {
  const color = marker.colorHex || "#6ec7ff";
  const number = String(marker.bindNumber || "");
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#051018";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number || "•", size / 2, size / 2);

  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL("image/png");
}

function withAlpha(hexOrRgb, alpha) {
  if (String(hexOrRgb).startsWith("rgba")) {
    return hexOrRgb.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
  }
  if (String(hexOrRgb).startsWith("rgb(")) {
    return hexOrRgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  const hex = String(hexOrRgb).replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((ch) => ch + ch).join("") : hex.padEnd(6, "0");
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function startPageScanner() {
  scanForMovedPrompts().catch(() => {});
  setInterval(() => {
    scanForMovedPrompts().catch(() => {});
  }, PAGE_SCAN_MS);
}

async function scanForMovedPrompts() {
  const stored = await chrome.storage.local.get([SESSION_STORAGE_KEY, BINDINGS_STORAGE_KEY, USED_STORAGE_KEY]);
  const results = Array.isArray(stored[SESSION_STORAGE_KEY]?.results) ? stored[SESSION_STORAGE_KEY].results : [];
  const bindings = stored[BINDINGS_STORAGE_KEY] || {};
  const used = stored[USED_STORAGE_KEY] || {};
  if (!results.length) return;

  const markerElements = collectMarkerElements();
  results.forEach((result) => {
    const text = String(result?.text || "");
    if (!text.includes(MARKER_CHAR)) return;
    const key = result.key || resultKey(result);
    const binding = bindings[key];
    if (!binding) return;
    if (!isLikelyUsedOnCurrentPage(used[key])) return;
    const signature = extractSignature(text);
    const matched = markerElements.find((element) => elementMatchesSignature(element, signature));
    if (!matched) return;
    clearInputMarkerForBind(binding.bindNumber);
    markElementUsed(matched, { bindNumber: binding.bindNumber, colorHex: binding.color }, key);
  });

  clearInputMarkersIfNeeded();
}

function collectMarkerElements() {
  const set = new Set();
  const root = document.body || document.documentElement;
  if (!root) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = String(node.nodeValue || "");
    if (text.includes(MARKER_CHAR)) {
      const container = nearestMarkerContainer(node.parentElement);
      if (container && isVisible(container)) set.add(container);
    }
    node = walker.nextNode();
  }
  return [...set];
}

function nearestMarkerContainer(element) {
  if (!element) return null;
  if (element.closest("textarea,input,[contenteditable='true']")) return null;
  return element.closest("article,section,main,div,pre,code,p,li,blockquote") || element;
}

function extractSignature(text) {
  const raw = String(text || "");
  const markerIndex = raw.indexOf(MARKER_CHAR);
  const slice = markerIndex >= 0 ? raw.slice(markerIndex + 1) : raw;
  const jsonStart = slice.indexOf("{");
  const base = jsonStart >= 0 ? slice.slice(jsonStart) : slice;
  return normalizeForCompare(base).slice(0, 220);
}

function elementMatchesSignature(element, signature) {
  if (!signature) return false;
  const content = normalizeForCompare(element.textContent || "");
  const shortSignature = signature.slice(0, 110);
  return content.includes(shortSignature);
}

function clearInputMarkersIfNeeded() {
  const inputs = [...document.querySelectorAll("textarea,input,[contenteditable='true']")];
  inputs.forEach((input) => {
    const text = readText(input);
    if (text.includes(MARKER_CHAR)) return;
    if (input.dataset.mmssUsed === "1") {
      removeBadge(input.dataset.mmssBind);
      input.style.outline = "";
      input.style.backgroundColor = "";
      delete input.dataset.mmssUsed;
      delete input.dataset.mmssBind;
      delete input.dataset.mmssKey;
    }
  });
}

function clearInputMarkerForBind(bindNumber) {
  if (!bindNumber) return;
  const value = String(bindNumber);
  const selector = `textarea[data-mmss-bind="${value}"],input[data-mmss-bind="${value}"],[contenteditable='true'][data-mmss-bind="${value}"]`;
  const inputs = [...document.querySelectorAll(selector)];
  inputs.forEach((input) => {
    const text = readText(input);
    if (text.includes(MARKER_CHAR)) return;
    input.style.outline = "";
    input.style.backgroundColor = "";
    delete input.dataset.mmssUsed;
    delete input.dataset.mmssBind;
    delete input.dataset.mmssKey;
  });
}

function removeBadge(bindNumber) {
  const id = `mmss-marker-${String(bindNumber || "")}`;
  const badge = document.getElementById(id);
  if (badge) badge.remove();
}

function isLikelyUsedOnCurrentPage(usage) {
  if (!usage || !Array.isArray(usage.contexts) || !usage.contexts.length) return false;
  const current = location.href.split("#")[0];
  return usage.contexts.some((context) => String(context?.url || "").split("#")[0] === current);
}

function resultKey(item) {
  const text = String(item?.text || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return `k_${hash.toString(36)}`;
}
