// @ts-check

const statusNode = document.getElementById('status');
const presetNode = document.getElementById('preset');
const patternNode = document.getElementById('pattern');
const includeTagsNode = document.getElementById('include-tags');
const excludeTagsNode = document.getElementById('exclude-tags');
const profileIdNode = document.getElementById('profile-id');
const generateButton = document.getElementById('generate');
const refreshPromptsButton = document.getElementById('refresh-prompts');
const refreshPresetsButton = document.getElementById('refresh-presets');
const saveSettingsButton = document.getElementById('save-settings');
const promptListNode = document.getElementById('prompt-list');
const summaryNode = document.getElementById('summary');

/** @type {Array<{ id: string; label: string; description?: string }>} */
let exportPresets = [];
/** @type {Array<any>} */
let prompts = [];

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const setStatus = (message, isError = false) => {
  statusNode.textContent = message;
  statusNode.classList.toggle('error', isError);
};

const sendMessage = (message) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || 'Extension request failed.'));
        return;
      }

      resolve(response);
    });
  });

const renderSummary = () => {
  const usedCount = prompts.filter((prompt) => prompt.used).length;
  const freeCount = prompts.length - usedCount;

  summaryNode.innerHTML = [
    `<span class="badge">${prompts.length} total</span>`,
    `<span class="badge">${freeCount} unused</span>`,
    `<span class="badge">${usedCount} used</span>`,
  ].join('');
};

const createUsedMetaText = (prompt) => {
  if (!prompt.usedMeta) {
    return 'New prompt';
  }

  const url = prompt.usedMeta.url ? new URL(prompt.usedMeta.url).host : 'unknown page';
  const profile = prompt.usedMeta.chromeProfileId || 'default profile';

  return `Used at ${new Date(prompt.usedMeta.usedAt).toLocaleString()} / ${url} / ${profile}`;
};

const renderPromptList = () => {
  promptListNode.innerHTML = '';

  if (prompts.length === 0) {
    promptListNode.innerHTML = '<div class="prompt-card">No generated prompts yet.</div>';
    renderSummary();
    return;
  }

  prompts.forEach((prompt) => {
    const card = document.createElement('article');
    card.className = prompt.used ? 'prompt-card used' : 'prompt-card';

    const label = document.createElement('span');
    label.className = 'pill';
    label.textContent = `#${prompt.tagNumber || '?'} ${prompt.presetId || 'custom'}`;
    label.style.color = prompt.tagColor || '#3d7a57';

    const text = document.createElement('div');
    text.className = 'prompt-text';
    text.textContent = prompt.text;

    const meta = document.createElement('div');
    meta.className = 'prompt-meta';
    meta.textContent = createUsedMetaText(prompt);

    const actions = document.createElement('div');
    actions.className = 'row';

    const insertButton = document.createElement('button');
    insertButton.className = prompt.used ? 'secondary' : 'primary';
    insertButton.textContent = prompt.used ? 'Already used' : 'Insert';
    insertButton.disabled = Boolean(prompt.used);
    insertButton.addEventListener('click', () => {
      Promise.resolve(handleInsertPrompt(prompt.id)).catch((error) => {
        setStatus(error instanceof Error ? error.message : 'Insert failed.', true);
      });
    });

    actions.appendChild(insertButton);
    card.append(label, text, meta, actions);
    promptListNode.appendChild(card);
  });

  renderSummary();
};

const renderPresetOptions = () => {
  presetNode.innerHTML = '';

  if (exportPresets.length === 0) {
    const option = document.createElement('option');
    option.value = 'default_export';
    option.textContent = 'default_export';
    presetNode.appendChild(option);
    return;
  }

  exportPresets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label || preset.id;
    presetNode.appendChild(option);
  });
};

const refreshPromptState = async () => {
  const response = await sendMessage({
    type: 'GET_PROMPTS',
  });

  prompts = Array.isArray(response.prompts) ? response.prompts : [];
  renderPromptList();
};

const refreshExportPresets = async () => {
  const response = await sendMessage({
    type: 'GET_EXPORT_PRESETS',
  });

  exportPresets = Array.isArray(response.presets) ? response.presets : [];
  renderPresetOptions();
};

const loadSettings = async () => {
  const response = await sendMessage({
    type: 'GET_SETTINGS',
  });

  profileIdNode.value = response.settings?.chromeProfileId || '';
};

const saveSettings = async () => {
  await sendMessage({
    type: 'UPDATE_SETTINGS',
    payload: {
      chromeProfileId: profileIdNode.value.trim(),
    },
  });
  setStatus('Profile label saved.');
};

const generateBatch = async () => {
  const payload = {
    presetId: presetNode.value || 'default_export',
    pattern: patternNode.value.trim(),
    tagsInclude: splitCsv(includeTagsNode.value),
    tagsExclude: splitCsv(excludeTagsNode.value),
  };

  setStatus('Generating batch from local Electron app...');
  const response = await sendMessage({
    type: 'GENERATE_BATCH',
    payload,
  });

  prompts = Array.isArray(response.prompts) ? response.prompts : [];
  renderPromptList();
  setStatus(`Generated ${prompts.length} prompt(s).`);
};

const handleInsertPrompt = async (promptId) => {
  setStatus('Sending prompt to active producer.ai tab...');
  await sendMessage({
    type: 'INSERT_PROMPT_REQUEST',
    payload: { promptId },
  });
  setStatus('Prompt inserted. Waiting for page send/highlight sync...');
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'PROMPTS_UPDATED') {
    prompts = Array.isArray(message.payload?.prompts) ? message.payload.prompts : prompts;
    renderPromptList();
    return;
  }

  if (message?.type === 'SETTINGS_UPDATED') {
    profileIdNode.value = message.payload?.chromeProfileId || '';
  }
});

generateButton.addEventListener('click', () => {
  void generateBatch().catch((error) => {
    setStatus(error instanceof Error ? error.message : 'Generate failed.', true);
  });
});

refreshPromptsButton.addEventListener('click', () => {
  void refreshPromptState().catch((error) => {
    setStatus(error instanceof Error ? error.message : 'Unable to refresh prompts.', true);
  });
});

refreshPresetsButton.addEventListener('click', () => {
  void refreshExportPresets()
    .then(() => setStatus('Export presets refreshed.'))
    .catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Unable to refresh presets.', true);
    });
});

saveSettingsButton.addEventListener('click', () => {
  void saveSettings().catch((error) => {
    setStatus(error instanceof Error ? error.message : 'Unable to save settings.', true);
  });
});

Promise.all([refreshExportPresets(), refreshPromptState(), loadSettings()])
  .then(() => {
    setStatus('Extension state loaded.');
  })
  .catch((error) => {
    setStatus(error instanceof Error ? error.message : 'Failed to initialize popup.', true);
  });
