const strings = {
  zh: {
    nav: [
      "我的 Agent",
      "Agent 实例",
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
const state = {
  instance: null,
  agent: null,
  logs: []
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

function navHref(label) {
  return "/console/hermes/instances/ins-hermes-001";
}

function isNavActive(label) {
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
