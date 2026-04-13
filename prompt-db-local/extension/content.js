// @ts-check
// Φ_total(content) — Content script с поддержкой сессий

/** @type {{ promptId: string; text: string; tagColor?: string; tagNumber?: number } | null} */
let lastInsertedPrompt = null;
/** @type {Set<string>} */
const usedPromptIds = new Set();
let sendObserversInstalled = false;
let activeSendToken = 0;

// Φ_total(session:cache) — кэш текущей сессии
/** @type {string | null} */
let cachedSessionName = null;
/** @type {number} */
let sessionCacheTimestamp = 0;
const SESSION_CACHE_TTL = 30000; // 30 секунд

const BADGE_ATTRIBUTE = 'data-prompt-db-badge';
const MESSAGE_ATTRIBUTE = 'data-prompt-db-message';
const MESSAGE_SELECTOR = '.chat-history-part.user-part';

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// Φ_total(session:extract) — извлечение имени сессии из Producer AI
function extractSessionName() {
  // Проверяем кэш
  const now = Date.now();
  if (cachedSessionName && (now - sessionCacheTimestamp) < SESSION_CACHE_TTL) {
    return cachedSessionName;
  }
  
  // Пробуем найти имя сессии в разных местах страницы
  // Вариант 1: Заголовок страницы (title)
  const pageTitle = document.title;
  if (pageTitle && pageTitle !== 'Producer' && pageTitle !== 'producer.ai') {
    cachedSessionName = pageTitle.slice(0, 100);
    sessionCacheTimestamp = now;
    return cachedSessionName;
  }
  
  // Вариант 2: Элементы с названием сессии (часто это h1 или специальный элемент)
  const sessionTitleSelectors = [
    'h1.session-title',
    '[data-testid="session-title"]',
    '.session-name',
    '.chat-title',
    '[class*="title"]',
    'header h1',
    '.sidebar .active .title',
  ];
  
  for (const selector of sessionTitleSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent) {
      const text = element.textContent.trim();
      if (text && text.length > 0 && text !== 'Producer') {
        cachedSessionName = text.slice(0, 100);
        sessionCacheTimestamp = now;
        return cachedSessionName;
      }
    }
  }
  
  // Вариант 3: Извлекаем из URL (если есть ID сессии)
  const urlMatch = window.location.pathname.match(/\/session\/([^\/]+)/);
  if (urlMatch) {
    cachedSessionName = `Session ${urlMatch[1].slice(0, 20)}`;
    sessionCacheTimestamp = now;
    return cachedSessionName;
  }
  
  // Вариант 4: Первое сообщение пользователя как название сессии
  const firstUserMessage = document.querySelector('.chat-history-part.user-part:first-of-type');
  if (firstUserMessage) {
    const text = firstUserMessage.textContent?.trim().slice(0, 50);
    if (text) {
      cachedSessionName = text;
      sessionCacheTimestamp = now;
      return cachedSessionName;
    }
  }
  
  // Fallback: timestamp-based name
  cachedSessionName = `Session ${new Date().toLocaleString()}`;
  sessionCacheTimestamp = now;
  return cachedSessionName;
}

// Отправляем имя сессии в background script
function reportSessionName() {
  const sessionName = extractSessionName();
  chrome.runtime.sendMessage({
    type: 'SET_SESSION_NAME',
    payload: {
      sessionName,
      extractedFromPage: true,
    },
  });
  return sessionName;
}

const findLastTextarea = () => {
  const textareas = [...document.querySelectorAll('textarea')].filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  return textareas[textareas.length - 1] || null;
};

const ensurePromptBadge = (target, payload) => {
  const host = target.parentElement || target;

  if (host && getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }

  /** @type {HTMLDivElement | null} */
  let badge = host.querySelector(`[${BADGE_ATTRIBUTE}="textarea"]`);

  if (!badge) {
    badge = document.createElement('div');
    badge.setAttribute(BADGE_ATTRIBUTE, 'textarea');
    badge.style.position = 'absolute';
    badge.style.top = '8px';
    badge.style.right = '8px';
    badge.style.zIndex = '999999';
    badge.style.padding = '6px 10px';
    badge.style.borderRadius = '999px';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '700';
    badge.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)';
    host.appendChild(badge);
  }

  badge.textContent = `USED #${payload.tagNumber || '?'}`;
  badge.style.background = payload.tagColor || '#3aa56c';
  badge.style.color = '#ffffff';
};

const decorateMessageNode = (node, payload) => {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  if (node.getAttribute(MESSAGE_ATTRIBUTE) === payload.promptId) {
    return true;
  }

  node.setAttribute(MESSAGE_ATTRIBUTE, payload.promptId);
  node.style.outline = `2px solid ${payload.tagColor || '#3aa56c'}`;
  node.style.outlineOffset = '4px';
  node.style.borderRadius = '14px';
  node.style.boxShadow = `0 0 0 4px ${payload.tagColor || '#3aa56c'}33`;

  if (!node.querySelector(`[${BADGE_ATTRIBUTE}="${payload.promptId}"]`)) {
    const badge = document.createElement('div');
    badge.setAttribute(BADGE_ATTRIBUTE, payload.promptId);
    badge.textContent = `#${payload.tagNumber || '?'} sent`;
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '6px';
    badge.style.marginBottom = '8px';
    badge.style.padding = '4px 10px';
    badge.style.borderRadius = '999px';
    badge.style.background = payload.tagColor || '#3aa56c';
    badge.style.color = '#ffffff';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '700';
    node.prepend(badge);
  }

  return true;
};

const matchesPromptText = (node, payload) => {
  const nodeText = normalizeText(node.textContent);
  const promptText = normalizeText(payload.text);

  if (!nodeText || !promptText) {
    return false;
  }

  if (nodeText === promptText) {
    return true;
  }

  const shortPrompt = promptText.slice(0, 220);
  return nodeText.includes(shortPrompt) || shortPrompt.includes(nodeText.slice(0, 180));
};

const findSentMessageNode = (payload) => {
  const nodes = [...document.querySelectorAll(MESSAGE_SELECTOR)].filter(
    (node) => node instanceof HTMLElement,
  );

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = /** @type {HTMLElement} */ (nodes[index]);

    if (node.getAttribute(MESSAGE_ATTRIBUTE) === payload.promptId) {
      return node;
    }

    if (matchesPromptText(node, payload)) {
      return node;
    }
  }

  return null;
};

const waitForSentMessageHighlight = (payload, token) => {
  const immediate = findSentMessageNode(payload);

  if (immediate) {
    decorateMessageNode(immediate, payload);
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, 8000);

    const observer = new MutationObserver(() => {
      if (token !== activeSendToken) {
        window.clearTimeout(timeout);
        observer.disconnect();
        resolve(false);
        return;
      }

      const candidate = findSentMessageNode(payload);

      if (!candidate) {
        return;
      }

      window.clearTimeout(timeout);
      observer.disconnect();
      decorateMessageNode(candidate, payload);
      resolve(true);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
};

// Φ_total(session:notify) — уведомление с именем сессии
const notifyPromptEvent = (type, payload) => {
  const sessionName = extractSessionName();
  
  chrome.runtime.sendMessage({
    type,
    payload: {
      promptId: payload.promptId,
      usedAt: Date.now(),
      url: window.location.href,
      tabId: -1,
      windowId: -1,
      sessionName, // Φ_total(session:context) — добавляем имя сессии
    },
  });
};

const triggerSentMessageFlow = (reason) => {
  if (!lastInsertedPrompt) {
    return;
  }

  const payload = lastInsertedPrompt;
  activeSendToken += 1;
  const token = activeSendToken;

  window.setTimeout(() => {
    void waitForSentMessageHighlight(payload, token).then((highlighted) => {
      if (highlighted) {
        void notifyPromptEvent('PROMPT_SENT_MESSAGE', payload);
      }
    });
  }, reason === 'keyboard' ? 400 : 750);
};

const installSendObservers = () => {
  if (sendObserversInstalled) {
    return;
  }

  sendObserversInstalled = true;

  document.addEventListener(
    'keydown',
    (event) => {
      const target = /** @type {HTMLElement | null} */ (event.target);

      if (!target || target.tagName !== 'TEXTAREA') {
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        triggerSentMessageFlow('keyboard');
      }
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      const target = /** @type {HTMLElement | null} */ (event.target);

      if (!target) {
        return;
      }

      const button = target.closest('button, [role="button"], input[type="submit"]');

      if (!button) {
        return;
      }

      const label = normalizeText(button.textContent || button.getAttribute('aria-label') || button.value);

      if (/send|submit|generate|run|chat|continue/i.test(label)) {
        triggerSentMessageFlow('button');
      }
    },
    true,
  );
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PROMPTS_UPDATED') {
    const prompts = Array.isArray(message.payload?.prompts) ? message.payload.prompts : [];
    usedPromptIds.clear();

    prompts.forEach((prompt) => {
      if (prompt?.used && prompt?.id) {
        usedPromptIds.add(prompt.id);
      }
    });

    sendResponse?.({ ok: true });
    return false;
  }

  if (message?.type !== 'INSERT_PROMPT') {
    return false;
  }

  const target = findLastTextarea();

  if (!target) {
    sendResponse({
      ok: false,
      error: 'No visible textarea found on this producer.ai page.',
    });
    return false;
  }

  if (usedPromptIds.has(message.payload.promptId)) {
    sendResponse({
      ok: false,
      error: 'Prompt is already marked as used in this browser session.',
    });
    return false;
  }

  target.focus();
  target.value = message.payload.text;
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));

  lastInsertedPrompt = {
    promptId: message.payload.promptId,
    text: message.payload.text,
    tagColor: message.payload.tagColor,
    tagNumber: message.payload.tagNumber,
  };

  ensurePromptBadge(target, lastInsertedPrompt);
  installSendObservers();
  void notifyPromptEvent('PROMPT_USED', lastInsertedPrompt);

  sendResponse({
    ok: true,
    promptId: message.payload.promptId,
  });
  return false;
});

// Φ_total(session:init) — отправляем имя сессии при загрузке
reportSessionName();

chrome.runtime.sendMessage(
  {
    type: 'GET_PROMPTS',
  },
  (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      return;
    }

    const prompts = Array.isArray(response.prompts) ? response.prompts : [];
    usedPromptIds.clear();

    prompts.forEach((prompt) => {
      if (prompt?.used && prompt?.id) {
        usedPromptIds.add(prompt.id);
      }
    });
  },
);

// Обновляем имя сессии при изменении title
const titleObserver = new MutationObserver(() => {
  const newSessionName = extractSessionName();
  if (newSessionName !== cachedSessionName) {
    reportSessionName();
  }
});
titleObserver.observe(document.querySelector('title') || document.head, {
  childList: true,
  subtree: true,
});
