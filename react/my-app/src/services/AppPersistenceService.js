const PERSISTENCE_BASE = "http://localhost:3456/api/persistence";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

class AppPersistenceService {
  constructor() {
    this.scopeCache = new Map();
  }

  async listEntities(scope) {
    const payload = await requestJson(`${PERSISTENCE_BASE}/entities/${encodeURIComponent(scope)}`);
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async getEntity(scope, entityKey, fallback = null) {
    try {
      const payload = await requestJson(
        `${PERSISTENCE_BASE}/entities/${encodeURIComponent(scope)}/${encodeURIComponent(entityKey)}`,
      );
      return payload ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  async putEntity(scope, entityKey, item) {
    const payload = await requestJson(
      `${PERSISTENCE_BASE}/entities/${encodeURIComponent(scope)}/${encodeURIComponent(entityKey)}`,
      {
        method: "PUT",
        body: JSON.stringify({ item }),
      },
    );
    return payload?.item ?? item;
  }

  async putEntities(scope, items, keyField = "id") {
    const payload = await requestJson(
      `${PERSISTENCE_BASE}/entities/${encodeURIComponent(scope)}/batch`,
      {
        method: "POST",
        body: JSON.stringify({ items, keyField }),
      },
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async deleteEntity(scope, entityKey) {
    await requestJson(`${PERSISTENCE_BASE}/entities/${encodeURIComponent(scope)}/${encodeURIComponent(entityKey)}`, {
      method: "DELETE",
    });
  }

  async getScope(scope) {
    const payload = await requestJson(`${PERSISTENCE_BASE}/settings/${encodeURIComponent(scope)}`);
    const values = payload?.values || {};
    this.scopeCache.set(scope, values);
    return values;
  }

  async getSetting(scope, key, fallback = null) {
    try {
      const payload = await requestJson(
        `${PERSISTENCE_BASE}/settings/${encodeURIComponent(scope)}/${encodeURIComponent(key)}`,
      );
      return typeof payload?.value === "undefined" || payload?.value === null ? fallback : payload.value;
    } catch (_error) {
      return fallback;
    }
  }

  async setSetting(scope, key, value) {
    const payload = await requestJson(
      `${PERSISTENCE_BASE}/settings/${encodeURIComponent(scope)}/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value }),
      },
    );
    const scopeState = this.scopeCache.get(scope) || {};
    this.scopeCache.set(scope, {
      ...scopeState,
      [key]: payload?.value,
    });
    return payload?.value;
  }

  async setScope(scope, values) {
    const payload = await requestJson(`${PERSISTENCE_BASE}/settings/${encodeURIComponent(scope)}`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    });
    const nextValues = payload?.values || {};
    this.scopeCache.set(scope, nextValues);
    return nextValues;
  }

  async removeSetting(scope, key) {
    await requestJson(`${PERSISTENCE_BASE}/settings/${encodeURIComponent(scope)}/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    const scopeState = this.scopeCache.get(scope);
    if (scopeState && Object.prototype.hasOwnProperty.call(scopeState, key)) {
      const next = { ...scopeState };
      delete next[key];
      this.scopeCache.set(scope, next);
    }
  }

  createZustandStorage(scope) {
    return {
      getItem: async (name) => {
        const value = await this.getSetting(scope, name, null);
        return typeof value === "string" ? value : value == null ? null : JSON.stringify(value);
      },
      setItem: async (name, value) => {
        await this.setSetting(scope, name, value);
      },
      removeItem: async (name) => {
        await this.removeSetting(scope, name);
      },
    };
  }
}

const appPersistenceService = new AppPersistenceService();

export default appPersistenceService;
export { AppPersistenceService, PERSISTENCE_BASE };
