# Addendum for Codex: Tencent Cloud-like console and user-configured Hermes Agent panel

The user just clarified the desired product UI/UX direction. Incorporate this into `CODEX_OPENASSTAI_OPENNEBULA_ADAPTATION_PLAN.md` before finalizing.

Reference panel described by user:
- Cloud console top search: support searching resources by instance ID, IP, name, etc.; shortcut `/`.
- Left navigation like lightweight cloud product console:
  - Hermes Agent
  - Lightweight app servers
  - Servers
  - OrcaTerm
  - Automation assistant
  - Images
  - Cloud disks
  - SSH keys
  - Firewall templates
  - Traffic packages
  - Private networking
  - Migration to cloud
  - Lightweight domains / domains
  - Lightweight database / database
  - Lightweight storage / object storage
- Resource detail page example:
  - Instance name: 阿炳开的
  - Public IPv4: 43.128.106.54
  - AI assistant / more actions
  - Hermes Agent card
  - Version/date: 2026.4.30
  - Status: running
  - Models section: add at least one model for Hermes to work
  - Model plan: Tencent Cloud Hy Token Plan personal edition / Hy3 preview, for agent workloads, coding agent, document automation, multi-step tool calling
  - Switch model button
  - Default model/provider e.g. custom_subrouter
  - Channels section: configure channels so users can chat with Hermes in messaging apps
  - WeChat connected, QQ connected
  - Skills section: install skills, SkillHub search, installed skills list such as teacher-ai-preparing-lesson, teacher-assistant

Interpretation:
OpenAsstAI should let each end user configure their own agent in a cloud-console style control panel, not only let providers list raw servers. Provider servers/OpenNebula supply capacity. User-facing product must include an Agent Control Panel for the user's rented/owned instance.

Add these requirements to the adaptation plan:
1. Product should have a Tencent Cloud lightweight-server style console shell:
   - top global resource search with `/` keyboard shortcut;
   - left nav with server, storage, networking, security, agent, automation, migration, domains, databases;
   - resource detail pages centered on an instance/agent.
2. Each rented server/VM can expose a `Hermes Agent` tab/card where the user configures:
   - model providers/plans/models;
   - default model;
   - messaging channels: WeChat, QQ, Telegram, etc.;
   - skills from SkillHub/installable marketplace;
   - agent version/status/health;
   - quick actions: restart agent, open OrcaTerm, view logs, switch model, add channel, install skill.
3. Data model additions:
   - agent_instances tied to provisioned_resource / VM / server;
   - agent_model_configs;
   - agent_channels;
   - agent_skills;
   - agent_health_events;
   - resource_search_index.
4. API additions:
   - GET /api/resources/search?q=
   - GET /api/instances/:id/agent
   - PATCH /api/instances/:id/agent/models/default
   - POST /api/instances/:id/agent/channels
   - POST /api/instances/:id/agent/skills
   - POST /api/instances/:id/agent/actions/restart
   - GET /api/instances/:id/agent/logs
5. Provider adapter implications:
   - OpenNebula adapter provisions VM/server and injects/install Hermes Agent bootstrap via contextualization/cloud-init/SSH connector.
   - Agent connector reports back status, installed channels, models, skills, logs.
6. Implementation plan should include a P0/P1 UI target: create `/openasstai-platform` with this console shell and Hermes Agent detail page mock/API skeleton, before deep OpenNebula provisioning.

Do not claim full implementation is already done. This is design/planning guidance unless you are explicitly implementing a small scaffold.
