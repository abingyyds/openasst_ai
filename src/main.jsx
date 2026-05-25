import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  Check,
  CircleCheckBig,
  CircleHelp,
  ChevronRight,
  Clipboard,
  Copy,
  Cpu,
  Database,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  ListRestart,
  LogOut,
  Menu,
  MessageSquare,
  MonitorCog,
  PanelTop,
  Play,
  Plug,
  RefreshCw,
  Search,
  Server,
  ServerCog,
  Settings,
  Shield,
  BadgeInfo,
  Coins,
  Square,
  TerminalSquare,
  Trash2,
  Wrench,
  X,
  Zap
} from "lucide-react";
import {
  apiRequest,
  clearToken,
  formatHours,
  formatMoney,
  formatTime,
  getToken,
  parseHashRoute,
  setRoute,
  setToken,
  statusTone
} from "./api.js";
import "./styles.css";

const channelLabels = {
  web_chat: "Web Chat",
  wechat: "WeChat",
  qq: "QQ",
  feishu: "Feishu"
};

const modelProviders = ["openai", "anthropic", "openrouter", "azure-openai", "custom"];

function IconButton({ title, children, ...props }) {
  return (
    <button className="icon" type="button" title={title} aria-label={title} {...props}>
      {children}
    </button>
  );
}

function Pill({ children, tone }) {
  return <span className={`pill ${tone || "neutral"}`}>{children}</span>;
}

function StatusPill({ status }) {
  return <Pill tone={statusTone(status)}>{status || "unknown"}</Pill>;
}

function Metric({ label, value, note, icon, tone = "neutral" }) {
  return (
    <div className={`metric ${tone}`.trim()}>
      <div className="metric-top">
        <div className="metric-label">{label}</div>
        {icon ? <div className="metric-icon">{icon}</div> : null}
      </div>
      <div className="metric-value">{value}</div>
      {note ? <div className="metric-note">{note}</div> : null}
    </div>
  );
}

function SurfaceCard({ children, className = "", as: Component = "section" }) {
  return <Component className={`surface-card ${className}`.trim()}>{children}</Component>;
}

function FeatureTile({ icon, title, description, meta, tone = "neutral" }) {
  return (
    <div className={`feature-tile ${tone}`.trim()}>
      <div className="feature-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {meta ? <span>{meta}</span> : null}
      </div>
    </div>
  );
}

function CommandPreview({ title, lines, footer, status = "Ready" }) {
  return (
    <div className="command-preview">
      <div className="command-preview-bar">
        <div className="window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <strong>{title}</strong>
        <Pill tone="success">{status}</Pill>
      </div>
      <div className="command-preview-body">
        {lines.map((line, index) => (
          <pre className="code-block" key={`${line}-${index}`}>{line}</pre>
        ))}
      </div>
      {footer ? <div className="command-preview-footer">{footer}</div> : null}
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

function Panel({ title, subtitle, icon, actions, children, className = "" }) {
  return (
    <section className={`surface-card panel ${className}`.trim()}>
      <div className="panel-header">
        <div>
          <div className="section-title">
            {icon} {title}
          </div>
          {subtitle ? <div className="section-subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="toolbar">{actions}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Empty({ children, title, icon, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <CircleHelp size={16} />}</div>
      <div className="empty-copy">
        <strong>{title || children}</strong>
        {title && children ? <p>{children}</p> : null}
      </div>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

const secretPreviewLabels = {
  "\u5df2\u4fdd\u5b58": "Saved",
  "\u672a\u914d\u7f6e": "Not configured"
};

function formatSecretPreview(value) {
  return secretPreviewLabels[value] || value || "Not configured";
}

function hasSavedSecret(value) {
  return formatSecretPreview(value) === "Saved";
}

function copyText(value) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }
  return Promise.resolve();
}

function CopyableCommand({ label, value, helper }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="command-box">
      <div className="item-row">
        <strong>{label}</strong>
        <button type="button" onClick={handleCopy}>
          {copied ? <Clipboard size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-block">{value}</pre>
      {helper ? <div className="muted">{helper}</div> : null}
    </div>
  );
}

function FlowStepList({ steps }) {
  return (
    <div className="flow-step-list">
      {steps.map((step, index) => {
        const icon = step.state === "done" ? <CircleCheckBig size={16} /> : step.state === "active" ? <ArrowRight size={16} /> : <CircleHelp size={16} />;
        return (
          <div className={`flow-step ${step.state}`} key={step.key || index}>
            <div className="flow-step-mark">{icon}</div>
            <div className="flow-step-body">
              <div className="item-row">
                <strong>{step.label}</strong>
                <Pill tone={step.state === "done" ? "success" : step.state === "active" ? "warning" : "neutral"}>
                  {step.state === "done" ? "Done" : step.state === "active" ? "In progress" : "Planned"}
                </Pill>
              </div>
              <div className="muted">{step.note}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function useRoute() {
  const [route, setRouteState] = useState(parseHashRoute);
  useEffect(() => {
    const onHashChange = () => setRouteState(parseHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
}

function useApi(token, onAuthError) {
  return useCallback(
    async (path, options = {}) => {
      try {
        return await apiRequest(path, { ...options, token });
      } catch (error) {
        if (error.status === 401) onAuthError?.();
        throw error;
      }
    },
    [token, onAuthError]
  );
}

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("demo@openasst.ai");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = await apiRequest(`/api/auth/${mode}`, {
        method: "POST",
        body: { email, password }
      });
      onAuth(payload.token, payload.user);
      setRoute("market");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function useDemo(kind) {
    if (kind === "admin") {
      setEmail("admin@openasst.ai");
      setPassword("admin123");
    } else {
      setEmail("demo@openasst.ai");
      setPassword("demo123");
    }
    setMode("login");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <section className="auth-hero surface-card spotlight-surface">
          <div className="brand">
            <div className="brand-mark">OA</div>
            <div>
              <div className="brand-name">OpenAsstAI</div>
              <div className="brand-tag">Official agent workspace marketplace</div>
            </div>
          </div>
          <div className="auth-kicker">COSS-style shell for the Phase 1 MVP</div>
          <h1 className="auth-title">Official agent workspaces, setup, and control.</h1>
          <p className="auth-note">
            Browse official templates, launch a Linux workspace, configure models and channels, and manage the instance from one quiet control surface.
          </p>
          <div className="feature-grid">
            <FeatureTile
              icon={<Search size={17} />}
              title="Discover"
              description="Inspect official agents, provider listings, plans, and runtime hints."
              meta="Marketplace"
              tone="blue"
            />
            <FeatureTile
              icon={<TerminalSquare size={17} />}
              title="Operate"
              description="Open model, channel, terminal, and log controls from one shell."
              meta="Console"
              tone="green"
            />
          </div>
          <div className="kpi-strip">
            <Metric label="Runtime" value="Local sandbox" note="Docker adapter preserved" icon={<Server size={15} />} />
            <Metric label="Templates" value="2" note="Hermes / OpenClaw" icon={<Bot size={15} />} />
            <Metric label="Channels" value="4" note="Web Chat ready" icon={<Plug size={15} />} />
            <Metric label="Billing" value="Estimate only" note="No payment integration" icon={<Coins size={15} />} />
          </div>
          <CommandPreview
            title="workspace launch"
            lines={[
              "$ openasst marketplace select hermes",
              "$ provision --plan starter --channel web_chat",
              "status: workspace ready"
            ]}
            footer="Demo credentials are prefilled for local evaluation."
          />
          <div className="toolbar">
            <button type="button" onClick={() => useDemo("user")}>
              <Bot size={16} /> Demo user
            </button>
            <button type="button" onClick={() => useDemo("admin")}>
              <Shield size={16} /> Demo admin
            </button>
          </div>
        </section>
        <form className="auth-form surface-card stack" onSubmit={submit}>
          <div className="tabbar">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Sign in
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
              Create account
            </button>
          </div>
          <label className="section">
            <span className="section-title">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label className="section">
            <span className="section-title">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error ? <Pill tone="danger">{error}</Pill> : null}
          <button className="primary" type="submit" disabled={loading}>
            <KeyRound size={16} /> {loading ? "Working" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Shell({ user, onLogout, route, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const nav = [
    { id: "market", label: "Marketplace", icon: <Search size={16} /> },
    { id: "instances", label: "Instances", icon: <Boxes size={16} /> },
    { id: "provider", label: "Provider", icon: <ServerCog size={16} /> }
  ];
  if (user?.role === "admin") nav.push({ id: "admin", label: "Admin", icon: <Shield size={16} /> });

  const current = nav.find((item) => item.id === route.page);
  const pageLabel =
    route.page === "instance"
      ? "Instance"
      : current?.label || "Marketplace";

  useEffect(() => {
    setNavOpen(false);
  }, [route.page, route.id]);

  return (
    <div className="shell">
      <aside className={`shell-sidebar ${navOpen ? "open" : ""}`}>
        <div className="sidebar-card surface-card">
          <button className="brand ghost sidebar-brand" type="button" onClick={() => setRoute("market")}>
            <div className="brand-mark">OA</div>
            <div>
              <div className="brand-name">OpenAsstAI</div>
              <div className="brand-tag">Workspace control plane</div>
            </div>
          </button>
          <div className="sidebar-copy">
            Official templates, instance setup, provider nodes, and admin controls in one place.
          </div>
          <div className="sidebar-status">
            <Pill tone="success">Live shell</Pill>
            <span>Phase 1 MVP</span>
          </div>
        </div>
        <nav className="nav-rail">
          {nav.map((item) => (
            <button
              type="button"
              key={item.id}
              className={route.page === item.id ? "active" : ""}
              onClick={() => setRoute(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              <ChevronRight className="nav-chevron" size={15} />
            </button>
          ))}
        </nav>
        <div className="sidebar-card surface-card user-card">
          <div className="sidebar-meta">
            <span className="muted">Signed in as</span>
            <strong>{user.email}</strong>
            <Pill tone={user.role === "admin" ? "success" : "neutral"}>{user.role}</Pill>
          </div>
          <button type="button" className="ghost" onClick={onLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      {navOpen ? <button type="button" className="shell-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}
      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton title={navOpen ? "Close navigation" : "Open navigation"} onClick={() => setNavOpen((value) => !value)}>
              {navOpen ? <X size={16} /> : <Menu size={16} />}
            </IconButton>
            <button className="brand ghost shell-brand" type="button" onClick={() => setRoute("market")}>
              <div className="brand-mark">OA</div>
              <div>
                <div className="brand-name">OpenAsstAI</div>
                <div className="brand-tag">{pageLabel}</div>
              </div>
            </button>
          </div>
          <div className="topbar-center">
            <div className="topbar-kicker">OpenAsstAI console</div>
            <div className="topbar-label">{pageLabel}</div>
          </div>
          <div className="topbar-right">
            <span className="topbar-status">
              <Activity size={15} /> Online
            </span>
            <span className="user-chip">
              <Shield size={15} /> {user.email}
            </span>
            <IconButton title="Sign out" onClick={onLogout}>
              <LogOut size={16} />
            </IconButton>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <div className={`mobile-sheet ${navOpen ? "open" : ""}`}>
        <div className="mobile-sheet-panel surface-card">
          <div className="item-row">
            <strong>Navigate</strong>
            <IconButton title="Close navigation" onClick={() => setNavOpen(false)}>
              <X size={16} />
            </IconButton>
          </div>
          <nav className="nav-rail">
            {nav.map((item) => (
              <button
                type="button"
                key={item.id}
                className={route.page === item.id ? "active" : ""}
                onClick={() => setRoute(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

function MarketPage({ api, onInstanceCreated }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [framework, setFramework] = useState("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selected = templates.find((template) => template.id === selectedId) || templates[0];
  const selectedPlan =
    selected?.plans?.find((plan) => plan.id === selectedPlanId) || selected?.plans?.[0] || null;
  const marketStats = useMemo(() => {
    const officialCount = templates.filter((template) => template.official).length;
    const providerCount = Math.max(templates.length - officialCount, 0);
    const frameworks = new Set(templates.map((template) => template.framework).filter(Boolean));
    const lowPrice = templates.length
      ? Math.min(...templates.map((template) => displayHourlyPrice(template)))
      : 0;
    return { officialCount, providerCount, frameworkCount: frameworks.size, lowPrice };
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((template) => {
      const matchQuery = [template.name, template.description, template.framework]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchFramework = framework === "all" || template.framework === framework;
      return matchQuery && matchFramework;
    });
  }, [templates, query, framework]);

  function displayHourlyPrice(template) {
    const planPrices = (template.plans || [])
      .map((plan) => Number(plan.pricePerHourCents || 0))
      .filter((price) => price > 0);
    if (planPrices.length > 0) return Math.min(...planPrices);
    return Number(template.basePriceCents || 0);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api("/api/templates");
      setTemplates(payload.templates);
      if (!selectedId && payload.templates[0]) {
        setSelectedId(payload.templates[0].id);
        setSelectedPlanId(payload.templates[0].plans?.[0]?.id || "");
        setName(`${payload.templates[0].name} Instance`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selected && !selected.plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(selected.plans?.[0]?.id || "");
    }
  }, [selected, selectedPlanId]);

  async function createInstance() {
    if (!selected || !selectedPlan) return;
    setError("");
    setCreating(true);
    try {
      const payload = await api("/api/instances", {
        method: "POST",
        body: {
          templateId: selected.id,
          planId: selectedPlan.id,
          name: name || `${selected.name} Instance`
        }
      });
      onInstanceCreated?.(payload.instance);
      setRoute(`instance/${payload.instance.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="market-hero spotlight-surface surface-card">
        <div className="market-hero-copy">
          <div className="page-eyebrow">Marketplace</div>
          <h1>Agent marketplace</h1>
          <p>Choose an official or provider-published Agent, inspect setup details, and launch a callable workspace from one control surface.</p>
          <div className="hero-actions">
            <button type="button" className="primary" onClick={createInstance} disabled={creating || !selected || !selectedPlan}>
              <Zap size={16} /> {creating ? "Creating" : "Launch selected"}
            </button>
            <button type="button" onClick={load} disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>
        <div className="market-hero-panel">
          <div className="kpi-strip">
            <Metric label="Official" value={marketStats.officialCount} note="Platform templates" icon={<Shield size={15} />} tone="success" />
            <Metric label="Provider" value={marketStats.providerCount} note="Published agents" icon={<ServerCog size={15} />} />
            <Metric label="Frameworks" value={marketStats.frameworkCount || "-"} note="Available now" icon={<Cpu size={15} />} />
            <Metric label="Starts at" value={`${formatMoney(marketStats.lowPrice)}/h`} note="Lowest plan" icon={<Coins size={15} />} tone="warning" />
          </div>
          <CommandPreview
            title="launch recipe"
            lines={[
              selected ? `$ template ${selected.framework}/${selected.name}` : "$ template loading",
              selectedPlan ? `$ plan ${selectedPlan.name} --${selectedPlan.cpu}cpu --${selectedPlan.memoryMb}mb` : "$ plan select",
              selected ? `$ channel ${(selected.defaultChannels || []).map((channel) => channelLabels[channel] || channel).join(", ") || "web_chat"}` : "$ channel web_chat"
            ]}
            footer={selected ? selected.runtimeKind : "Loading template metadata"}
            status={selected ? "Selected" : "Loading"}
          />
        </div>
      </section>

      <div className="grid-2">
        <Panel title="Templates" subtitle="Official and approved provider Agents with currently available node capacity" icon={<Bot size={16} />}>
          <div className="stack">
            <div className="form-2">
              <input placeholder="Search templates, capabilities, or framework" value={query} onChange={(event) => setQuery(event.target.value)} />
              <select value={framework} onChange={(event) => setFramework(event.target.value)}>
                <option value="all">All frameworks</option>
                <option value="hermes">Hermes</option>
                <option value="openclaw">OpenClaw</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {error ? <Pill tone="danger">{error}</Pill> : null}
            {loading ? (
              <Empty title="Loading templates">Fetching marketplace listings.</Empty>
            ) : filtered.length === 0 ? (
              <Empty title="No matching templates">Adjust the search or framework filter.</Empty>
            ) : (
              <div className="template-list">
                {filtered.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className={`item template-card ${selected?.id === template.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedId(template.id);
                      setSelectedPlanId(template.plans?.[0]?.id || "");
                      setName(`${template.name} Instance`);
                    }}
                  >
                    <div className="item-row template-card-top">
                      <div className="template-title">
                        <span className="template-glyph"><Bot size={16} /></span>
                        <strong>{template.name}</strong>
                      </div>
                      <span className="toolbar">
                        <Pill tone={template.official ? "success" : "warning"}>{template.official ? "Official" : "Provider"}</Pill>
                        <Pill>{template.framework}</Pill>
                        <Pill tone="neutral">{template.runtimeKind}</Pill>
                      </span>
                    </div>
                    <div className="muted">{template.description}</div>
                    <div className="chip-row">
                      {(template.capabilities?.models || []).map((cap) => (
                        <span className="chip" key={cap}>{cap}</span>
                      ))}
                      {(template.capabilities?.channels || []).slice(0, 3).map((cap) => (
                        <span className="chip" key={cap}>{cap}</span>
                      ))}
                      <span className="chip">{template.installMethod}</span>
                    </div>
                    <div className="item-row template-card-foot">
                      <span className="muted">
                        {template.defaultModel.provider}/{template.defaultModel.model}
                      </span>
                      <strong>From {formatMoney(displayHourlyPrice(template))}/h</strong>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Launch workspace" subtitle="Allocate an official Linux node and seed the selected template" icon={<Server size={16} />}>
          {selected ? (
            <div className="stack">
              <div className="section">
                <div className="section-title">{selected.name}</div>
                <div className="section-subtitle">{selected.description}</div>
              </div>
              <div className="grid-3">
                <Metric label="Install" value={selected.installMethod} note={selected.runtimeKind} />
                <Metric label="Start" value={selected.startCommand || "Platform-managed start"} note={selected.healthCheck || "Workspace health check"} />
                <Metric label="Default" value={`${selected.defaultModel.provider}/${selected.defaultModel.model}`} note={`${selected.defaultChannels.length} channels · ${selected.defaultSkills.length} skills`} />
              </div>
              <div className="item">
                <div className="item-row">
                  <strong>Provisioning notes</strong>
                  <Pill tone="warning">Demo sandbox</Pill>
                </div>
                <div className="muted">
                  This phase provisions a platform-managed sandbox and seeds the selected template, default model, channels, and skills. No raw SSH password is stored or used.
                </div>
              </div>
              <CopyableCommand
                label="Install command"
                value={selected.installCommand || `install via ${selected.runtimeKind}`}
                helper="This is a demo install/start hint, not a direct server takeover flow."
              />
              <CopyableCommand
                label="Start command"
                value={selected.startCommand || "Platform-managed start"}
                helper={selected.healthCheck || "Health checks run against the workspace and runtime state."}
              />
              <div className="form-grid">
                <label className="section">
                  <span className="section-title">Instance name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="section">
                  <span className="section-title">Plan</span>
                  <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                    {(selected.plans || []).map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} · {plan.cpu} CPU · {plan.memoryMb} MB · {plan.diskGb} GB · {plan.region} · {formatMoney(plan.pricePerHourCents)}/h
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedPlan ? (
                <div className="grid-3">
                  <Metric label="CPU" value={selectedPlan.cpu} note="Resource limit" />
                  <Metric label="Memory" value={`${selectedPlan.memoryMb} MB`} note="Workspace memory" />
                  <Metric label="Region" value={selectedPlan.region} note={selected.official ? "Official node" : "Provider node"} />
                </div>
              ) : null}
              <div className="chip-row">
                {(selected.defaultChannels || []).map((channel) => (
                  <span className="chip" key={channel}>{channelLabels[channel] || channel}</span>
                ))}
                {(selected.capabilities?.skills || []).map((skill) => (
                  <span className="chip" key={skill}>{skill}</span>
                ))}
                {(selected.configHints || []).slice(0, 2).map((hint) => (
                  <span className="chip" key={hint}>{hint}</span>
                ))}
              </div>
              <button className="primary" type="button" onClick={createInstance} disabled={creating || !selectedPlan}>
                <Zap size={16} /> {creating ? "Creating" : "Create and launch"}
              </button>
            </div>
          ) : (
              <Empty title="Select a template">Pick an agent from the marketplace list to inspect launch details.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ProviderPage({ api }) {
  const [profile, setProfile] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [ledger, setLedger] = useState({ summary: {}, entries: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [installCommand, setInstallCommand] = useState("");
  const [installToken, setInstallToken] = useState("");
  const [draft, setDraft] = useState({
    displayName: "",
    contact: "",
    payoutNote: "",
    nodeName: "",
    region: "cn-shanghai",
    totalCpu: 4,
    totalMemoryMb: 8192,
    totalDiskGb: 120,
    pricePerHourCents: 18,
    publicHost: "",
    templateName: "",
    templateDescription: "",
    templateFramework: "custom",
    templateStatus: "active",
    templateModelProvider: "openai",
    templateModel: "gpt-4.1-mini",
    templatePlanName: "Starter",
    templateCpu: 1,
    templateMemoryMb: 1024,
    templateDiskGb: 10,
    templatePricePerHourCents: 18
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await api("/api/provider/profile");
      setProfile(payload.profile);
      setNodes(payload.nodes);
      setLedger(payload.ledger);
      if (payload.profile) {
        const templatePayload = await api("/api/provider/templates");
        setTemplates(templatePayload.templates || []);
      } else {
        setTemplates([]);
      }
      if (payload.nodes.length === 0 && payload.profile) {
        setInstallCommand(`curl -fsSL ${window.location.origin}/install-node.sh | sh -s -- --token <token>`);
      }
      if (payload.profile) {
        setDraft((current) => ({
          ...current,
          displayName: payload.profile.displayName || current.displayName,
          contact: payload.profile.contact || current.contact,
          payoutNote: payload.profile.payoutNote || current.payoutNote
        }));
      }
    } catch (err) {
      setError(err.message);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await api("/api/provider/apply", {
        method: "POST",
        body: {
          displayName: draft.displayName,
          contact: draft.contact,
          payoutNote: draft.payoutNote
        }
      });
      setProfile(payload.profile);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createNode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await api("/api/provider/nodes", {
        method: "POST",
        body: {
          name: draft.nodeName,
          region: draft.region,
          totalCpu: draft.totalCpu,
          totalMemoryMb: draft.totalMemoryMb,
          totalDiskGb: draft.totalDiskGb,
          pricePerHourCents: draft.pricePerHourCents,
          publicHost: draft.publicHost
        }
      });
      setNodes((items) => [payload.node, ...items]);
      setInstallCommand(payload.installCommand || "");
      setInstallToken(payload.token || "");
      setDraft((current) => ({
        ...current,
        nodeName: "",
        publicHost: "",
        pricePerHourCents: payload.node.pricePerHourCents || current.pricePerHourCents
      }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function rotateToken(nodeId) {
    setBusy(true);
    setError("");
    try {
      const payload = await api(`/api/provider/nodes/${nodeId}/rotate-token`, { method: "POST" });
      setNodes((items) => items.map((node) => (node.id === nodeId ? payload.node : node)));
      setInstallCommand(payload.installCommand || "");
      setInstallToken(payload.token || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function publishTemplate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await api("/api/provider/templates", {
        method: "POST",
        body: {
          name: draft.templateName,
          framework: draft.templateFramework,
          description: draft.templateDescription,
          status: draft.templateStatus,
          defaultModelProvider: draft.templateModelProvider,
          defaultModel: draft.templateModel,
          defaultChannels: ["web_chat"],
          defaultSkills: [],
          installMethod: "provider-managed",
          runtimeKind: "provider-node",
          planName: draft.templatePlanName,
          cpu: draft.templateCpu,
          memoryMb: draft.templateMemoryMb,
          diskGb: draft.templateDiskGb,
          region: draft.region,
          pricePerHourCents: draft.templatePricePerHourCents
        }
      });
      setTemplates((items) => [payload.template, ...items]);
      setDraft((current) => ({
        ...current,
        templateName: "",
        templateDescription: ""
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Provider"
        title="Provider console"
        subtitle="Apply for provider access, add nodes, and manage the install token handoff."
        actions={<button type="button" onClick={load}><RefreshCw size={16} /> Refresh</button>}
      />

      <Panel
        title="Provider summary"
        subtitle="Profile status, node count, and ledger snapshot"
        icon={<ServerCog size={16} />}
      >
        {error ? <Pill tone="danger">{error}</Pill> : null}
        <div className="grid-3">
          <Metric label="Profile" value={profile?.status || "none"} note={profile ? profile.displayName : "Apply first"} icon={<BadgeInfo size={15} />} />
          <Metric label="Nodes" value={nodes.length} note={`${nodes.filter((node) => node.status === "healthy").length} healthy`} icon={<Server size={15} />} tone="success" />
          <Metric label="Agents" value={templates.length} note={`${templates.filter((template) => template.status === "active").length} active in marketplace`} icon={<Bot size={15} />} />
          <Metric label="Ledger" value={formatMoney(ledger?.summary?.providerCents || 0)} note={`${Math.round(ledger?.summary?.runtimeHours || 0)} runtime h`} icon={<Coins size={15} />} tone="warning" />
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Provider profile" subtitle="Approved providers can add nodes" icon={<BadgeInfo size={16} />}>
          <form className="stack" onSubmit={saveProfile}>
            <label className="section">
              <span className="section-title">Display name</span>
              <input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
            </label>
            <label className="section">
              <span className="section-title">Contact</span>
              <input value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} />
            </label>
            <label className="section">
              <span className="section-title">Payout note</span>
              <textarea value={draft.payoutNote} onChange={(event) => setDraft({ ...draft, payoutNote: event.target.value })} />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              <Check size={16} /> Save provider info
            </button>
          </form>
        </Panel>

        <Panel title="Node handoff" subtitle="Generate a token and install command for a server you control" icon={<Server size={16} />}>
          <form className="stack" onSubmit={createNode}>
            <div className="form-2">
              <label className="section">
                <span className="section-title">Node name</span>
                <input value={draft.nodeName} onChange={(event) => setDraft({ ...draft, nodeName: event.target.value })} placeholder="e.g. shanghai-node-01" />
              </label>
              <label className="section">
                <span className="section-title">Region</span>
                <input value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} />
              </label>
            </div>
            <div className="form-2">
              <label className="section">
                <span className="section-title">CPU</span>
                <input type="number" value={draft.totalCpu} onChange={(event) => setDraft({ ...draft, totalCpu: Number(event.target.value) })} />
              </label>
              <label className="section">
                <span className="section-title">Memory MB</span>
                <input type="number" value={draft.totalMemoryMb} onChange={(event) => setDraft({ ...draft, totalMemoryMb: Number(event.target.value) })} />
              </label>
            </div>
            <div className="form-2">
              <label className="section">
                <span className="section-title">Disk GB</span>
                <input type="number" value={draft.totalDiskGb} onChange={(event) => setDraft({ ...draft, totalDiskGb: Number(event.target.value) })} />
              </label>
              <label className="section">
                <span className="section-title">Price / hour (cents)</span>
                <input type="number" value={draft.pricePerHourCents} onChange={(event) => setDraft({ ...draft, pricePerHourCents: Number(event.target.value) })} />
              </label>
            </div>
            <label className="section">
              <span className="section-title">Public host</span>
              <input value={draft.publicHost} onChange={(event) => setDraft({ ...draft, publicHost: event.target.value })} placeholder="optional public hostname" />
            </label>
            <button className="primary" type="submit" disabled={busy || !profile}>
              <ServerCog size={16} /> Create node token
            </button>
            <div className="muted">
              Node registration is token-based. The server calls back to the platform with a node agent and heartbeat, and no SSH password is stored.
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Publish Agent" subtitle="Create a provider-managed marketplace Agent that routes web chat to your healthy node" icon={<Bot size={16} />}>
        <form className="stack" onSubmit={publishTemplate}>
          <div className="form-2">
            <label className="section">
              <span className="section-title">Agent name</span>
              <input value={draft.templateName} onChange={(event) => setDraft({ ...draft, templateName: event.target.value })} placeholder="e.g. Support Concierge" />
            </label>
            <label className="section">
              <span className="section-title">Framework</span>
              <select value={draft.templateFramework} onChange={(event) => setDraft({ ...draft, templateFramework: event.target.value })}>
                <option value="custom">custom</option>
                <option value="hermes">hermes</option>
                <option value="openclaw">openclaw</option>
              </select>
            </label>
          </div>
          <label className="section">
            <span className="section-title">Marketplace description</span>
            <textarea value={draft.templateDescription} onChange={(event) => setDraft({ ...draft, templateDescription: event.target.value })} placeholder="What this Agent does for buyers" />
          </label>
          <div className="form-2">
            <label className="section">
              <span className="section-title">Default model provider</span>
              <select value={draft.templateModelProvider} onChange={(event) => setDraft({ ...draft, templateModelProvider: event.target.value })}>
                {modelProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
            </label>
            <label className="section">
              <span className="section-title">Default model</span>
              <input value={draft.templateModel} onChange={(event) => setDraft({ ...draft, templateModel: event.target.value })} />
            </label>
          </div>
          <div className="form-2">
            <label className="section">
              <span className="section-title">Plan name</span>
              <input value={draft.templatePlanName} onChange={(event) => setDraft({ ...draft, templatePlanName: event.target.value })} />
            </label>
            <label className="section">
              <span className="section-title">Agent price / hour (cents)</span>
              <input type="number" value={draft.templatePricePerHourCents} onChange={(event) => setDraft({ ...draft, templatePricePerHourCents: Number(event.target.value) })} />
            </label>
          </div>
          <div className="form-2">
            <label className="section">
              <span className="section-title">CPU</span>
              <input type="number" value={draft.templateCpu} onChange={(event) => setDraft({ ...draft, templateCpu: Number(event.target.value) })} />
            </label>
            <label className="section">
              <span className="section-title">Memory MB</span>
              <input type="number" value={draft.templateMemoryMb} onChange={(event) => setDraft({ ...draft, templateMemoryMb: Number(event.target.value) })} />
            </label>
          </div>
          <button className="primary" type="submit" disabled={busy || profile?.status !== "approved"}>
            <PanelTop size={16} /> Publish to marketplace
          </button>
          <div className="muted">Active provider Agents appear in the marketplace immediately. Purchases are provisioned on provider nodes and Web Chat is dispatched as node tasks.</div>
        </form>
        <div className="stack list-gap">
          {templates.length === 0 ? <Empty>No provider Agents published yet.</Empty> : null}
          {templates.map((template) => (
            <div className="item" key={template.id}>
              <div className="item-row">
                <div>
                  <strong>{template.name}</strong>
                  <div className="muted">{template.framework} · {template.runtimeKind || "provider-node"}</div>
                </div>
                <StatusPill status={template.status} />
              </div>
              <div className="chip-row">
                <span className="chip">{template.plans?.[0]?.name || "No plan"}</span>
                <span className="chip">{formatMoney(template.plans?.[0]?.pricePerHourCents || 0)}/h</span>
                <span className="chip">Web Chat</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Install command" subtitle="One-line callback install for the node agent" icon={<MonitorCog size={16} />}>
        {installCommand ? (
          <CopyableCommand
            label="Latest command"
            value={installCommand}
            helper="Use this on the server you want to hand to the platform."
          />
        ) : (
          <Empty>After creating a node, copy the install command and run it on the target server.</Empty>
        )}
        {installToken ? <div className="provider-note">This token is only recoverable from the command shown here. Rotate the token if this browser session is lost.</div> : null}
      </Panel>

      <Panel title="Nodes" subtitle="Registration, heartbeat, and approval visibility" icon={<Server size={16} />}>
        <div className="stack">
          {nodes.length === 0 ? <Empty>No registered nodes yet.</Empty> : null}
          {nodes.map((node) => (
            <div className="item" key={node.id}>
              <div className="item-row">
                <div>
                  <strong>{node.name}</strong>
                  <div className="muted">
                    {node.region} · {node.providerStatus || "unknown"} · {node.dockerStatus || "unknown"}
                  </div>
                </div>
                <StatusPill status={node.status} />
              </div>
              <div className="chip-row">
                <span className="chip">{node.totalCpu} CPU</span>
                <span className="chip">{node.totalMemoryMb} MB</span>
                <span className="chip">{node.totalDiskGb} GB</span>
                <span className="chip">{node.agentVersion || "no agent"}</span>
              </div>
              <div className="item-row">
                <span className="muted">Heartbeat {formatTime(node.lastHeartbeatAt)}</span>
                <div className="toolbar">
                  <button type="button" onClick={() => rotateToken(node.id)} disabled={busy}>
                    <RefreshCw size={16} /> Rotate token
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Ledger" subtitle="Internal estimate only, no real payment" icon={<Coins size={16} />}>
        <div className="grid-3">
          <Metric label="Gross" value={formatMoney(ledger?.summary?.grossCents || 0)} icon={<Coins size={15} />} />
          <Metric label="Platform fee" value={formatMoney(ledger?.summary?.platformFeeCents || 0)} icon={<Gauge size={15} />} />
          <Metric label="Provider" value={formatMoney(ledger?.summary?.providerCents || 0)} icon={<ServerCog size={15} />} tone="success" />
        </div>
      </Panel>
    </div>
  );
}

function InstancesPage({ api }) {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api("/api/instances");
      setInstances(payload.instances);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Instances"
        title="Your instances"
        subtitle="Track lifecycle state, rough cost, and open the control console."
        actions={
          <>
            <button type="button" onClick={() => setRoute("market")}>
              <Zap size={16} /> New instance
            </button>
            <button type="button" onClick={load}>
              <RefreshCw size={16} /> Refresh
            </button>
          </>
        }
      />

      <Panel title="Instance list" subtitle="Open an instance to manage models, channels, skills, and terminal access" icon={<Boxes size={16} />}>
        <div className="stack">
          {error ? <Pill tone="danger">{error}</Pill> : null}
          {loading ? (
            <Empty>Loading instances</Empty>
          ) : instances.length === 0 ? (
            <Empty
              title="No instances yet"
              action={
                <button type="button" onClick={() => setRoute("market")}>
                  <Zap size={16} /> Open marketplace
                </button>
              }
            >
              Start from the marketplace to provision a workspace.
            </Empty>
          ) : (
            <div className="instance-list">
              {instances.map((instance) => (
                <button type="button" key={instance.id} className="item instance-card" onClick={() => setRoute(`instance/${instance.id}`)}>
                  <div className="item-row">
                    <div className="template-title">
                      <span className="template-glyph"><Boxes size={16} /></span>
                      <strong>{instance.name}</strong>
                    </div>
                    <StatusPill status={instance.status} />
                  </div>
                  <div className="chip-row">
                    <span className="chip">{instance.templateName}</span>
                    <span className="chip">{instance.planName}</span>
                    <span className="chip">{instance.region}</span>
                    <span className="chip">{formatMoney(instance.usage?.estimatedCents || 0)}</span>
                  </div>
                  <div className="item-row instance-card-foot">
                    <span className="muted">{instance.id}</span>
                    <ChevronRight size={16} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function InstanceConsole({ api, token, id }) {
  const [instance, setInstance] = useState(null);
  const [setup, setSetup] = useState(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [instancePayload, setupPayload] = await Promise.all([
        api(`/api/instances/${id}`),
        api(`/api/instances/${id}/setup`)
      ]);
      setInstance(instancePayload.instance);
      setSetup(setupPayload.setup);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function lifecycle(action) {
    if (!instance) return;
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}/${action}`, { method: "POST" });
      setInstance(payload.instance);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <Empty>Loading instance</Empty>;
  if (error && !instance) return <Empty>{error}</Empty>;
  if (!instance) return <Empty>Instance not found</Empty>;
  const tabs = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
    { id: "models", label: "Models", icon: <Cpu size={16} /> },
    { id: "channels", label: "Channels", icon: <Plug size={16} /> },
    { id: "skills", label: "Skills", icon: <Wrench size={16} /> },
    { id: "terminal", label: "Terminal", icon: <TerminalSquare size={16} /> },
    { id: "logs", label: "Logs", icon: <FileText size={16} /> },
    { id: "settings", label: "Settings", icon: <Settings size={16} /> }
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Instance console"
        title={instance.name}
        subtitle={`${instance.templateName} · ${instance.id}`}
        actions={
          <>
            <StatusPill status={instance.status} />
            <button type="button" onClick={load}>
              <RefreshCw size={16} /> Refresh
            </button>
          </>
        }
      />
      <Panel
        title="Workspace tabs"
        subtitle="Configure the instance, inspect logs, or open the terminal"
        icon={<Bot size={16} />}
      >
        <div className="tabbar">
          {tabs.map((item) => (
            <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        {error ? <div className="panel-error"><Pill tone="danger">{error}</Pill></div> : null}
      </Panel>

      {setup ? (
        <Panel title="Setup Checklist" subtitle="Complete the setup path in order" icon={<PanelTop size={16} />}>
          <FlowStepList
            steps={setup.steps.map((step, index) => ({
              key: step.key,
              label: step.label,
              state: step.done ? "done" : index === setup.steps.findIndex((item) => !item.done) ? "active" : "todo",
              note:
                step.key === "configure_model"
                  ? setup.model
                    ? `${setup.model.provider}/${setup.model.model} · ${setup.model.credentialPreview}`
                    : "Pick a provider and save the API key"
                  : step.key === "enable_channel"
                    ? setup.channels.find((channel) => channel.type === "web_chat")?.status === "active"
                      ? "Web Chat is active"
                      : "Enable Web Chat first"
                      : step.key === "enable_skills"
                        ? step.note || `${setup.skills.filter((skill) => skill.status === "enabled").length} enabled`
                      : step.key === "test_chat"
                        ? `${setup.recentChatCount} messages`
                        : step.key === "terminal_logs"
                          ? `${setup.recentLogCount} log entries`
                          : instance.templateName
            }))}
          />
        </Panel>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab instance={instance} api={api} onUpdate={setInstance} onLifecycle={lifecycle} setup={setup} />
      ) : null}
      {tab === "models" ? <ModelsTab api={api} instance={instance} /> : null}
      {tab === "channels" ? <ChannelsTab api={api} instance={instance} /> : null}
      {tab === "skills" ? <SkillsTab api={api} instance={instance} /> : null}
      {tab === "terminal" ? <TerminalTab token={token} instance={instance} /> : null}
      {tab === "logs" ? <LogsTab api={api} instance={instance} /> : null}
      {tab === "settings" ? (
        <SettingsTab api={api} instance={instance} onUpdate={setInstance} onLifecycle={lifecycle} />
      ) : null}
    </div>
  );
}

function OverviewTab({ instance, api, onUpdate, onLifecycle, setup }) {
  const [healthBusy, setHealthBusy] = useState(false);
  const nextStepIndex = (setup?.steps || []).findIndex((item) => !item.done);

  async function healthCheck() {
    setHealthBusy(true);
    try {
      const payload = await api(`/api/instances/${instance.id}/health-check`, { method: "POST" });
      onUpdate(payload.instance);
    } finally {
      setHealthBusy(false);
    }
  }

  return (
    <div className="grid-2">
      <Panel
        title="Overview"
        subtitle="Status, plan, node, and current estimate"
        icon={<Gauge size={16} />}
        actions={
          <>
            <button type="button" onClick={() => onLifecycle("start")} disabled={instance.status === "running" || instance.status === "destroyed"}>
              <Play size={16} /> Start
            </button>
            <button type="button" onClick={() => onLifecycle("stop")} disabled={instance.status !== "running"}>
              <Square size={16} /> Stop
            </button>
            <button type="button" onClick={() => onLifecycle("restart")} disabled={instance.status === "destroyed"}>
              <ListRestart size={16} /> Restart
            </button>
          </>
        }
      >
        <div className="grid-3">
          <Metric label="Status" value={<StatusPill status={instance.status} />} note={instance.errorReason || "runtime state"} icon={<Activity size={15} />} tone={instance.status === "running" ? "success" : "neutral"} />
          <Metric label="Plan" value={instance.planName} note={`${instance.cpu} CPU · ${instance.memoryMb} MB · ${instance.diskGb} GB`} icon={<Cpu size={15} />} />
          <Metric label="Estimate" value={formatMoney(instance.usage?.estimatedCents || 0)} note={`${formatHours(instance.usage?.runtimeHours || 0)} runtime`} icon={<Coins size={15} />} tone="warning" />
          <Metric label="Node" value={instance.nodeName} note={`${instance.region} · ${instance.nodeStatus}`} icon={<Server size={15} />} />
          <Metric
            label="Runtime"
            value={instance.nodeType === "provider" ? "Provider node" : "Local sandbox"}
            note={instance.nodeType === "provider" ? "chat/provision via node tasks" : instance.workspacePath.split("/").slice(-2).join("/")}
            icon={<TerminalSquare size={15} />}
          />
          <Metric label="Started" value={formatTime(instance.startedAt)} note={formatTime(instance.createdAt)} icon={<Gauge size={15} />} />
        </div>
      </Panel>
      <Panel
        title="Health"
        subtitle={instance.nodeType === "provider" ? "Checks provider node reachability and instance state" : "The local sandbox checks workspace and instance state"}
        icon={<Activity size={16} />}
        actions={
            <button type="button" onClick={healthCheck} disabled={healthBusy}>
              <Check size={16} /> Health check
            </button>
        }
      >
        <div className="stack">
          <div className="item health-card">
            <div className="item-row">
              <strong>{instance.nodeType === "provider" ? "Provider node" : "Local sandbox"}</strong>
              <Pill tone={instance.nodeStatus === "offline" ? "danger" : "success"}>{instance.nodeStatus || instance.status}</Pill>
            </div>
            <div className="muted">
              {instance.nodeType === "provider"
                ? "This Agent runs on the provider's registered node. Provisioning, lifecycle actions, and Web Chat are dispatched through node tasks; user-visible replies come from the provider runtime command."
                : "This environment does not have Docker. The Phase 1 MVP uses isolated workspaces to simulate a Linux agent sandbox and keeps the Docker runtime adapter boundary intact."}
            </div>
          </div>
          <div className="item health-card">
            <div className="item-row">
              <strong>Billing mode</strong>
              <Pill tone="success">Estimate</Pill>
            </div>
            <div className="muted">Internal billing is estimated from runtime and chat tokens. No payment provider is connected.</div>
          </div>
        </div>
      </Panel>
      <Panel title="Next actions" subtitle="Finish the setup flow in order" icon={<BadgeInfo size={16} />}>
        <div className="stack">
          {(setup?.steps || []).map((step, index) => (
            <div className="item" key={step.key}>
              <div className="item-row">
                <strong>{index + 1}. {step.label}</strong>
                <StatusPill status={step.done ? "running" : index === nextStepIndex ? "pending" : "draft"} />
              </div>
              <div className="muted">
                {step.key === "choose_agent"
                  ? instance.templateName
                  : step.key === "create_instance"
                    ? `${instance.nodeName} · ${instance.planName}`
                    : step.key === "configure_model"
                      ? setup?.model
                        ? `${setup.model.provider}/${setup.model.model}`
                        : "Set the provider and API key in Models"
                      : step.key === "enable_channel"
                        ? "Turn on Web Chat in Channels"
                      : step.key === "enable_skills"
                        ? "Install and enable the skills this template expects"
                      : step.key === "test_chat"
                            ? "Send one chat message to verify model and channel"
                            : "Open Terminal and Logs to confirm runtime health"}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ModelsTab({ api, instance }) {
  const [modelConfig, setModelConfig] = useState(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const payload = await api(`/api/instances/${instance.id}/model`);
    setModelConfig(payload.modelConfig);
    if (payload.modelConfig) {
      setProvider(payload.modelConfig.provider);
      setModel(payload.modelConfig.model);
    }
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}/model`, {
        method: "PUT",
        body: { provider, model, apiKey, clearApiKey }
      });
      setModelConfig(payload.modelConfig);
      setApiKey("");
      setClearApiKey(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Models" subtitle="Configure the default model and a user-provided API key" icon={<Cpu size={16} />}>
      <form className="stack" onSubmit={save}>
        {error ? <Pill tone="danger">{error}</Pill> : null}
        <div className="form-2">
          <label className="section">
            <span className="section-title">Provider</span>
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              {modelProviders.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="section">
            <span className="section-title">Model</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} />
          </label>
        </div>
        <label className="section">
          <span className="section-title">User API key</span>
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            type="password"
            placeholder={formatSecretPreview(modelConfig?.credentialPreview)}
          />
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={clearApiKey}
            onChange={(event) => setClearApiKey(event.target.checked)}
          />
          <span>Clear saved API key</span>
        </label>
        <div className="toolbar">
          <button className="primary" type="submit" disabled={saving}>
            <Check size={16} /> Save default model
          </button>
          <Pill tone={hasSavedSecret(modelConfig?.credentialPreview) ? "success" : "neutral"}>
            Secret: {formatSecretPreview(modelConfig?.credentialPreview)}
          </Pill>
        </div>
      </form>
    </Panel>
  );
}

function ChannelsTab({ api, instance }) {
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [queuedTaskId, setQueuedTaskId] = useState("");
  const [chatStatus, setChatStatus] = useState("");

  const load = useCallback(async () => {
    const [channelsPayload, chatPayload] = await Promise.all([
      api(`/api/instances/${instance.id}/channels`),
      api(`/api/instances/${instance.id}/chat`)
    ]);
    setChannels(channelsPayload.channels);
    setChatMessages(chatPayload.messages);
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function updateChannel(type, status) {
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}/channels/${type}`, {
        method: "PUT",
        body: { status, config: { adapterReady: type === "web_chat" } }
      });
      setChannels(payload.channels);
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError("");
    const outgoing = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString()
    };
    setChatMessages((items) => [...items, outgoing]);
    try {
      const payload = await api(`/api/instances/${instance.id}/chat`, {
        method: "POST",
        body: { message }
      });
      if (payload.message) {
        setChatMessages((items) => [...items, payload.message]);
      }
      setMessage("");

      if (payload.status === "queued") {
        setQueuedTaskId(payload.taskId || "");
        setChatStatus("Waiting for provider runtime reply...");
        for (let attempt = 0; attempt < 15; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          const chatPayload = await api(`/api/instances/${instance.id}/chat`);
          setChatMessages(chatPayload.messages);
          const hasAssistantReply = chatPayload.messages.some(
            (item) => item.role === "assistant" && new Date(item.createdAt).getTime() >= new Date(outgoing.createdAt).getTime()
          );
          if (hasAssistantReply) {
            setChatStatus("Provider runtime replied.");
            setQueuedTaskId("");
            break;
          }
        }
        setChatStatus((current) => current === "Provider runtime replied." ? current : "Still waiting for the provider node; refresh chat to check for the reply.");
      } else {
        setQueuedTaskId("");
        setChatStatus("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid-2">
      <Panel title="Channels" subtitle="Web Chat is implemented; external channels remain adapter placeholders" icon={<Plug size={16} />}>
        <div className="stack">
          {error ? <Pill tone="danger">{error}</Pill> : null}
          {channels.map((channel) => (
            <div className="item" key={channel.type}>
              <div className="item-row">
                <strong>{channelLabels[channel.type] || channel.type}</strong>
                <StatusPill status={channel.status} />
              </div>
              <div className="muted">
                {channel.type === "web_chat"
                  ? "Console chat is available for this workspace."
                  : "Phase 1 keeps the adapter shape here; real external channel access comes later."}
              </div>
              <div className="toolbar">
                <button type="button" onClick={() => updateChannel(channel.type, "active")} disabled={channel.type !== "web_chat" && channel.status === "waitlist"}>
                  <Check size={16} /> Enable
                </button>
                <button type="button" onClick={() => updateChannel(channel.type, "disabled")}>
                  <Square size={16} /> Disable
                </button>
                {channel.type !== "web_chat" ? <Pill tone="warning">Preview placeholder</Pill> : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Web Chat" subtitle={instance.nodeType === "provider" ? "Dispatches messages to the provider node runtime" : "Talk to the current agent workspace"} icon={<MessageSquare size={16} />}>
        <div className="chat-window">
          {chatStatus ? (
            <div className="provider-note">
              {chatStatus}{queuedTaskId ? ` Task: ${queuedTaskId}` : ""}
            </div>
          ) : null}
          <div className="chat-log">
            {chatMessages.length === 0 ? <Empty>No messages yet</Empty> : null}
            {chatMessages.map((item, index) => (
              <div className={`chat-bubble ${item.role}`} key={item.id || index}>
                <div className="log-meta">
                  <strong>{item.role}</strong>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
                <pre className="code-block">{item.content}</pre>
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={sendMessage}>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type a message" />
            <button className="primary" type="submit" disabled={sending || instance.status !== "running"}>
              <MessageSquare size={16} /> Send
            </button>
          </form>
        </div>
      </Panel>
    </div>
  );
}

function SkillsTab({ api, instance }) {
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const payload = await api(`/api/instances/${instance.id}/skills`);
    setSkills(payload.skills);
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function install(skill) {
    await api(`/api/instances/${instance.id}/skills/${skill.id}/install`, { method: "POST" });
    await load();
  }

  async function setStatus(skill, status) {
    await api(`/api/instances/${instance.id}/skills/${skill.id}`, { method: "PATCH", body: { status } });
    await load();
  }

  async function uninstall(skill) {
    await api(`/api/instances/${instance.id}/skills/${skill.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <Panel title="Skills" subtitle="Install, enable, disable, and review built-in skill permissions" icon={<Wrench size={16} />}>
      <div className="stack">
        {error ? <Pill tone="danger">{error}</Pill> : null}
        {skills.map((skill) => (
          <div className="item" key={skill.id}>
            <div className="item-row">
              <div>
                <strong>{skill.name}</strong>
                <span className="muted"> · v{skill.version}</span>
              </div>
              <StatusPill status={skill.status} />
            </div>
            <div className="muted">{skill.description}</div>
            <div className="chip-row">
              {skill.permissions.map((permission) => (
                <span className="chip" key={permission}>{permission}</span>
              ))}
            </div>
            <div className="toolbar">
              {!skill.installed ? (
                <button type="button" onClick={() => install(skill)}>
                  <Zap size={16} /> Install
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setStatus(skill, skill.status === "enabled" ? "disabled" : "enabled")}>
                    {skill.status === "enabled" ? <Square size={16} /> : <Check size={16} />}
                    {skill.status === "enabled" ? "Disable" : "Enable"}
                  </button>
                  <button type="button" onClick={() => uninstall(skill)}>
                    <Trash2 size={16} /> Uninstall
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TerminalTab({ token, instance }) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState("disconnected");
  const [reloadKey, setReloadKey] = useState(0);

  const connect = useCallback(() => {
    if (!hostRef.current || !token || !instance?.id) return;
    let cancelled = false;
    let cleanup = () => {};
    setStatus("loading terminal");
    import("./terminal-session.js")
      .then(({ mountTerminal }) => {
        if (cancelled) return;
        cleanup = mountTerminal({
          host: hostRef.current,
          token,
          instanceId: instance.id,
          onStatus: setStatus
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [instance?.id, token, reloadKey]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return (
    <Panel title="Terminal" subtitle="Browser terminal connected to the current workspace directory" icon={<TerminalSquare size={16} />}>
      <div className="terminal-shell">
        <div className="terminal-toolbar">
          <div className="toolbar">
            <strong>{instance.name}</strong>
            <span className="terminal-status">{instance.workspacePath}</span>
          </div>
          <div className="toolbar">
            <Pill tone={status === "connected" ? "success" : status === "error" ? "danger" : "warning"}>{status}</Pill>
            <IconButton title="Reconnect" onClick={() => setReloadKey((value) => value + 1)}>
              <RefreshCw size={16} />
            </IconButton>
          </div>
        </div>
        <div className="terminal-host" ref={hostRef} />
      </div>
    </Panel>
  );
}

function LogsTab({ api, instance }) {
  const [payload, setPayload] = useState({ logs: [], audits: [] });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const next = await api(`/api/instances/${instance.id}/logs`);
    setPayload(next);
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  return (
    <div className="grid-2">
      <Panel
        title="Agent Logs"
        subtitle="Agent, runtime, deployment, and health-check logs"
        icon={<FileText size={16} />}
        actions={<button type="button" onClick={load}><RefreshCw size={16} /> Refresh</button>}
      >
        <div className="log-list">
          {error ? <Pill tone="danger">{error}</Pill> : null}
          {payload.logs.length === 0 ? <Empty>No logs yet</Empty> : null}
          {payload.logs.map((log) => (
            <div className="log-item" key={log.id}>
              <div className="log-meta">
                <StatusPill status={log.level} />
                <span>{log.source}</span>
                <span>{formatTime(log.createdAt)}</span>
              </div>
              <div>{log.message}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Audit Logs" subtitle="Important user actions and terminal session summaries" icon={<Shield size={16} />}>
        <div className="log-list">
          {payload.audits.length === 0 ? <Empty>No audit entries yet</Empty> : null}
          {payload.audits.map((audit) => (
            <div className="log-item" key={audit.id}>
              <div className="log-meta">
                <strong>{audit.action}</strong>
                <span>{audit.actorEmail || "system"}</span>
                <span>{formatTime(audit.createdAt)}</span>
              </div>
              <pre className="code-block">{JSON.stringify(audit.metadata, null, 2)}</pre>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SettingsTab({ api, instance, onUpdate, onLifecycle }) {
  const [name, setName] = useState(instance.name);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState("");

  const loadUsage = useCallback(async () => {
    const payload = await api(`/api/instances/${instance.id}/usage`);
    setUsage(payload);
  }, [api, instance.id]);

  useEffect(() => {
    loadUsage().catch((err) => setError(err.message));
  }, [loadUsage]);

  async function saveName(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}`, {
        method: "PATCH",
        body: { name }
      });
      onUpdate(payload.instance);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid-2">
      <Panel title="Settings" subtitle="Rename, restart, stop, or destroy the instance" icon={<Settings size={16} />}>
        <form className="stack" onSubmit={saveName}>
          {error ? <Pill tone="danger">{error}</Pill> : null}
          <label className="section">
            <span className="section-title">Instance name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="toolbar">
            <button className="primary" type="submit">
              <Check size={16} /> Save
            </button>
            <button type="button" onClick={() => onLifecycle("restart")} disabled={instance.status === "destroyed"}>
              <ListRestart size={16} /> Restart
            </button>
            <button type="button" onClick={() => onLifecycle("stop")} disabled={instance.status !== "running"}>
              <Square size={16} /> Stop
            </button>
            <button type="button" className="danger" onClick={() => onLifecycle("destroy")} disabled={instance.status === "destroyed"}>
              <Trash2 size={16} /> Destroy
            </button>
          </div>
        </form>
      </Panel>
      <Panel
        title="Usage"
        subtitle="Runtime, tokens, and estimated cost"
        icon={<Database size={16} />}
        actions={<button type="button" onClick={loadUsage}><RefreshCw size={16} /> Refresh</button>}
      >
        <div className="stack">
          <div className="grid-3">
            <Metric label="Estimated" value={formatMoney(usage?.summary?.estimatedCents || instance.usage?.estimatedCents || 0)} />
            <Metric label="Runtime" value={formatHours(usage?.summary?.runtimeHours || instance.usage?.runtimeHours || 0)} />
            <Metric label="Tokens" value={Math.round(usage?.summary?.tokenCount || 0)} />
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Estimate</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {(usage?.records || []).map((record) => (
                  <tr key={record.id}>
                    <td>{record.type}</td>
                    <td>{Number(record.quantity).toFixed(record.type === "token" ? 0 : 4)} {record.unit}</td>
                    <td>{formatMoney(record.priceEstimateCents)}</td>
                    <td>{formatTime(record.createdAt)}</td>
                  </tr>
                ))}
                {(usage?.records || []).length === 0 ? (
                  <tr><td colSpan="4" className="muted">No usage records yet. Running instances show live estimates.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AdminPage({ api }) {
  const [overview, setOverview] = useState(null);
  const [instances, setInstances] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    framework: "custom",
    description: "",
    status: "draft",
    basePriceCents: 20
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const [overviewPayload, instancesPayload, templatesPayload] = await Promise.all([
        api("/api/admin/overview"),
        api("/api/admin/instances"),
        api("/api/templates?includeAll=1")
      ]);
      const providersPayload = await api("/api/admin/providers");
      setOverview(overviewPayload);
      setInstances(instancesPayload.instances);
      setTemplates(templatesPayload.templates);
      setProviders(providersPayload.providers);
    } catch (err) {
      setError(err.message);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTemplate(event) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/admin/templates", { method: "POST", body: draft });
      setDraft({ name: "", framework: "custom", description: "", status: "draft", basePriceCents: 20 });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateTemplate(template, status) {
    await api(`/api/admin/templates/${template.id}`, {
      method: "PATCH",
      body: { status }
    });
    await load();
  }

  async function updateProvider(provider, status) {
    await api(`/api/admin/providers/${provider.id}`, {
      method: "PATCH",
      body: { status }
    });
    await load();
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Admin"
        title="Admin console"
        subtitle="Review nodes, templates, providers, instances, usage, and recent errors."
        actions={<button type="button" onClick={load}><RefreshCw size={16} /> Refresh</button>}
      />

      <Panel title="Platform summary" subtitle="Counts for users, instances, and templates" icon={<Shield size={16} />}>
        {error ? <Pill tone="danger">{error}</Pill> : null}
        <div className="grid-3">
          <Metric label="Users" value={overview?.counts?.users ?? "—"} icon={<Shield size={15} />} />
          <Metric label="Instances" value={overview?.counts?.instances ?? "—"} note={`${overview?.counts?.runningInstances ?? 0} running`} icon={<Boxes size={15} />} tone="success" />
          <Metric label="Templates" value={overview?.counts?.templates ?? "—"} icon={<Bot size={15} />} />
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Nodes" subtitle="Official and provider node resources, heartbeat, and review status" icon={<Server size={16} />}>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Type</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Resources</th>
                  <th>Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.nodes || []).map((node) => (
                  <tr key={node.id}>
                    <td>{node.name}</td>
                    <td>{node.type}</td>
                    <td>{node.region}</td>
                    <td><StatusPill status={node.status} /></td>
                    <td>{node.provider_display_name ? `${node.provider_display_name} / ${node.provider_status}` : "official"}</td>
                    <td>{node.available_cpu}/{node.total_cpu} CPU · {node.available_memory_mb}/{node.total_memory_mb} MB</td>
                    <td>{formatTime(node.last_heartbeat_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent errors" subtitle="Latest instance errors" icon={<FileText size={16} />}>
          <div className="log-list">
            {(overview?.recentErrors || []).length === 0 ? <Empty>No recent errors</Empty> : null}
            {(overview?.recentErrors || []).map((log) => (
              <div className="log-item" key={log.id}>
                <div className="log-meta">
                  <strong>{log.instanceName || log.instanceId}</strong>
                  <span>{log.source}</span>
                  <span>{formatTime(log.createdAt)}</span>
                </div>
                <div>{log.message}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Provider review" subtitle="Approve or reject provider profiles and node handoff" icon={<ServerCog size={16} />}>
        <div className="stack">
          {providers.length === 0 ? <Empty>No provider applications yet</Empty> : null}
          {providers.map((provider) => (
            <div className="item" key={provider.id}>
              <div className="item-row">
                <div>
                  <strong>{provider.displayName}</strong>
                  <div className="muted">{provider.userEmail} · {provider.contact}</div>
                </div>
                <StatusPill status={provider.status} />
              </div>
              <div className="chip-row">
                <span className="chip">{provider.nodeCount} nodes</span>
                <span className="chip">{provider.healthyNodeCount} healthy</span>
                <span className="chip">{formatMoney(provider.providerCents || 0)}</span>
              </div>
              <div className="muted">{provider.payoutNote || "No payout note provided"}</div>
              <div className="toolbar">
                <button type="button" onClick={() => updateProvider(provider, "approved")}>
                  <Check size={16} /> Approve
                </button>
                <button type="button" onClick={() => updateProvider(provider, "rejected")}>
                  <Square size={16} /> Reject
                </button>
                <button type="button" onClick={() => updateProvider(provider, "suspended")}>
                  <Trash2 size={16} /> Suspend
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Template management" subtitle="Create, publish, and archive official templates" icon={<Bot size={16} />}>
          <form className="stack" onSubmit={createTemplate}>
            <div className="form-2">
              <input placeholder="Template name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <select value={draft.framework} onChange={(event) => setDraft({ ...draft, framework: event.target.value })}>
                <option value="hermes">Hermes</option>
                <option value="openclaw">OpenClaw</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <textarea placeholder="Template description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            <div className="form-2">
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
              <input
                type="number"
                value={draft.basePriceCents}
                onChange={(event) => setDraft({ ...draft, basePriceCents: Number(event.target.value) })}
              />
            </div>
            <button className="primary" type="submit">
              <Zap size={16} /> Create template
            </button>
          </form>
          <div className="template-list admin-template-list">
            {templates.map((template) => (
              <div className="item" key={template.id}>
                <div className="item-row">
                  <strong>{template.name}</strong>
                  <StatusPill status={template.status} />
                </div>
                <div className="muted">{template.framework} · From {formatMoney(template.basePriceCents)}/h</div>
                <div className="toolbar">
                  <button type="button" onClick={() => updateTemplate(template, "active")}>Publish</button>
                  <button type="button" onClick={() => updateTemplate(template, "draft")}>Draft</button>
                  <button type="button" onClick={() => updateTemplate(template, "archived")}>Archive</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Instance management" subtitle="Review all platform instances" icon={<Boxes size={16} />}>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Instance</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Node</th>
                  <th>Estimate</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((instance) => (
                  <tr key={instance.id}>
                    <td>
                      <button type="button" className="ghost" onClick={() => setRoute(`instance/${instance.id}`)}>
                        {instance.name}
                      </button>
                    </td>
                    <td>{instance.userId}</td>
                    <td><StatusPill status={instance.status} /></td>
                    <td>{instance.nodeName}</td>
                    <td>{formatMoney(instance.usage?.estimatedCents || 0)}</td>
                  </tr>
                ))}
                {instances.length === 0 ? <tr><td colSpan="5" className="muted">No instances yet</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function App() {
  const route = useRoute();
  const [token, setTokenState] = useState(getToken);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setTokenState("");
    setUser(null);
    setRoute("auth");
  }, []);

  const api = useApi(token, logout);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    apiRequest("/api/me", { token })
      .then((payload) => setUser(payload.user))
      .catch(() => logout())
      .finally(() => setBooting(false));
  }, [token, logout]);

  function handleAuth(nextToken, nextUser) {
    setToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
  }

  if (booting) return <div className="auth-wrap"><Empty>Starting OpenAsstAI</Empty></div>;
  if (!token || !user || route.page === "auth") return <AuthPage onAuth={handleAuth} />;

  let page = null;
  if (route.page === "instances") page = <InstancesPage api={api} />;
  else if (route.page === "instance" && route.id) page = <InstanceConsole api={api} token={token} id={route.id} />;
  else if (route.page === "provider") page = <ProviderPage api={api} />;
  else if (route.page === "admin") page = user.role === "admin" ? <AdminPage api={api} /> : <Empty>Admin access required</Empty>;
  else page = <MarketPage api={api} />;

  return (
    <Shell user={user} onLogout={logout} route={route}>
      {page}
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(<App />);
