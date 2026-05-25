const strings = {
  zh: {
    nav: [
      "我的 Agent",
      "Agent 实例",
      "Playground",
      "模型",
      "通道",
      "技能",
      "OrcaTerm",
      "自动化",
      "账单/用量",
      "设置"
    ],
    loading: "加载中",
    noResults: "没有找到匹配 Agent",
    connected: "已连接",
    running: "运行中"
  },
  en: {
    nav: [
      "My Agents",
      "Agent Instances",
      "Playground",
      "Models",
      "Channels",
      "Skills",
      "OrcaTerm",
      "Automation",
      "Billing/Usage",
      "Settings"
    ],
    loading: "Loading",
    noResults: "No matching agents",
    connected: "Connected",
    running: "Running"
  }
};

const locale = "zh";
const t = strings[locale];
const defaultPlaygroundModelId = "custom_subrouter/hy3-preview";
const playgroundStorageKey = "openasstai.playground.conversations.v1";
const quickPrompts = [
  "给 Hermes Agent 设计一个客服欢迎语。",
  "比较 Hy3 preview 和 Claude Sonnet 的适用场景。",
  "把这段用户需求拆成 Agent 技能清单。",
  "生成一个 OpenAI-compatible 请求体示例。"
];
const state = {
  instance: null,
  agent: null,
  logs: [],
  playground: {
    models: [],
    providers: [],
    conversations: [],
    activeConversationId: null,
    selectedProviderId: "",
    selectedModelId: defaultPlaygroundModelId,
    isSending: false
  }
};

const navList = document.querySelector("#nav-list");
const mobileNav = document.querySelector("#mobile-nav");
const mobileMenu = document.querySelector("#mobile-menu");
const searchInput = document.querySelector("#agent-search");
const searchPopover = document.querySelector("#search-popover");
const hero = document.querySelector("#instance-hero");
const metricsGrid = document.querySelector("#metrics-grid");
const agentPanel = document.querySelector("#agent-panel");
const networkPanel = document.querySelector("#network-panel");
const logsPanel = document.querySelector("#logs-panel");
const page = document.querySelector(".page");

renderNav();
bindEvents();
loadRoute();

function renderNav() {
  const items = t.nav
    .map((label) => {
      const active = isNavActive(label) ? " active" : "";
      const icon = labelIcon(label);
      return `<a class="nav-item${active}" href="${escapeHtml(navHref(label))}"><span>${icon}</span>${escapeHtml(label)}</a>`;
    })
    .join("");
  navList.innerHTML = items;
  mobileNav.innerHTML = items;
}

function bindEvents() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput && !isTypingTarget(document.activeElement)) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === "Escape") {
      closeSearch();
      mobileNav.classList.remove("open");
    }
  });

  mobileMenu.addEventListener("click", () => {
    mobileNav.classList.toggle("open");
  });

  searchInput.addEventListener("input", debounce(handleSearch, 140));
  searchInput.addEventListener("focus", handleSearch);
  document.addEventListener("click", (event) => {
    if (!searchPopover.contains(event.target) && !searchInput.contains(event.target)) {
      closeSearch();
    }
  });

  document.querySelector("#assistant-action").addEventListener("click", () => {
    toast("Agent 助手会在 P1 接入实时对话与运行建议。");
  });
  document.querySelector("#more-action").addEventListener("click", () => {
    toast("更多 Agent 操作骨架已预留：重启、暂停、查看配置、删除。");
  });
}

async function loadRoute() {
  if (isPlaygroundPath()) {
    await loadPlaygroundPage();
    return;
  }

  await loadPage();
}

async function loadPage() {
  const instanceId = extractInstanceId() || "ins-hermes-001";
  const [instanceResponse, agentResponse, logsResponse] = await Promise.all([
    fetchJson(`/api/instances/${instanceId}`),
    fetchJson(`/api/instances/${instanceId}/agent`),
    fetchJson(`/api/instances/${instanceId}/agent/logs`)
  ]);

  state.instance = instanceResponse.instance;
  state.agent = agentResponse.agent;
  state.logs = logsResponse.logs;

  renderInstance();
  renderMetrics();
  renderAgent();
  renderNetwork();
  renderLogs();
}

function renderInstance() {
  const instance = state.instance;
  hero.innerHTML = `
    <div>
      <div class="eyebrow">Hermes Agent 实例</div>
      <h1>${escapeHtml(instance.name)}</h1>
      <div class="hero-meta">
        <span class="status-dot"></span>
        <span>${escapeHtml(instance.statusText)}</span>
        <span>${escapeHtml(instance.region)} · ${escapeHtml(instance.zone)}</span>
        <span>IPv4 ${escapeHtml(instance.ipv4)}</span>
        <span>Agent 运行环境 · ${escapeHtml(instance.bundle)}</span>
      </div>
    </div>
    <div class="hero-actions">
      <button class="primary-button" id="assistant-action-live">AI助手</button>
      <button class="secondary-button" id="more-action-live">更多操作</button>
    </div>
  `;
  document.querySelector("#assistant-action-live").addEventListener("click", () => toast("Hermes AI 助手面板将在 P1 接入。"));
  document.querySelector("#more-action-live").addEventListener("click", () => restartAgent());
}

function renderMetrics() {
  const instance = state.instance;
  const cards = [
    {
      label: "CPU",
      value: `${instance.cpu.usage}%`,
      detail: `${instance.cpu.cores} 核`,
      tone: "blue"
    },
    {
      label: "内存",
      value: `${instance.memory.usage}%`,
      detail: `${instance.memory.totalGb}GB`,
      tone: "green"
    },
    {
      label: "运行盘",
      value: `${instance.disk.usage}%`,
      detail: `${instance.disk.totalGb}GB SSD`,
      tone: "orange"
    },
    {
      label: "月流量",
      value: `${instance.traffic.usedGb}GB`,
      detail: `共 ${instance.traffic.includedGb}GB`,
      tone: "purple"
    }
  ];

  metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card ${card.tone}">
          <div class="metric-label">${escapeHtml(card.label)}</div>
          <div class="metric-value">${escapeHtml(card.value)}</div>
          <div class="metric-detail">${escapeHtml(card.detail)}</div>
          <div class="meter"><span style="width: ${parseMeterWidth(card.value)}%"></span></div>
        </article>
      `
    )
    .join("");
}

function renderAgent() {
  const agent = state.agent;
  const plan = agent.modelPlans[0];
  agentPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <div class="eyebrow">Agent 核心能力</div>
        <h2>Hermes Agent</h2>
      </div>
      <span class="pill success">${escapeHtml(agent.statusText)}</span>
    </div>

    <div class="agent-version">
      <span>版本</span>
      <strong>${escapeHtml(agent.version)}</strong>
      <span>最近心跳</span>
      <strong>${formatDate(agent.heartbeatAt)}</strong>
    </div>

    <section class="subsection">
      <div class="section-title">
        <h3>模型</h3>
        <button class="link-button" id="switch-model">切换模型</button>
      </div>
      <div class="warning">${escapeHtml(agent.modelWarning)}</div>
      <div class="plan-card">
        <div>
          <div class="plan-name">${escapeHtml(plan.name)}</div>
          <div class="muted">${escapeHtml(plan.model)} · ${escapeHtml(plan.quotaText)}</div>
        </div>
        <div class="plan-stat">
          <span>${escapeHtml(plan.provider)}</span>
          <strong>${plan.latencyMs}ms</strong>
        </div>
      </div>
      <div class="default-model">
        <span>默认模型 / Provider</span>
        <strong>${escapeHtml(agent.defaultModel.provider)}</strong>
      </div>
    </section>

    <section class="subsection two-column">
      <div>
        <div class="section-title">
          <h3>渠道</h3>
          <button class="link-button" id="connect-channel">连接渠道</button>
        </div>
        <div class="channel-list">
          ${agent.channels
            .map(
              (channel) => `
                <div class="row-item">
                  <span class="channel-icon">${channel.name === "微信" ? "微" : "Q"}</span>
                  <div>
                    <strong>${escapeHtml(channel.name)}</strong>
                    <span>${escapeHtml(channel.account)}</span>
                  </div>
                  <em>${escapeHtml(channel.statusText)}</em>
                </div>
              `
            )
            .join("")}
        </div>
      </div>

      <div>
        <div class="section-title">
          <h3>技能</h3>
          <label class="skill-search">
            <span>SkillHub</span>
            <input type="search" placeholder="搜索技能" />
          </label>
        </div>
        <div class="warning amber">${escapeHtml(agent.skills.warning)}</div>
        <div class="skill-list">
          ${agent.skills.installed
            .map(
              (skill) => `
                <div class="row-item">
                  <span class="skill-icon">S</span>
                  <div>
                    <strong>${escapeHtml(skill.name)}</strong>
                    <span>${escapeHtml(skill.source)}</span>
                  </div>
                  <em>${escapeHtml(skill.version)}</em>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    </section>
  `;

  document.querySelector("#switch-model").addEventListener("click", switchModel);
  document.querySelector("#connect-channel").addEventListener("click", connectChannel);
}

function renderNetwork() {
  const instance = state.instance;
  networkPanel.innerHTML = `
    <div class="panel-header compact">
      <h2>Agent 运行环境</h2>
      <span class="pill">承载实例</span>
    </div>
    <dl class="info-list">
      <div><dt>公网 IPv4</dt><dd>${escapeHtml(instance.ipv4)}</dd></div>
      <div><dt>内网 IPv4</dt><dd>${escapeHtml(instance.privateIpv4)}</dd></div>
      <div><dt>运行系统</dt><dd>${escapeHtml(instance.os)}</dd></div>
      <div><dt>运行时</dt><dd>${escapeHtml(instance.image)}</dd></div>
      <div><dt>OrcaTerm</dt><dd><button class="link-button">打开终端</button></dd></div>
    </dl>
  `;
}

function renderLogs() {
  logsPanel.innerHTML = `
    <div class="panel-header compact">
      <h2>Agent 日志</h2>
      <button class="link-button" id="refresh-logs">刷新</button>
    </div>
    <div class="log-list">
      ${state.logs
        .map(
          (entry) => `
            <div class="log-row ${entry.level}">
              <span>${escapeHtml(entry.level.toUpperCase())}</span>
              <p>${escapeHtml(entry.message)}</p>
              <time>${formatDate(entry.timestamp)}</time>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  document.querySelector("#refresh-logs").addEventListener("click", async () => {
    const response = await fetchJson(`/api/instances/${state.instance.id}/agent/logs`);
    state.logs = response.logs;
    renderLogs();
  });
}

async function loadPlaygroundPage() {
  page.classList.add("playground-page");
  page.innerHTML = `
    <div class="breadcrumb">控制台 / Playground</div>
    <section class="playground-shell" aria-label="OpenAsstAI Playground">
      <aside class="playground-history">
        <div class="history-toolbar">
          <div>
            <div class="eyebrow">Playground</div>
            <h2>会话历史</h2>
          </div>
          <button class="primary-button compact-button" id="new-conversation">新会话</button>
        </div>
        <div class="history-summary" id="history-summary">加载会话中</div>
        <div class="conversation-list" id="conversation-list"></div>
      </aside>

      <section class="playground-chat">
        <header class="playground-chat-header">
          <div class="conversation-heading">
            <div class="eyebrow">Agent Model Playground</div>
            <h1 id="conversation-title">新会话</h1>
            <div class="conversation-updated" id="conversation-updated">本地持久化</div>
          </div>

          <div class="model-toolbar">
            <label class="model-field" for="provider-select">
              <span>Provider</span>
              <select id="provider-select"></select>
            </label>
            <label class="model-field wide" for="model-select">
              <span>Model</span>
              <select id="model-select"></select>
            </label>
            <div class="active-model-badges" id="active-model-badges"></div>
          </div>
        </header>

        <div class="message-list" id="message-list" aria-live="polite"></div>

        <footer class="composer-panel">
          <div class="quick-prompts" id="quick-prompts"></div>
          <form class="composer-form" id="composer-form">
            <textarea id="composer-input" rows="3" placeholder="输入消息，测试当前模型与 Agent 回复风格"></textarea>
            <button class="primary-button send-button" id="send-message" type="submit">发送</button>
          </form>
          <div class="composer-note">
            P0 使用 mock 响应。真实推理边界保留为用户模型凭证 + OpenAI-compatible /v1/chat/completions。
          </div>
        </footer>
      </section>
    </section>
  `;

  const [modelsResponse, conversationsResponse] = await Promise.all([
    fetchJson("/api/playground/models"),
    fetchJson("/api/playground/conversations")
  ]);

  state.playground.models = modelsResponse.models || [];
  state.playground.providers = modelsResponse.providers || groupModelsByProvider(state.playground.models);

  const localConversations = readPlaygroundConversations();
  const serverConversations = normalizeServerConversations(conversationsResponse.conversations || []);
  const conversations = mergeConversations(localConversations, serverConversations);
  state.playground.conversations = conversations.length ? conversations : [createConversation()];
  state.playground.activeConversationId =
    state.playground.conversations.find((conversation) => conversation.id === state.playground.activeConversationId)?.id ||
    state.playground.conversations[0].id;

  const activeConversation = getActiveConversation();
  const activeModel = getModelById(activeConversation?.modelId);
  state.playground.selectedProviderId = activeModel?.providerId || state.playground.providers[0]?.id || "";
  state.playground.selectedModelId = activeConversation?.modelId || activeModel?.id || state.playground.models[0]?.id || "";

  writePlaygroundConversations();
  renderPlayground();
  bindPlaygroundEvents();
}

function bindPlaygroundEvents() {
  document.querySelector("#new-conversation")?.addEventListener("click", () => {
    const conversation = createConversation(state.playground.selectedModelId || defaultPlaygroundModelId);
    state.playground.conversations.unshift(conversation);
    state.playground.activeConversationId = conversation.id;
    writePlaygroundConversations();
    renderPlayground();
    focusComposer();
  });

  document.querySelector("#conversation-list")?.addEventListener("click", (event) => {
    const target = event.target;
    const deleteButton = target.closest("[data-delete-conversation]");
    if (deleteButton) {
      deleteConversation(deleteButton.dataset.deleteConversation);
      return;
    }

    const conversationButton = target.closest("[data-conversation-id]");
    if (conversationButton) {
      state.playground.activeConversationId = conversationButton.dataset.conversationId;
      const conversation = getActiveConversation();
      const model = getModelById(conversation?.modelId);
      state.playground.selectedProviderId = model?.providerId || state.playground.selectedProviderId;
      state.playground.selectedModelId = model?.id || state.playground.selectedModelId;
      renderPlayground();
      focusComposer();
    }
  });

  document.querySelector("#provider-select")?.addEventListener("change", (event) => {
    state.playground.selectedProviderId = event.target.value;
    const nextModel = getModelsForProvider(state.playground.selectedProviderId)[0] || state.playground.models[0];
    updateActiveConversationModel(nextModel?.id || defaultPlaygroundModelId);
    renderPlayground();
  });

  document.querySelector("#model-select")?.addEventListener("change", (event) => {
    updateActiveConversationModel(event.target.value);
    renderPlayground();
  });

  document.querySelector("#quick-prompts")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-quick-prompt]");
    if (!chip) {
      return;
    }
    const input = document.querySelector("#composer-input");
    input.value = chip.dataset.quickPrompt;
    input.focus();
  });

  document.querySelector("#composer-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      document.querySelector("#composer-form").requestSubmit();
    }
  });

  document.querySelector("#composer-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendPlaygroundMessage();
  });
}

function renderPlayground() {
  renderConversationList();
  renderModelSelectors();
  renderActiveConversation();
  renderQuickPrompts();
}

function renderConversationList() {
  const list = document.querySelector("#conversation-list");
  const summary = document.querySelector("#history-summary");
  const conversations = sortedConversations();
  summary.textContent = `${conversations.length} 个会话 · localStorage 持久化`;

  list.innerHTML = conversations
    .map((conversation) => {
      const model = getModelById(conversation.modelId);
      const active = conversation.id === state.playground.activeConversationId ? " active" : "";
      const lastMessage = conversation.messages.at(-1);
      const preview = lastMessage?.content || "空会话，选择模型后开始测试。";
      return `
        <article class="conversation-item${active}" data-conversation-id="${escapeHtml(conversation.id)}">
          <button class="conversation-select" type="button" data-conversation-id="${escapeHtml(conversation.id)}">
            <span class="conversation-item-title">${escapeHtml(conversation.title || "新会话")}</span>
            <span class="conversation-item-preview">${escapeHtml(preview)}</span>
            <span class="conversation-item-meta">
              ${escapeHtml(model?.providerName || "Provider")} / ${escapeHtml(model?.modelName || "Model")}
              · ${escapeHtml(formatDate(conversation.updatedAt))}
            </span>
          </button>
          <button class="delete-conversation" type="button" title="删除会话" data-delete-conversation="${escapeHtml(
            conversation.id
          )}">×</button>
        </article>
      `;
    })
    .join("");
}

function renderModelSelectors() {
  const providerSelect = document.querySelector("#provider-select");
  const modelSelect = document.querySelector("#model-select");
  const conversation = getActiveConversation();
  const activeModel = getModelById(conversation?.modelId) || state.playground.models[0];
  const activeProviderId = activeModel?.providerId || state.playground.selectedProviderId;
  const providerModels = getModelsForProvider(activeProviderId);

  state.playground.selectedProviderId = activeProviderId;
  state.playground.selectedModelId = activeModel?.id || "";

  providerSelect.innerHTML = state.playground.providers
    .map(
      (provider) =>
        `<option value="${escapeHtml(provider.id)}" ${provider.id === activeProviderId ? "selected" : ""}>${escapeHtml(
          provider.name
        )}</option>`
    )
    .join("");

  modelSelect.innerHTML = providerModels
    .map(
      (model) =>
        `<option value="${escapeHtml(model.id)}" ${model.id === activeModel?.id ? "selected" : ""}>${escapeHtml(
          model.displayName
        )}</option>`
    )
    .join("");

  renderActiveModelBadges(activeModel);
}

function renderActiveModelBadges(model) {
  const badges = document.querySelector("#active-model-badges");
  if (!model) {
    badges.innerHTML = "";
    return;
  }
  badges.innerHTML = `
    <span class="model-badge provider">${escapeHtml(model.providerName)}</span>
    <span class="model-badge">${escapeHtml(model.modelName)}</span>
    <span class="model-badge muted-badge">${escapeHtml(model.contextWindow)} · ${model.latencyMs}ms</span>
  `;
}

function renderActiveConversation() {
  const conversation = getActiveConversation();
  const title = document.querySelector("#conversation-title");
  const updated = document.querySelector("#conversation-updated");
  const messageList = document.querySelector("#message-list");
  const model = getModelById(conversation?.modelId);

  title.textContent = conversation?.title || "新会话";
  updated.textContent = conversation
    ? `最后更新 ${formatDate(conversation.updatedAt)} · ${model?.providerName || "Provider"} / ${model?.modelName || "Model"}`
    : "选择会话开始测试";

  if (!conversation || conversation.messages.length === 0) {
    messageList.innerHTML = `
      <div class="playground-empty">
        <div class="empty-icon">P</div>
        <h2>选择模型，开始一次 Agent 对话试验</h2>
        <p>会话会保存在当前浏览器 localStorage。切换模型会记录在当前会话上，后续消息将带上新的模型身份。</p>
      </div>
    `;
    return;
  }

  messageList.innerHTML = conversation.messages.map(renderMessage).join("");
  messageList.scrollTop = messageList.scrollHeight;
}

function renderMessage(message) {
  const isUser = message.role === "user";
  const model = getModelById(message.modelId);
  const roleLabel = isUser ? "User" : "Assistant";
  const modelLine = isUser
    ? "OpenAsstAI Console"
    : `${message.providerName || model?.providerName || "Provider"} / ${message.modelName || model?.modelName || "Model"}`;

  return `
    <article class="message-row ${isUser ? "message-user" : "message-assistant"}" id="message-${escapeHtml(message.id)}">
      <div class="message-avatar">${isUser ? "U" : "A"}</div>
      <div class="message-bubble">
        <div class="message-meta">
          <strong>${roleLabel}</strong>
          <span>${escapeHtml(modelLine)}</span>
          ${message.mock ? `<em>Mock/P0</em>` : ""}
          <time>${escapeHtml(formatDate(message.createdAt))}</time>
        </div>
        <div class="message-content">${escapeHtml(message.content).replaceAll("\n", "<br />")}</div>
      </div>
    </article>
  `;
}

function renderQuickPrompts() {
  const promptRoot = document.querySelector("#quick-prompts");
  promptRoot.innerHTML = quickPrompts
    .map(
      (prompt) =>
        `<button class="prompt-chip" type="button" data-quick-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`
    )
    .join("");
}

async function sendPlaygroundMessage() {
  if (state.playground.isSending) {
    return;
  }

  const input = document.querySelector("#composer-input");
  const content = input.value.trim();
  if (!content) {
    toast("请输入要测试的消息。");
    return;
  }

  let conversation = getActiveConversation();
  if (!conversation) {
    conversation = createConversation(state.playground.selectedModelId || defaultPlaygroundModelId);
    state.playground.conversations.unshift(conversation);
    state.playground.activeConversationId = conversation.id;
  }

  const now = new Date().toISOString();
  const userMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content,
    createdAt: now
  };
  conversation.messages.push(userMessage);
  conversation.title = conversation.title === "新会话" ? deriveConversationTitle(content) : conversation.title;
  conversation.updatedAt = now;
  input.value = "";
  state.playground.isSending = true;
  renderPlayground();
  setComposerDisabled(true);

  try {
    const response = await fetchJson("/api/playground/chat", {
      method: "POST",
      body: JSON.stringify({
        conversationId: conversation.id,
        modelId: conversation.modelId,
        messages: conversation.messages
      })
    });
    conversation.messages.push(response.message);
    conversation.updatedAt = response.message.createdAt || new Date().toISOString();
    writePlaygroundConversations();
    renderPlayground();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    conversation.messages.push({
      id: `asst-error-${Date.now()}`,
      role: "assistant",
      content: `【Mock/P0】请求 Playground API 失败：${errorMessage}`,
      modelId: conversation.modelId,
      mock: true,
      createdAt: new Date().toISOString()
    });
    writePlaygroundConversations();
    renderPlayground();
  } finally {
    state.playground.isSending = false;
    setComposerDisabled(false);
    focusComposer();
  }
}

function updateActiveConversationModel(modelId) {
  const model = getModelById(modelId) || state.playground.models[0];
  const conversation = getActiveConversation();
  if (!model || !conversation) {
    return;
  }
  conversation.modelId = model.id;
  conversation.providerId = model.providerId;
  conversation.updatedAt = new Date().toISOString();
  state.playground.selectedProviderId = model.providerId;
  state.playground.selectedModelId = model.id;
  writePlaygroundConversations();
}

function deleteConversation(conversationId) {
  const conversations = state.playground.conversations;
  if (conversations.length <= 1) {
    const conversation = conversations[0];
    conversation.messages = [];
    conversation.title = "新会话";
    conversation.updatedAt = new Date().toISOString();
    writePlaygroundConversations();
    renderPlayground();
    return;
  }

  state.playground.conversations = conversations.filter((conversation) => conversation.id !== conversationId);
  if (state.playground.activeConversationId === conversationId) {
    state.playground.activeConversationId = sortedConversations()[0]?.id || state.playground.conversations[0]?.id;
  }
  writePlaygroundConversations();
  renderPlayground();
}

function createConversation(modelId = defaultPlaygroundModelId) {
  const model = getModelById(modelId) || state.playground.models[0] || {
    id: defaultPlaygroundModelId,
    providerId: "custom_subrouter"
  };
  const now = new Date().toISOString();
  return {
    id: `pg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: "新会话",
    modelId: model.id,
    providerId: model.providerId,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function readPlaygroundConversations() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(playgroundStorageKey) || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeConversation).filter(Boolean);
  } catch {
    return [];
  }
}

function writePlaygroundConversations() {
  window.localStorage.setItem(playgroundStorageKey, JSON.stringify(state.playground.conversations));
}

function normalizeServerConversations(conversations) {
  return conversations.map(normalizeConversation).filter(Boolean);
}

function normalizeConversation(conversation) {
  if (!conversation || typeof conversation !== "object") {
    return null;
  }
  const modelId = getModelById(conversation.modelId)?.id || defaultPlaygroundModelId;
  return {
    id: String(conversation.id || `pg-${Date.now()}`),
    title: String(conversation.title || "新会话"),
    modelId,
    providerId: String(conversation.providerId || getModelById(modelId)?.providerId || "custom_subrouter"),
    createdAt: conversation.createdAt || new Date().toISOString(),
    updatedAt: conversation.updatedAt || conversation.createdAt || new Date().toISOString(),
    messages: Array.isArray(conversation.messages)
      ? conversation.messages
          .filter((message) => message && (message.role === "user" || message.role === "assistant"))
          .map((message) => ({
            id: String(message.id || `msg-${Date.now()}`),
            role: message.role,
            content: String(message.content || ""),
            modelId: message.modelId,
            providerName: message.providerName,
            modelName: message.modelName,
            mock: Boolean(message.mock),
            createdAt: message.createdAt || new Date().toISOString()
          }))
      : []
  };
}

function mergeConversations(localConversations, serverConversations) {
  const byId = new Map();
  [...serverConversations, ...localConversations].forEach((conversation) => {
    byId.set(conversation.id, conversation);
  });
  return [...byId.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function sortedConversations() {
  return [...state.playground.conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function getActiveConversation() {
  return state.playground.conversations.find((conversation) => conversation.id === state.playground.activeConversationId);
}

function getModelById(modelId) {
  return state.playground.models.find((model) => model.id === modelId);
}

function getModelsForProvider(providerId) {
  return state.playground.models.filter((model) => model.providerId === providerId);
}

function groupModelsByProvider(models) {
  return models.reduce((result, model) => {
    const provider = result.find((item) => item.id === model.providerId);
    if (provider) {
      provider.models.push(model);
    } else {
      result.push({ id: model.providerId, name: model.providerName, models: [model] });
    }
    return result;
  }, []);
}

function deriveConversationTitle(content) {
  return content.length > 20 ? `${content.slice(0, 20)}...` : content;
}

function setComposerDisabled(disabled) {
  const input = document.querySelector("#composer-input");
  const button = document.querySelector("#send-message");
  if (input) {
    input.disabled = disabled;
  }
  if (button) {
    button.disabled = disabled;
    button.textContent = disabled ? "生成中" : "发送";
  }
}

function focusComposer() {
  window.requestAnimationFrame(() => {
    document.querySelector("#composer-input")?.focus();
  });
}

async function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) {
    closeSearch();
    return;
  }

  const response = await fetchJson(`/api/agents/search?q=${encodeURIComponent(q)}`);
  const results = response.results || [];
  searchPopover.classList.remove("hidden");
  searchPopover.innerHTML = results.length
    ? results
        .map(
          (result) => `
            <a class="search-result" href="${escapeHtml(result.href)}">
              <strong>${escapeHtml(result.name)}</strong>
              <span>${escapeHtml(result.type)} · ${escapeHtml(result.ipv4)} · ${escapeHtml(result.statusText)}</span>
            </a>
          `
        )
        .join("")
    : `<div class="empty-state">${t.noResults}</div>`;
}

async function switchModel() {
  const response = await fetchJson(`/api/instances/${state.instance.id}/agent/models/default`, {
    method: "PATCH",
    body: JSON.stringify({
      provider: "custom_subrouter",
      model: "Hy3 preview",
      planId: "hy-token-personal"
    })
  });
  state.agent = response.agent;
  renderAgent();
  toast("默认模型已保持为 custom_subrouter。");
}

async function connectChannel() {
  const response = await fetchJson(`/api/instances/${state.instance.id}/agent/channels`, {
    method: "POST",
    body: JSON.stringify({
      id: `custom-${Date.now()}`,
      name: "自定义渠道",
      account: "新接入账号"
    })
  });
  state.agent.channels = response.channels;
  renderAgent();
  toast("渠道接入请求已写入 mock API。");
}

async function restartAgent() {
  const response = await fetchJson(`/api/instances/${state.instance.id}/agent/actions/restart`, {
    method: "POST",
    body: JSON.stringify({})
  });
  state.agent = response.agent;
  const logsResponse = await fetchJson(`/api/instances/${state.instance.id}/agent/logs`);
  state.logs = logsResponse.logs;
  renderLogs();
  toast("Hermes Agent 重启请求已进入队列。");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function extractInstanceId() {
  const match = window.location.pathname.match(/instances\/([^/]+)/);
  return match?.[1];
}

function isPlaygroundPath() {
  return window.location.pathname === "/playground" || window.location.pathname === "/console/playground";
}

function navHref(label) {
  if (label === "Playground") {
    return "/console/playground";
  }
  return "/console/hermes/instances/ins-hermes-001";
}

function isNavActive(label) {
  if (label === "Playground") {
    return isPlaygroundPath();
  }
  if (isPlaygroundPath()) {
    return false;
  }
  return label === "我的 Agent" || label === "My Agents";
}

function closeSearch() {
  searchPopover.classList.add("hidden");
  searchPopover.innerHTML = "";
}

function parseMeterWidth(value) {
  const number = Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
  if (Number.isNaN(number)) {
    return 24;
  }
  return Math.max(8, Math.min(100, number));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function labelIcon(label) {
  const icons = new Map([
    ["我的 Agent", "A"],
    ["Agent 实例", "I"],
    ["Playground", "P"],
    ["模型", "M"],
    ["通道", "C"],
    ["技能", "S"],
    ["OrcaTerm", "T"],
    ["自动化", "R"],
    ["账单/用量", "$"],
    ["设置", "G"],
    ["My Agents", "A"],
    ["Agent Instances", "I"],
    ["Models", "M"],
    ["Channels", "C"],
    ["Skills", "S"],
    ["Automation", "R"],
    ["Billing/Usage", "$"],
    ["Settings", "G"]
  ]);
  return icons.get(label) || label.trim().slice(0, 1).toUpperCase();
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function isTypingTarget(element) {
  if (!element) {
    return false;
  }
  const tagName = element.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || element.isContentEditable;
}

function toast(message) {
  const existing = document.querySelector(".toast");
  existing?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 2600);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
