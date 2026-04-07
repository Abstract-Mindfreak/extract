class TypeWriter extends HTMLElement {
  constructor() {
    super();
    this._gen = 0;
    this._paused = false;
    this._running = false;
    this._idx = 0;
    this._nodes = [];
    this._totalChars = 0;
    this._currentCharCount = 0;
    this._lastEmittedPercent = 0;
    this._animationTimeout = null;
  }

  connectedCallback() {
    const dir = this.getAttribute("dir") || "ltr";
    const speed = Number(this.getAttribute("speed")) || 100;
    const minDur = Number(this.getAttribute("min-duration")) || 50;
    const maxDur = Number(this.getAttribute("max-duration")) || 500;
    const autostart = this.getAttribute("autostart") !== "false";
    const respectMotion =
      this.getAttribute("respect-motion-preference") === "true";

    this._original = document.createDocumentFragment();
    this._original.append(
      ...[...this.childNodes].map((n) => n.cloneNode(true))
    );

    this.textContent = "";

    this._container = document.createElement("div");
    this._container.className = "type-writer-container";
    this._container.setAttribute("role", "region");
    this._container.setAttribute("aria-live", "polite");
    this._container.setAttribute("aria-atomic", "false");
    this._container.style.direction = dir;

    const label = this.getAttribute("aria-label");
    if (label) this._container.setAttribute("aria-label", label);

    this.appendChild(this._container);

    this._prefersReducedMotion =
      respectMotion &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this._cfg = { speed, minDur, maxDur };

    if (autostart) this.start();
  }

  disconnectedCallback() {
    this._gen++;
    this._running = false;
    this._paused = false;
    this._nodes.length = 0;
    this._original = null;
    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
      this._animationTimeout = null;
    }
  }

  _flattenNodes(node) {
    const result = [];
    let charCount = 0;

    const walk = (n, parent, inPre) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent;
        if (!inPre && !/\S/.test(text)) return;
        const normalized = inPre ? text : text.replace(/\s+/g, " ");
        const textLen = normalized.length;
        charCount += textLen;
        for (let i = 0; i < textLen; i++) {
          result.push({ type: "char", char: normalized[i], parent });
        }
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const clone = n.cloneNode(false);
        result.push({ type: "open", node: clone, parent });
        const children = n.childNodes;
        const childCount = children.length;
        const nextInPre = inPre || n.nodeName === "PRE";
        for (let i = 0; i < childCount; i++) {
          walk(children[i], clone, nextInPre);
        }
        result.push({ type: "close", node: clone, parent });
      }
    };

    const rootChildren = node.childNodes;
    const rootChildCount = rootChildren.length;
    for (let i = 0; i < rootChildCount; i++) {
      walk(rootChildren[i], this._container, false);
    }
    return { nodes: result, totalChars: charCount };
  }

  _stopAnimation() {
    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
      this._animationTimeout = null;
    }
  }

  _rebuildFromOriginal() {
    const { nodes, totalChars } = this._flattenNodes(
      this._original.cloneNode(true)
    );
    this._nodes = nodes;
    this._totalChars = totalChars;
  }

  _getProgressDetail() {
    const total = this._totalChars;
    const current = this._currentCharCount;
    const position = total > 0 ? current / total : 0;
    return { current, total, percent: position * 100, position };
  }

  _buildDOMToIndex(targetIndex) {
    if (this._totalChars === 0) {
      this._container.textContent = "";
      this._idx = 0;
      this._currentCharCount = 0;
      return;
    }

    this._container.textContent = "";
    this._rebuildFromOriginal();

    if (targetIndex <= 0) {
      this._currentCharCount = 0;
      this._idx = 0;
      return;
    }

    let charCount = 0;
    const nodeCount = this._nodes.length;
    const maxIndex = Math.min(targetIndex, nodeCount);

    for (let i = 0; i < maxIndex; i++) {
      const item = this._nodes[i];

      if (item.type === "open") {
        item.parent.appendChild(item.node);
      } else if (item.type === "char") {
        const parent = item.parent;
        const lastChild = parent.lastChild;

        if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
          lastChild.textContent += item.char;
        } else {
          parent.appendChild(document.createTextNode(item.char));
        }
        charCount++;
      }
    }

    this._currentCharCount = charCount;
    this._idx = targetIndex;
  }

  start() {
    if (!this._original || !this._container) return;
    if (this._running) return;

    this._gen++;
    this._stopAnimation();
    this._idx = 0;
    this._paused = false;
    this._container.textContent = "";

    this._rebuildFromOriginal();
    this._currentCharCount = 0;
    this._lastEmittedPercent = 0;

    if (this._prefersReducedMotion) {
      const clone = this._original.cloneNode(true);
      this._container.append(...clone.childNodes);
      this._container.setAttribute("aria-busy", "false");
      this._currentCharCount = this._totalChars;
      this._idx = this._nodes.length;
      if (this._totalChars > 0) {
        this._lastEmittedPercent = 1;
        this.dispatchEvent(
          new CustomEvent("progress", { detail: this._getProgressDetail() })
        );
      }
      this.dispatchEvent(new CustomEvent("complete"));
      return;
    }

    this._running = true;
    this._container.setAttribute("aria-busy", "true");
    this.dispatchEvent(new CustomEvent("start"));

    this._continueAnimation();
  }

  _continueAnimation() {
    this._stopAnimation();

    const gen = this._gen;
    const dur =
      this._totalChars > 0
        ? Math.max(
            this._cfg.minDur,
            Math.min(
              this._cfg.maxDur,
              Math.round((this._totalChars / this._cfg.speed) * 1000)
            )
          )
        : 0;
    const delay = this._totalChars
      ? Math.max(8, Math.round(dur / this._totalChars))
      : 0;
    const len = this._nodes.length;

    const processNext = () => {
      if (this._idx >= len) {
        this._running = false;
        this._container.setAttribute("aria-busy", "false");
        if (this._totalChars > 0) {
          this._currentCharCount = this._totalChars;
          this._lastEmittedPercent = 1;
          this.dispatchEvent(
            new CustomEvent("progress", { detail: this._getProgressDetail() })
          );
        }
        this.dispatchEvent(new CustomEvent("complete"));
        return;
      }

      if (gen !== this._gen || !this._running || this._paused) return;

      const item = this._nodes[this._idx];

      if (item.type === "open") {
        item.parent.appendChild(item.node);
      } else if (item.type === "char") {
        const parent = item.parent;
        const lastChild = parent.lastChild;

        if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
          lastChild.textContent += item.char;
        } else {
          parent.appendChild(document.createTextNode(item.char));
        }

        this._currentCharCount++;

        if (this._totalChars > 0) {
          const pct = this._currentCharCount / this._totalChars;
          if (pct - this._lastEmittedPercent >= 0.02) {
            this._lastEmittedPercent = pct;
            this.dispatchEvent(
              new CustomEvent("progress", { detail: this._getProgressDetail() })
            );
          }
        }
      }

      this._idx++;

      const nextDelay =
        item.type === "char" ? delay + ((Math.random() * 6) | 0) : 0;
      this._animationTimeout = setTimeout(processNext, nextDelay);
    };

    processNext();
  }

  pause() {
    if (!this._running || this._paused) return;
    this._paused = true;
    this._stopAnimation();
    this.dispatchEvent(new CustomEvent("pause"));
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._running = true;
    this.dispatchEvent(new CustomEvent("resume"));
    this._continueAnimation();
  }

  complete() {
    if (!this._running && !this._paused) return;
    if (!this._original) return;

    this._gen++;
    this._running = false;
    this._paused = false;
    this._stopAnimation();

    this._container.textContent = "";
    const clone = this._original.cloneNode(true);
    this._container.append(...clone.childNodes);

    this._currentCharCount = this._totalChars;
    this._idx = this._nodes.length;
    this._container.setAttribute("aria-busy", "false");
    if (this._totalChars > 0) {
      this._lastEmittedPercent = 1;
      this.dispatchEvent(
        new CustomEvent("progress", { detail: this._getProgressDetail() })
      );
    }
    this.dispatchEvent(new CustomEvent("complete"));
  }

  reset() {
    this._gen++;
    this._running = false;
    this._paused = false;
    this._stopAnimation();
    this._idx = 0;
    this._nodes.length = 0;
    this._currentCharCount = 0;
    this._lastEmittedPercent = 0;
    this._totalChars = 0;
    if (this._container) this._container.textContent = "";

    this.dispatchEvent(
      new CustomEvent("progress", { detail: this._getProgressDetail() })
    );
    this.dispatchEvent(new CustomEvent("reset"));
  }

  seek(position) {
    if (!this._original) return;

    if (!this._nodes.length) {
      this._rebuildFromOriginal();
    }

    const wasRunning = this._running && !this._paused;
    if (wasRunning) {
      this.pause();
    } else if (!this._running) {
      this._running = true;
      this._paused = true;
      this._stopAnimation();
      this._container.setAttribute("aria-busy", "true");
    }

    const normalizedPosition = Math.max(0, Math.min(1, position));
    const targetChar = Math.floor(normalizedPosition * this._totalChars);

    let charCount = 0;
    let targetIndex = 0;
    const nodeCount = this._nodes.length;

    for (let i = 0; i < nodeCount; i++) {
      if (this._nodes[i].type === "char") {
        if (charCount >= targetChar) break;
        charCount++;
      }
      targetIndex = i + 1;
    }

    this._buildDOMToIndex(targetIndex);
    const progressDetail = this._getProgressDetail();
    this._lastEmittedPercent = progressDetail.position;

    if (normalizedPosition === 0) {
      this._running = false;
      this._paused = false;
      this._container.setAttribute("aria-busy", "false");
      this.dispatchEvent(
        new CustomEvent("seek", {
          detail: {
            position: normalizedPosition,
            targetChar: this._currentCharCount,
            totalChars: this._totalChars,
            percent: 0,
            wasRunning: wasRunning,
            canResume: true,
            atStart: true
          }
        })
      );
    } else if (
      normalizedPosition === 1 ||
      this._currentCharCount === this._totalChars
    ) {
      this._running = false;
      this._paused = false;
      this._container.setAttribute("aria-busy", "false");
      this.dispatchEvent(
        new CustomEvent("seek", {
          detail: {
            position: normalizedPosition,
            targetChar: this._currentCharCount,
            totalChars: this._totalChars,
            percent: 100,
            wasRunning: wasRunning,
            canResume: false,
            atEnd: true
          }
        })
      );
      this.dispatchEvent(new CustomEvent("complete"));
    } else {
      this.dispatchEvent(
        new CustomEvent("seek", {
          detail: {
            position: normalizedPosition,
            targetChar: this._currentCharCount,
            totalChars: this._totalChars,
            percent:
              this._totalChars > 0
                ? (this._currentCharCount / this._totalChars) * 100
                : 0,
            wasRunning: wasRunning,
            canResume: true
          }
        })
      );
    }

    if (this._totalChars > 0) {
      this.dispatchEvent(
        new CustomEvent("progress", { detail: progressDetail })
      );
    }
  }

  seekToPercent(percent) {
    this.seek(percent / 100);
  }

  seekToChar(charIndex) {
    if (this._totalChars === 0) return;
    this.seek(charIndex / this._totalChars);
  }

  getProgress() {
    return this._getProgressDetail();
  }

  setText(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;

    this._original = document.createDocumentFragment();
    this._original.append(
      ...[...temp.childNodes].map((n) => n.cloneNode(true))
    );
    this.reset();
  }
}

customElements.define("type-writer", TypeWriter);

function attachAutoscroll(el) {
  let wasAtBottom = true;

  window.addEventListener(
    "scroll",
    () => {
      wasAtBottom =
        window.scrollY + window.innerHeight >= document.body.scrollHeight - 80;
    },
    { passive: true }
  );

  const autoScroll = () => {
    if (wasAtBottom) {
      window.scrollTo({ top: document.body.scrollHeight });
    }
  };

  el.addEventListener("progress", autoScroll);
  el.addEventListener("complete", autoScroll);
  el.addEventListener("seek", autoScroll);
  el.addEventListener("reset", () => {
    wasAtBottom = true;
    window.scrollTo({ top: 0 });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const demo_el = document.getElementById("demo");
  if (!demo_el) return;

  const fab_btn = document.getElementById("fab_btn");
  const fab_icon = document.getElementById("fab_icon");
  const control_panel = document.getElementById("control_panel");
  const progress_pill = document.getElementById("progress_pill");
  const progress_readout = document.getElementById("progress_readout");
  const seek_strip = document.getElementById("seek_strip");
  const seek_fill = document.getElementById("seek_fill");
  const seek_thumb = document.getElementById("seek_thumb");

  if (!seek_strip || !seek_fill || !fab_btn || !control_panel) return;

  const ICON_MENU =
    '<rect x="6" y="10" width="36" height="3"/><rect x="6" y="22" width="36" height="3"/><rect x="6" y="34" width="36" height="3"/>';
  const ICON_CLOSE =
    '<path d="m12.55 37.5-2-2.05L22 24 10.55 12.5l2-2L24 21.95 35.5 10.5l2 2L26.05 24 37.5 35.45l-2 2.05L24 26Z"/>';

  const autostart_attr = demo_el.getAttribute("autostart") !== "false";
  const state = { running: autostart_attr, paused: false };

  function set_fab_icon(is_open) {
    if (!fab_icon) return;
    fab_icon.innerHTML = is_open ? ICON_CLOSE : ICON_MENU;
  }

  function update_pill(text) {
    if (progress_pill) progress_pill.textContent = text;
  }

  function update_readout(text) {
    if (progress_readout) progress_readout.textContent = text;
  }

  function update_seek(position) {
    const pct = position * 100 + "%";
    if (seek_fill) seek_fill.style.width = pct;
    if (seek_thumb) seek_thumb.style.insetInlineStart = pct;
    if (seek_strip) {
      const val = Math.round(position * 100);
      seek_strip.setAttribute("aria-valuenow", val);
      seek_strip.setAttribute("aria-valuetext", val + "%");
    }
  }

  function update_seek_instant(position) {
    if (!seek_strip || !seek_fill) return;
    const pct = position * 100 + "%";
    seek_fill.style.width = pct;
    if (seek_thumb) seek_thumb.style.insetInlineStart = pct;
    const val = Math.round(position * 100);
    seek_strip.setAttribute("aria-valuenow", val);
    seek_strip.setAttribute("aria-valuetext", val + "%");
  }

  function update_buttons() {
    document.querySelectorAll("[data-ctrl='demo']").forEach((btn) => {
      const action = btn.dataset.action;
      let disabled = false;
      switch (action) {
        case "start":
          disabled = state.running;
          break;
        case "pause":
          disabled = !state.running || state.paused;
          break;
        case "resume":
          disabled = !state.paused;
          break;
        case "complete":
          disabled = !state.running;
          break;
        case "reset":
          disabled = state.running && !state.paused;
          break;
      }
      btn.disabled = disabled;
    });
  }

  fab_btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const is_open = !control_panel.hidden;
    control_panel.hidden = is_open;
    fab_btn.setAttribute("aria-expanded", String(!is_open));
    set_fab_icon(!is_open);
  });

  let is_seeking = false;

  function get_seek_pos(e) {
    const rect = seek_strip.getBoundingClientRect();
    const width = rect.width || 1;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / width));
  }

  seek_strip.addEventListener("pointerdown", (e) => {
    is_seeking = true;
    try {
      seek_strip.setPointerCapture(e.pointerId);
    } catch {}
    seek_strip.classList.add("is-dragging");
    demo_el.seek(get_seek_pos(e));
  });

  seek_strip.addEventListener("pointermove", (e) => {
    if (!is_seeking) return;
    demo_el.seek(get_seek_pos(e));
  });

  seek_strip.addEventListener("pointerup", (e) => {
    is_seeking = false;
    try {
      seek_strip.releasePointerCapture(e.pointerId);
    } catch {}
    seek_strip.classList.remove("is-dragging");
  });

  seek_strip.addEventListener("pointercancel", (e) => {
    is_seeking = false;
    try {
      seek_strip.releasePointerCapture(e.pointerId);
    } catch {}
    seek_strip.classList.remove("is-dragging");
  });

  seek_strip.addEventListener("lostpointercapture", () => {
    is_seeking = false;
    seek_strip.classList.remove("is-dragging");
  });

  seek_strip.addEventListener("keydown", (e) => {
    const current = demo_el.getProgress().position;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      demo_el.seek(Math.max(0, current - 0.05));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      demo_el.seek(Math.min(1, current + 0.05));
    } else if (e.key === "Home") {
      e.preventDefault();
      demo_el.seek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      demo_el.seek(1);
    }
  });

  demo_el.addEventListener("start", () => {
    state.running = true;
    state.paused = false;
    update_buttons();
  });

  demo_el.addEventListener("pause", () => {
    state.paused = true;
    update_buttons();
  });

  demo_el.addEventListener("resume", () => {
    state.paused = false;
    update_buttons();
  });

  demo_el.addEventListener("complete", () => {
    state.running = false;
    state.paused = false;
    update_seek(1);
    update_pill("100%");
    update_readout("Animation complete");
    update_buttons();
  });

  demo_el.addEventListener("reset", () => {
    state.running = false;
    state.paused = false;
    update_seek(0);
    update_pill("0%");
    update_readout("Ready to animate");
    update_buttons();
  });

  demo_el.addEventListener("progress", (ev) => {
    if (!is_seeking) update_seek(ev.detail.position);
    update_pill(ev.detail.percent.toFixed(0) + "%");
    update_readout(
      ev.detail.percent.toFixed(1) +
        "% — " +
        ev.detail.current +
        " / " +
        ev.detail.total
    );
  });

  demo_el.addEventListener("seek", (ev) => {
    update_seek_instant(ev.detail.position);
    update_pill(ev.detail.percent.toFixed(0) + "%");
    if (ev.detail.atStart) {
      state.running = false;
      state.paused = false;
    } else if (ev.detail.atEnd) {
      state.running = false;
      state.paused = false;
    } else if (ev.detail.wasRunning || ev.detail.canResume) {
      state.running = true;
      state.paused = true;
    }
    update_buttons();
  });

  document.addEventListener("click", (e) => {
    if (
      !control_panel.hidden &&
      !control_panel.contains(e.target) &&
      !fab_btn.contains(e.target) &&
      !seek_strip.contains(e.target)
    ) {
      control_panel.hidden = true;
      fab_btn.setAttribute("aria-expanded", "false");
      set_fab_icon(false);
    }

    const btn = e.target.closest("[data-ctrl]");
    if (!btn || btn.disabled) return;
    const id = btn.dataset.ctrl;
    const action = btn.dataset.action;
    const el = document.getElementById(id);
    if (!el) return;
    if (action && action.startsWith("seek-")) {
      el.seek(parseFloat(action.split("-")[1]) / 100);
    } else {
      el[action]?.();
    }
  });

  attachAutoscroll(demo_el);
  set_fab_icon(false);
  queueMicrotask(update_buttons);
});