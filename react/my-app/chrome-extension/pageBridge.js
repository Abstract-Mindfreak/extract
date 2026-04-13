(function initMmssPageBridge() {
  if (window.__MMSS_EXT_PAGE_BRIDGE__) return;
  window.__MMSS_EXT_PAGE_BRIDGE__ = true;

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== "MMSS_EXT_CONTENT" || data.type !== "MMSS_BRIDGE_REQUEST" || !data.requestId) {
      return;
    }

    const requestId = data.requestId;
    try {
      const bridge = window.__MMSS_BRIDGE__;
      if (!bridge) {
        respond(requestId, false, null, "MMSS bridge not found in page.");
        return;
      }

      const handler = bridge[data.action];
      if (typeof handler !== "function") {
        respond(requestId, false, null, `Unknown bridge action: ${data.action}`);
        return;
      }

      const response = await handler(data.payload || {});
      respond(requestId, true, response, null);
    } catch (error) {
      respond(requestId, false, null, error.message);
    }
  });

  function respond(requestId, ok, response, error) {
    window.postMessage(
      {
        source: "MMSS_EXT_PAGE",
        type: "MMSS_BRIDGE_RESPONSE",
        requestId,
        ok,
        response,
        error,
      },
      "*"
    );
  }
})();
