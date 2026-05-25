# Codex Mission: OpenAsstAI adaptation architecture on OpenNebula + Railway platform app

Working directory: /Users/minihanshi/project/openasstai

Context:
The repo has been replaced with upstream OpenNebula/one. The user clarified: OpenAsstAI will sell/coordinate access to many kinds of servers, so there must be real external servers/providers connected behind the platform. Railway should run only the platform application layer, not the actual VM/hypervisor workloads. We need a concrete adaptation plan: how to adapt OpenNebula/one into OpenAsstAI, how different provider servers connect, and what Codex should implement next.

Important product framing:
- OpenAsstAI is not just a raw VPS sales site and not a full OpenNebula rebrand.
- It is a marketplace/control plane where providers connect their own server capacity / OpenNebula zones / VPS nodes, and users rent controlled access to machines/agents.
- Railway should host the OpenAsstAI app/API/proxy layer only.
- OpenNebula controllers and KVM/LXC hosts run on external VPS/bare-metal/private cloud provider infrastructure.

Do NOT make broad product-code changes in this task. Prefer documentation/design artifacts only. If you create tiny scaffolding files, explain why and keep them isolated.

Tasks:
1. Inspect the current OpenNebula repo and existing report `CODEX_RAILWAY_OPENNEBULA_REPORT.md`.
2. Produce a practical adaptation design for OpenAsstAI:
   - providers can connect one or more OpenNebula zones/controllers;
   - providers can optionally connect non-OpenNebula servers through future connectors;
   - platform maps provider inventory into OpenAsstAI sellable products/listings;
   - users buy/rent listings and OpenAsstAI provisions VM/session/agent access through OpenNebula API;
   - OpenAsstAI API proxy enforces marketplace auth, billing, grants, quotas, and BYOK/agent session policy.
3. Define the minimum Railway app architecture:
   - whether to build custom Node/Next/Express app outside FireEdge or wrap FireEdge;
   - what APIs the Railway app should expose in P0/P1;
   - how it talks to OpenNebula XML-RPC securely;
   - env vars/secrets needed;
   - database/schema needed for marketplace entities.
4. Define provider onboarding flow:
   - provider registers external OpenNebula endpoint;
   - validates credentials/service account;
   - syncs hosts/templates/datastores/networks;
   - creates server products/listings;
   - defines price, region, specs, images, agent templates, concurrency/access mode;
   - health checks and status sync.
5. Define user purchase/use flow:
   - browse listings;
   - rent/buy;
   - provision VM or attach to existing machine;
   - create OpenNebula user/token/context or SSH/VNC/agent tunnel;
   - start Hermes/OpenClaw/Codex/OpenPro agent template if applicable;
   - use web console/chat/session;
   - stop/revoke/rebuild/extend.
6. Define adapter interfaces:
   - OpenNebulaAdapter methods, e.g. listHosts/listTemplates/createVM/powerAction/getConsoleUrl/deleteVM/syncMetrics;
   - future Proxmox/SSH/BareMetal adapter shapes;
   - security boundaries and credential handling.
7. Provide a phased implementation plan for Codex:
   - P0 Railway app skeleton/API proxy/docs;
   - P1 provider onboarding + inventory sync;
   - P2 marketplace listing + order/provision lifecycle;
   - P3 agent session layer and console;
   - P4 billing/monitoring/multi-provider hardening.
8. If you think the current OpenNebula monorepo is not the right place for the Railway app, say so clearly and propose repo layout options:
   - keep upstream as vendor/base and add `/openasstai-platform`;
   - separate app repo;
   - submodule/vendor strategy.

Output files:
- `/Users/minihanshi/project/openasstai/CODEX_OPENASSTAI_OPENNEBULA_ADAPTATION_PLAN.md`
- `/Users/minihanshi/project/openasstai/.codex-openasstai-adaptation-result.txt`

Required sections in main plan:
- Executive summary
- Target architecture
- Why Railway runs only platform app
- Provider/server onboarding model
- User purchase/use model
- OpenNebula adapter design
- Marketplace data model
- Required env vars and secrets
- API surface P0/P1
- Railway deployment layout options
- Phased Codex implementation plan
- Risks and open decisions

Verification:
- Do not install OpenNebula.
- Do not run destructive git commands.
- End by showing git status/diff stat.
