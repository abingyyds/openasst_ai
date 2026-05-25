# OpenAsstAI OpenNebula Adaptation Plan

Research date: 2026-05-26 Asia/Shanghai

Scope: documentation/design only. This plan was written after inspecting the current upstream `OpenNebula/one` checkout and the existing `CODEX_RAILWAY_OPENNEBULA_REPORT.md`. No OpenNebula installation or product-code changes are required for this task.

## Executive summary

OpenAsstAI should use OpenNebula as a provider-side infrastructure substrate, not as the public product itself.

The practical architecture is a marketplace/control plane:

- Providers connect one or more external OpenNebula zones/controllers, each managing real KVM/LXC hosts, datastores, templates, networks, and capacity outside Railway.
- OpenAsstAI maps synced provider inventory into sellable products/listings with its own pricing, access policy, quotas, billing state, and agent-session policy.
- Users buy or rent listings through OpenAsstAI. The platform then provisions a VM, attaches to an existing machine, or starts an approved agent/session path through provider adapters.
- Railway hosts only the OpenAsstAI web/API/proxy layer and optional background workers. Railway must not be treated as a hypervisor, VM datastore, OpenNebula front-end host, or provider capacity location.
- The P0 app should be a custom Node/Next/Express service, not a wrapped FireEdge instance. FireEdge is useful as reference/admin UI, but OpenAsstAI needs marketplace auth, billing, grants, provider isolation, BYOK policy, agent-session controls, and future non-OpenNebula connectors that FireEdge does not model cleanly.

This repo is currently the upstream OpenNebula monorepo. It is not the best long-term home for a Railway marketplace app unless the app is isolated under a separate path such as `/openasstai-platform`. A cleaner production approach is a separate OpenAsstAI app repo with OpenNebula kept as a vendor/base repo or pinned submodule/reference.

## Target architecture

### High-level topology

```text
User browser
  -> Railway HTTPS domain
  -> OpenAsstAI Web/API app
       - marketplace auth and RBAC
       - listings, orders, grants, sessions
       - API proxy and adapter facade
       - billing/webhook handlers
       - provider onboarding UI/API
       - background sync/provision workers
       - Postgres + Redis/queue
  -> secured outbound connection
       - TLS reverse proxy, private tunnel, WireGuard/Tailscale, or IP allowlist
  -> Provider infrastructure outside Railway
       - OpenNebula front-end/controller(s)
       - oned XML-RPC API on 2633/RPC2, preferably behind HTTPS
       - optional OneFlow, OneGate, Form, FireEdge, guacd local to provider
       - KVM/LXC hosts, storage, networks, images, templates
```

OpenAsstAI owns the commercial and user-facing control plane. Providers own or operate the actual compute plane. OpenNebula remains responsible for VM lifecycle, scheduling, host monitoring, images, virtual networks, and hypervisor integration inside each provider environment.

### Core components

| Component | Runs on Railway | Runs on provider infrastructure | Responsibility |
| --- | --- | --- | --- |
| OpenAsstAI web UI | Yes | No | Browse listings, provider onboarding, order/session management. |
| OpenAsstAI API | Yes | No | Marketplace API, auth, billing gates, provider adapter facade. |
| Adapter worker | Yes, or a small worker service | Optional remote agent later | Inventory sync, provisioning, status reconciliation, revocation. |
| Postgres | Railway service or managed DB | No | OpenAsstAI marketplace records and normalized inventory cache. |
| Redis/queue | Railway service or managed queue | No | Async sync/provision jobs, idempotency, retries. |
| OpenNebula front-end | No | Yes | `oned`, scheduler, XML-RPC/gRPC, user/group/VM/template APIs. |
| KVM/LXC hosts | No | Yes | Actual workloads. |
| Datastores/networks | No | Yes | VM disks/images, virtual networks, provider-side routing. |
| Console/tunnel endpoint | Proxy on Railway, target outside | Yes | Controlled SSH/VNC/web-agent tunnel after grant checks. |

### OpenNebula surfaces found in this checkout

The local repo confirms the separation:

- `README.md` describes the OpenNebula front-end as the central installation point and hosts/nodes as separate VM runtime machines.
- `share/etc/oned.conf` defines `oned` XML-RPC on port `2633`, gRPC on `2634`, and KVM/QEMU/LXC VM managers plus datastore/transfer drivers.
- `src/rm/xml-rpc/*` and `src/rm/grpc/proto/*` expose host, template, VM, datastore, network, user, zone, and marketplace APIs.
- `src/fireedge/etc/fireedge-server.conf` shows FireEdge can point at a remote `one_xmlrpc` endpoint, but it is still an OpenNebula UI/config model, not an OpenAsstAI marketplace layer.
- `src/oca` contains official OpenNebula client bindings/reference code that can guide adapter implementation.

## Why Railway runs only platform app

Railway is a container application platform. It is a good fit for a web service, API, background workers, managed environment variables, public HTTPS, deploy previews, logs, and app-level persistence. It is not a good fit for OpenNebula's infrastructure runtime.

Full OpenNebula and VM workloads require provider-side infrastructure capabilities:

- Linux hosts with stable machine identity.
- OpenNebula daemons and system services.
- KVM/QEMU/libvirt or LXC support.
- Kernel modules and often `/dev/kvm`.
- Linux bridges, Open vSwitch, VLAN/VXLAN, routing, firewalling, and storage networks.
- Persistent datastores for VM images/disks.
- Passwordless `oneadmin` SSH between OpenNebula front-end and nodes.
- Console/VNC/SSH reachability to VM networks.

The correct boundary is:

- Railway: OpenAsstAI product layer, API proxy, auth, billing, adapter orchestration, metadata, and session policy.
- External providers: OpenNebula controllers, hypervisor hosts, storage, networks, images, and actual machines.

This avoids pretending Railway can host hypervisors and lets OpenAsstAI aggregate many real providers.

## Provider/server onboarding model

### Provider types

OpenAsstAI should support provider connectors in layers:

1. `opennebula`: provider registers one or more OpenNebula zones/controllers.
2. `opennebula-federation`: provider exposes multiple zones behind an OpenNebula federation model or separate endpoints.
3. `ssh-node`: future connector for pre-existing servers controlled through SSH without OpenNebula.
4. `proxmox`: future connector for Proxmox clusters.
5. `baremetal`: future connector for reserved physical machines, PXE/reimage workflows, BMC/IPMI/Redfish, or manual approval.
6. `manual/external`: future connector for providers that only advertise inventory and fulfill through human/API webhook flow.

The OpenNebula connector is P0/P1 because this repo already provides the most complete infrastructure substrate.

### Onboarding flow

1. Provider creates an OpenAsstAI provider account.
2. Provider registers an external OpenNebula endpoint:
   - endpoint URL, ideally `https://one.provider.example/RPC2`;
   - display name;
   - region/country/city;
   - network reachability mode: public TLS, IP allowlist, tunnel, or future provider agent;
   - optional zone labels and compliance tags.
3. Provider supplies service-account credentials:
   - preferred: limited OpenNebula service account per provider zone;
   - avoid broad `oneadmin` credentials in production;
   - store encrypted credentials in OpenAsstAI secrets storage, never in browser/session payloads.
4. OpenAsstAI validates the endpoint:
   - checks TLS certificate and URL allowlist rules;
   - calls a read-only OpenNebula method such as system/version or pool info;
   - verifies account permissions for required methods;
   - records controller version, zone ID/name, and feature capabilities.
5. Inventory sync imports normalized provider resources:
   - hosts and host status;
   - clusters and zones;
   - VM templates and images;
   - datastores and available capacity;
   - virtual networks/security groups;
   - running VMs that OpenAsstAI owns or may attach to;
   - monitoring metrics needed for availability and sellable capacity.
6. Provider chooses which inventory can be sold:
   - template/image combinations;
   - CPU/memory/disk bounds;
   - allowed networks;
   - region and availability zone;
   - concurrency/access mode;
   - whether OpenAsstAI may create new VMs, attach to existing machines, or both.
7. Provider creates products/listings:
   - name, region, specs, images, GPU/accelerator tags if any;
   - price model: hourly, daily, monthly, prepaid credits, reservation, per-session;
   - setup fee, minimum duration, max duration;
   - agent templates: Hermes, OpenClaw, Codex, OpenPro, custom;
   - access modes: SSH, VNC, web terminal, browser agent, API-only;
   - BYOK policy: required, allowed, blocked, provider-managed;
   - limits: max sessions, max VMs, max concurrent users, egress policy.
8. Health checks and sync run continuously:
   - endpoint reachability;
   - credential validity;
   - inventory drift;
   - host capacity and overcommit limits;
   - failed provisioning detection;
   - stale grant/session revocation;
   - listing auto-pause when provider capacity drops below threshold.

### Provider service account policy

For P0/P1, the fastest path may require an OpenNebula account with enough privileges to inspect inventory and instantiate templates. Production should narrow privileges:

- read host/template/datastore/network pools;
- instantiate only approved VM templates;
- manage only VMs tagged/owned by OpenAsstAI;
- create/update users/tokens only inside an OpenAsstAI group or quota boundary;
- deny unrestricted host/datastore/network mutation unless explicitly needed.

OpenAsstAI should tag all created OpenNebula resources with metadata:

```text
OPENASSTAI_PROVIDER_ID
OPENASSTAI_LISTING_ID
OPENASSTAI_ORDER_ID
OPENASSTAI_USER_ID
OPENASSTAI_SESSION_ID
OPENASSTAI_MANAGED=true
```

These tags make reconciliation and revocation possible if OpenAsstAI is restarted or a job fails midway.

## User purchase/use model

### Tencent Cloud-style Hermes Agent control panel

The user-facing console should follow a lightweight cloud console pattern rather than a generic SaaS dashboard. Each rented/bought server or OpenNebula VM is an instance resource, and each instance can expose a first-class `Hermes Agent` panel where the user configures their own agent.

Reference UX requirements:

- Top console search supports instance ID, public/private IP, instance name, agent name, provider, region, and resource type. Pressing `/` should focus the global search box.
- Left navigation should feel like a lightweight-cloud console: Hermes Agent, Lightweight app servers, Servers, OrcaTerm, Automation assistant, Images, Cloud disks, SSH keys, Firewall templates, Traffic packages, Private networking, Migration to cloud, Domains, Databases, Object storage.
- Instance detail pages should center on a named instance, for example `阿炳开的`, show public IPv4 such as `43.128.106.54`, status such as `运行中`, quick actions, and an `AI助手 / Hermes Agent` section.
- The `Hermes Agent` card should show agent version/date, health/status, and quick actions: restart agent, open OrcaTerm, view logs, switch model, add channel, install skill, update agent.
- Models section warns that at least one model must be configured for Hermes to work. It supports Tencent Cloud Hy Token Plan / Hy3 preview, SubRouter/OpenRouter, OpenAI, Anthropic, Gemini, Ollama/self-hosted, and custom OpenAI-compatible base URLs. Users can switch default provider/model such as `custom_subrouter`.
- Channels section lets the user connect messaging channels so they can talk to their own Hermes in chat apps. P0/P1 examples: WeChat connected, QQ connected; Telegram/Discord/Feishu later.
- Skills section shows SkillHub search/install, warns about unknown skills, and lists installed skills such as `teacher-ai-preparing-lesson` and `teacher-assistant`.

Product implication: OpenNebula supplies server/VM capacity. OpenAsstAI supplies the per-user agent configuration plane on top. A user is not only buying a VM; they are managing a cloud instance plus its Hermes Agent runtime.


### Browse and buy

1. User browses listings filtered by region, price, duration, CPU, memory, storage, GPU, image, agent template, and access mode.
2. OpenAsstAI shows only listings with healthy provider endpoint status and sufficient synced capacity.
3. User selects:
   - duration or reservation window;
   - image/template;
   - access mode;
   - agent template if applicable;
   - optional BYOK secret reference;
   - optional SSH public key.
4. Checkout authorizes payment or reserves credits.
5. OpenAsstAI creates an order and grant in `pending_provision` state.

### Provisioning paths

Path A: provision new VM through OpenNebula.

1. Adapter selects provider zone and source template.
2. Adapter builds a sanitized VM template/context:
   - CPU/memory/disk/network parameters within listing limits;
   - SSH public key or short-lived bootstrap key;
   - cloud-init/context package;
   - OpenAsstAI resource tags;
   - agent bootstrap settings when allowed;
   - no raw user-controlled template fragments without validation.
3. Adapter calls OpenNebula VM instantiate/allocate.
4. Adapter waits for VM state and IP/console readiness.
5. OpenAsstAI creates a session and returns allowed access methods.

Path B: attach to an existing provider machine.

1. Provider pre-registers or syncs a machine/VM as attachable.
2. OpenAsstAI grants temporary user/session access.
3. Adapter creates or rotates credentials/tokens where supported.
4. Access expires or is revoked at the end of the order/session.

Path C: agent-only session.

1. OpenAsstAI provisions or selects a machine.
2. Adapter injects an agent bootstrap context or calls a provider-side session agent.
3. OpenAsstAI starts the approved Hermes/OpenClaw/Codex/OpenPro profile.
4. User interacts through a web chat/console/session surface without receiving broad machine credentials unless the listing permits it.

### Active use

OpenAsstAI should mediate every user operation:

- get session status;
- open SSH/VNC/web terminal/agent session;
- power cycle/reboot if listing allows;
- extend rental duration;
- rebuild from allowed image;
- upload SSH key if policy allows;
- revoke BYOK secret grants;
- stop/delete/release.

The browser must never call OpenNebula directly with provider credentials. It calls OpenAsstAI, and OpenAsstAI enforces marketplace permissions before calling adapters.

### Stop, revoke, rebuild, extend

End-of-life rules must be explicit per listing:

- `stop`: powers off VM but keeps disk until paid/reserved period ends.
- `revoke`: removes user/session access immediately but may leave VM running for cleanup.
- `delete`: destroys VM and ephemeral disks.
- `rebuild`: destroys and recreates from an allowed image/template.
- `extend`: creates a billing authorization and updates expiration.
- `snapshot`: disabled by default unless provider/listing explicitly allows it because snapshots can leak data or consume provider storage.

Cleanup should be idempotent and retryable. Billing should not mark a session complete until revocation/delete reaches a terminal state or a manual exception is recorded.

## OpenNebula adapter design

### Adapter boundary

OpenAsstAI should define a provider-neutral adapter interface, then implement `OpenNebulaAdapter` first.

```ts
export interface ProviderAdapter {
  validateConnection(input: ValidateConnectionInput): Promise<ConnectionCheck>;
  getCapabilities(ctx: ProviderContext): Promise<ProviderCapabilities>;
  syncInventory(ctx: ProviderContext): Promise<InventorySnapshot>;
  estimateCapacity(ctx: ProviderContext, request: CapacityRequest): Promise<CapacityEstimate>;
  provision(ctx: ProviderContext, request: ProvisionRequest): Promise<ProvisionResult>;
  attach(ctx: ProviderContext, request: AttachRequest): Promise<AttachResult>;
  powerAction(ctx: ProviderContext, target: MachineRef, action: PowerAction): Promise<ActionResult>;
  getAccess(ctx: ProviderContext, request: AccessRequest): Promise<AccessDescriptor>;
  getMetrics(ctx: ProviderContext, target: MachineRef): Promise<MachineMetrics>;
  revoke(ctx: ProviderContext, grant: GrantRef): Promise<RevokeResult>;
  deleteMachine(ctx: ProviderContext, target: MachineRef): Promise<DeleteResult>;
}
```

### OpenNebulaAdapter P0/P1 methods

Recommended concrete methods:

```ts
class OpenNebulaAdapter implements ProviderAdapter {
  validateConnection(): Promise<ConnectionCheck>;
  getVersion(): Promise<OpenNebulaVersion>;
  listZones(): Promise<OpenNebulaZone[]>;
  listHosts(): Promise<OpenNebulaHost[]>;
  listClusters(): Promise<OpenNebulaCluster[]>;
  listTemplates(): Promise<OpenNebulaTemplate[]>;
  listImages(): Promise<OpenNebulaImage[]>;
  listDatastores(): Promise<OpenNebulaDatastore[]>;
  listNetworks(): Promise<OpenNebulaNetwork[]>;
  listVMs(filter: VmFilter): Promise<OpenNebulaVM[]>;
  getVM(vmId: string): Promise<OpenNebulaVM>;
  createVM(request: CreateVmRequest): Promise<CreateVmResult>;
  instantiateTemplate(request: InstantiateTemplateRequest): Promise<CreateVmResult>;
  powerAction(vmId: string, action: "reboot" | "poweroff" | "resume" | "terminate"): Promise<ActionResult>;
  getConsoleUrl(vmId: string, mode: "vnc" | "ssh" | "web-agent"): Promise<AccessDescriptor>;
  createUserOrToken(request: UserGrantRequest): Promise<UserGrantResult>;
  revokeUserOrToken(grant: GrantRef): Promise<RevokeResult>;
  deleteVM(vmId: string): Promise<DeleteResult>;
  syncMetrics(since?: Date): Promise<MetricsSnapshot>;
}
```

OpenNebula API calls likely needed:

- host pool/info/monitoring;
- template pool/info and template instantiate;
- VM pool/info/action/monitoring;
- datastore pool/info;
- image pool/info;
- virtual network pool/info;
- user allocate/login/password/quota/change group if per-user OpenNebula users are created;
- ACL/group/quota APIs for stronger isolation;
- zone pool/info for multi-zone awareness.

The repo has XML-RPC and gRPC definitions for these surfaces under `src/rm/xml-rpc` and `src/rm/grpc/proto`. P0 should use XML-RPC because it is the most established OpenNebula endpoint and aligns with existing FireEdge/OCA configuration.

### XML-RPC security model

Secure-by-default rules:

- Do not expose raw provider XML-RPC credentials to users.
- Require HTTPS or a private tunnel between Railway and provider endpoints.
- Pin provider identity where possible: expected hostname, TLS validation, optional certificate fingerprint.
- Store credentials encrypted at rest and decrypt only inside server-side adapter execution.
- Add per-provider rate limits and circuit breakers.
- Log method name, provider, zone, OpenAsstAI resource ID, and result status, but never log auth strings, context secrets, private keys, BYOK values, or cloud-init sensitive data.
- Use idempotency keys on provision/revoke flows so retries do not create duplicate VMs.
- Tag every OpenNebula resource created by OpenAsstAI.

### Credential strategies

P0 acceptable:

- Provider supplies one service account per controller/zone.
- OpenAsstAI stores encrypted username/password/token.
- Adapter calls OpenNebula server-side.

P1/P2 stronger:

- Provider creates a dedicated OpenNebula group for OpenAsstAI-managed resources.
- OpenAsstAI provisions per-order or per-user OpenNebula users/tokens with quotas.
- OpenNebula ACLs limit which templates/networks/datastores can be used.
- Use short-lived session tokens where OpenNebula supports them.

P3/P4 production:

- Provider-side lightweight connector agent pulls signed work from OpenAsstAI, so providers do not need to expose XML-RPC publicly.
- Hardware/BYOK/agent secrets use a secret broker with short-lived grants.
- Credential rotation and breach revocation are first-class onboarding operations.

### Future adapter shapes

`ProxmoxAdapter`:

- validate API token and cluster version;
- sync nodes, pools, storages, templates, networks;
- clone/create VM or LXC;
- power action, console proxy, metrics, delete;
- map Proxmox RBAC/resource pools to OpenAsstAI grants.

`SSHServerAdapter`:

- validate SSH reachability and fingerprint;
- sync machine facts through a restricted probe;
- create/revoke temporary Unix users or SSH certificates;
- run approved agent bootstrap scripts;
- collect lightweight metrics;
- avoid arbitrary shell exposure to OpenAsstAI users unless explicitly listed.

`BareMetalAdapter`:

- sync physical nodes, BMC status, installed images, reservation windows;
- power/reboot through Redfish/IPMI;
- reimage through provider automation;
- create network/console access grants;
- model slower provisioning and manual failure modes.

## Marketplace data model

Use OpenAsstAI-owned entities and treat OpenNebula objects as external resources mapped into them.

### Core tables

`providers`

- `id`
- `owner_user_id` or `organization_id`
- `name`
- `status`: `draft`, `validating`, `active`, `suspended`, `disabled`
- `support_email`
- `terms_url`
- `created_at`, `updated_at`

`provider_endpoints`

- `id`
- `provider_id`
- `type`: `opennebula`, `proxmox`, `ssh-node`, `baremetal`
- `name`
- `region`
- `endpoint_url`
- `reachability_mode`: `public_tls`, `ip_allowlist`, `tunnel`, `provider_agent`
- `credential_secret_ref`
- `tls_fingerprint`
- `status`
- `last_checked_at`
- `capabilities_json`

`provider_zones`

- `id`
- `provider_endpoint_id`
- `external_zone_id`
- `name`
- `endpoint_url`
- `region`
- `status`
- `last_synced_at`

`inventory_resources`

- `id`
- `provider_id`
- `provider_endpoint_id`
- `provider_zone_id`
- `external_id`
- `resource_type`: `host`, `template`, `image`, `datastore`, `network`, `vm`
- `name`
- `status`
- `region`
- `spec_json`
- `capacity_json`
- `labels_json`
- `last_seen_at`
- unique key on provider endpoint, resource type, external ID

`products`

- `id`
- `provider_id`
- `name`
- `description`
- `status`
- `product_type`: `vm`, `agent-session`, `existing-machine`, `baremetal`
- `default_region`
- `policy_json`

`listings`

- `id`
- `product_id`
- `provider_id`
- `provider_endpoint_id`
- `provider_zone_id`
- `status`: `draft`, `active`, `paused`, `sold_out`, `disabled`
- `name`
- `region`
- `currency`
- `price_model`: `hourly`, `daily`, `monthly`, `fixed`, `credits`
- `price_amount`
- `min_duration_minutes`
- `max_duration_minutes`
- `spec_json`: CPU, memory, disk, GPU, image/template refs
- `access_modes_json`: SSH, VNC, web terminal, web agent
- `agent_templates_json`: Hermes/OpenClaw/Codex/OpenPro/custom
- `quota_json`
- `capacity_policy_json`

`orders`

- `id`
- `user_id`
- `listing_id`
- `provider_id`
- `status`: `created`, `payment_pending`, `paid`, `provisioning`, `active`, `ending`, `ended`, `failed`, `refunded`
- `starts_at`
- `ends_at`
- `billing_ref`
- `idempotency_key`
- `created_at`, `updated_at`

`grants`

- `id`
- `order_id`
- `user_id`
- `provider_id`
- `provider_endpoint_id`
- `provider_zone_id`
- `external_resource_id`
- `grant_type`: `vm-owner`, `ssh`, `vnc`, `agent-session`, `api-token`
- `status`: `pending`, `active`, `revoking`, `revoked`, `expired`, `failed`
- `expires_at`
- `secret_ref`
- `policy_json`

`sessions`

- `id`
- `order_id`
- `grant_id`
- `user_id`
- `status`: `starting`, `active`, `idle`, `stopping`, `stopped`, `failed`
- `session_type`: `ssh`, `vnc`, `web-agent`, `agent-chat`
- `agent_template`
- `byok_policy`
- `metadata_json`
- `started_at`, `ended_at`

`provisioning_jobs`

- `id`
- `order_id`
- `provider_endpoint_id`
- `job_type`: `sync`, `provision`, `attach`, `revoke`, `delete`, `rebuild`
- `status`
- `attempts`
- `idempotency_key`
- `input_json`
- `result_json`
- `last_error`
- `created_at`, `updated_at`

`audit_events`

- `id`
- `actor_user_id`
- `provider_id`
- `order_id`
- `session_id`
- `event_type`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

### Agent-console tables

`agent_instances`

- `id`, `user_id`, `order_id`, `grant_id`, `external_resource_id` or `inventory_resource_id`
- `instance_name`, `agent_type`, `agent_version`
- `status`: `installing`, `running`, `stopped`, `degraded`, `failed`, `updating`
- `public_ipv4`, `private_ip`
- `bootstrap_method`: `opennebula_context`, `cloud_init`, `ssh_connector`, `provider_agent`
- `last_heartbeat_at`, `metadata_json`

`agent_model_configs`

- `id`, `agent_instance_id`
- `provider`: `subrouter`, `openrouter`, `tencent_hunyuan`, `openai`, `anthropic`, `gemini`, `ollama`, `custom_openai_compatible`
- `plan_name`, `model_name`, `base_url`, `credential_secret_ref`
- `is_default`, `status`

`agent_channels`

- `id`, `agent_instance_id`
- `channel_type`: `wechat`, `qq`, `telegram`, `discord`, `feishu`, `wecom`, `web`
- `display_name`, `connection_status`, `credential_secret_ref`, `metadata_json`

`agent_skills`

- `id`, `agent_instance_id`, `skill_name`, `skill_version`
- `source`: `skillhub`, `git`, `local`, `uploaded`
- `status`: `installed`, `disabled`, `installing`, `failed`
- `permissions_json`

`agent_health_events`

- `id`, `agent_instance_id`, `level`, `event_type`, `message`, `metadata_json`, `created_at`

`resource_search_index`

- `id`, `owner_user_id`, `resource_type`, `resource_id`
- `search_text`, `aliases_json`, `last_indexed_at`

### Data ownership rule

OpenNebula is not the system of record for marketplace state. OpenNebula is the system of record for provider-side VM runtime state. OpenAsstAI stores commercial records, user entitlements, adapter mappings, and the normalized inventory cache.

## Required env vars and secrets

### Railway application

Required P0:

| Variable | Purpose |
| --- | --- |
| `PORT` | Railway-provided HTTP port. App must bind `0.0.0.0:$PORT`. |
| `APP_BASE_URL` | Public OpenAsstAI URL for callbacks and links. |
| `DATABASE_URL` | Postgres connection string. |
| `REDIS_URL` or `QUEUE_URL` | Async provisioning/sync queue. |
| `SESSION_SECRET` | Web session/JWT signing secret. |
| `ENCRYPTION_KEY` | Envelope encryption key for provider credentials and grant secrets. Prefer managed KMS later. |
| `OPENASSTAI_ENV` | `development`, `staging`, or `production`. |
| `LOG_LEVEL` | Structured log verbosity. |

Provider/OpenNebula credentials should not be static global Railway variables in production. They should be per-provider encrypted records. For a single-controller P0 sandbox only, these may be temporary env vars:

| Variable | Purpose |
| --- | --- |
| `OPENNEBULA_XMLRPC_URL` | Sandbox external OpenNebula XML-RPC endpoint. |
| `OPENNEBULA_USERNAME` | Sandbox service account. |
| `OPENNEBULA_PASSWORD` or `OPENNEBULA_TOKEN` | Sandbox credential. |
| `OPENNEBULA_ZONE_ID` | Optional default zone. |

### Optional integrations

| Variable | Purpose |
| --- | --- |
| `BILLING_PROVIDER` | Stripe, Paddle, credits-only, manual. |
| `STRIPE_SECRET_KEY` | Payment API secret if Stripe is used. |
| `STRIPE_WEBHOOK_SECRET` | Payment webhook validation. |
| `RAILWAY_STATIC_OUTBOUND_IP` or provider firewall config | If providers allowlist Railway egress. |
| `TUNNEL_CONTROL_SECRET` | Future tunnel/provider-agent authentication. |
| `BYOK_SECRET_PROVIDER` | Secret backend for user/provider BYOK material. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Observability backend. |
| `SENTRY_DSN` | Error tracking. |
| `DEFAULT_MODEL_PROVIDER` | Optional bootstrap default such as `custom_subrouter`. |
| `SUBROUTER_API_BASE_URL` | Optional OpenAI-compatible base URL for SubRouter/custom model routing. |
| `SKILLHUB_URL` | SkillHub endpoint/catalog source. |
| `WECHAT_CHANNEL_APP_ID` / `WECHAT_CHANNEL_SECRET` | WeChat channel integration credentials. |
| `QQ_CHANNEL_APP_ID` / `QQ_CHANNEL_SECRET` | QQ channel integration credentials. |
| `AGENT_BOOTSTRAP_SIGNING_KEY` | Signs bootstrap payloads injected through OpenNebula contextualization/cloud-init. |
| `ORCATERM_GATEWAY_URL` | Web terminal gateway endpoint if OrcaTerm is split into its own service. |

### Secret handling rules

- Provider credentials live in encrypted DB rows or a managed secret store, not in source code.
- BYOK values should be referenced by secret handle and made available only to the session/agent path that needs them.
- SSH private keys generated for bootstrap should be short-lived and revoked/deleted after provisioning.
- Console access tokens should be short-lived, single-purpose, and bound to user/order/session IDs.

## API surface P0/P1

Use a custom OpenAsstAI API. Exact framework can be Next.js API routes, Express/Fastify, or a separate worker process. The important boundary is that all provider calls go through server-side authorization and adapter code.

### P0 API

Provider/admin:

- `POST /api/providers` creates a provider record.
- `POST /api/providers/:id/endpoints` registers an OpenNebula endpoint.
- `POST /api/provider-endpoints/:id/validate` validates credentials and capability.
- `POST /api/provider-endpoints/:id/sync` starts inventory sync.
- `GET /api/provider-endpoints/:id/inventory` lists normalized synced resources.

Marketplace:

- `GET /api/listings` browse active listings.
- `GET /api/listings/:id` read listing details and availability.
- `POST /api/orders` create an order/reservation.
- `GET /api/orders/:id` read order/provision status.

Provisioning:

- `POST /api/orders/:id/provision` starts provisioning.
- `POST /api/orders/:id/revoke` stops access and queues cleanup.
- `GET /api/sessions/:id` returns session state.

Health/ops:

- `GET /healthz` process health.
- `GET /readyz` DB/queue readiness.
- `GET /api/admin/jobs/:id` job status for operators.

Agent console / instance operations:

- `GET /api/resources/search?q=` searches resources by instance ID, IP, name, provider, region, and resource type. The UI should bind `/` to focus the search input.
- `GET /api/instances` lists user instances/servers/agent machines.
- `GET /api/instances/:id` returns instance detail, IPs, provider, region, status, and allowed operations.
- `GET /api/instances/:id/agent` returns Hermes Agent status, version, models, channels, skills, and health.
- `PATCH /api/instances/:id/agent/models/default` switches the default model.
- `POST /api/instances/:id/agent/models` adds a model provider/plan/config.
- `POST /api/instances/:id/agent/channels` starts channel connection flow such as WeChat or QQ.
- `POST /api/instances/:id/agent/skills` installs a SkillHub skill.
- `POST /api/instances/:id/agent/actions/restart` restarts the agent runtime.
- `GET /api/instances/:id/agent/logs` streams or pages agent logs.
- `POST /api/instances/:id/orcaterm/session` opens a short-lived OrcaTerm/web terminal session if policy allows.

### P1 API

Provider/admin:

- `POST /api/provider-endpoints/:id/credentials/rotate`
- `GET /api/providers/:id/health`
- `POST /api/providers/:id/listings`
- `PATCH /api/listings/:id`
- `POST /api/listings/:id/publish`
- `POST /api/listings/:id/pause`
- `GET /api/provider-endpoints/:id/drift`

Marketplace and lifecycle:

- `POST /api/orders/:id/extend`
- `POST /api/orders/:id/rebuild`
- `POST /api/orders/:id/power`
- `GET /api/orders/:id/metrics`
- `POST /api/sessions/:id/access-token`
- `POST /api/sessions/:id/stop`

Agent/session:

- `POST /api/sessions/:id/agent/start`
- `POST /api/sessions/:id/agent/message`
- `GET /api/sessions/:id/events`
- `POST /api/sessions/:id/byok/grant`
- `DELETE /api/sessions/:id/byok/grant`

Billing:

- `POST /api/billing/checkout`
- `POST /api/billing/webhooks/:provider`
- `GET /api/billing/usage`

## Railway deployment layout options

### Option A: separate app repo

Recommended production option.

```text
openasstai-platform/
  apps/web/
  apps/api/
  packages/adapters/
  packages/db/
  packages/shared/
  deploy/railway/
```

Pros:

- Keeps upstream OpenNebula clean.
- Faster Railway builds.
- Clear ownership and product release cadence.
- Avoids accidental edits to infrastructure vendor code.

Cons:

- Need explicit references/submodules/docs for OpenNebula API contracts.

### Option B: keep upstream as vendor/base and add `/openasstai-platform`

Acceptable for near-term Codex work in this checkout if the user wants one repo.

```text
/
  src/                      # upstream OpenNebula
  share/                    # upstream OpenNebula
  openasstai-platform/
    apps/web/
    packages/adapters/
    packages/db/
    docs/
```

Pros:

- Lets Codex implement the Railway app without modifying upstream OpenNebula code.
- Local access to OpenNebula XML-RPC/gRPC definitions and OCA reference code.
- Easy to keep documentation next to the adaptation work.

Cons:

- Large monorepo may slow builds and confuse deployment detection.
- Must configure Railway root/build path carefully.
- Risk of mixing product code with vendor code over time.

### Option C: submodule/vendor strategy

```text
openasstai-platform/
  vendor/opennebula-one/    # git submodule or pinned source snapshot
  apps/api/
  packages/opennebula-adapter/
```

Pros:

- Clear product repo with pinned upstream API reference.
- Easier to update OpenNebula intentionally.

Cons:

- Submodule workflow overhead.
- Requires care in CI/deploy caching.

### FireEdge wrapping decision

Do not build OpenAsstAI by wrapping FireEdge for P0.

FireEdge is a Node UI for OpenNebula and can point at a remote `one_xmlrpc` endpoint, which makes it useful as an admin/debug interface or a temporary proof of API reachability. But it does not own:

- provider marketplace onboarding;
- product/listing/order/billing lifecycle;
- OpenAsstAI grants and quotas;
- multi-provider abstraction;
- non-OpenNebula connectors;
- BYOK/agent-session policy;
- user-safe API proxying.

A custom app can still borrow ideas from FireEdge and the OCA clients. FireEdge should remain separate from the public marketplace product unless there is a specific admin-only use case.

## Phased Codex implementation plan

### P0: Railway app skeleton, API proxy, docs

Goal: establish the OpenAsstAI platform boundary without touching OpenNebula runtime code.

Codex should implement next:

1. Create isolated `/openasstai-platform` scaffold or a separate repo, depending on the chosen layout.
2. Add a minimal Node/TypeScript API service that binds to `0.0.0.0:$PORT`.
3. Add Postgres schema/migrations for providers, endpoints, inventory resources, products, listings, orders, grants, sessions, jobs, audit events.
4. Add an `OpenNebulaAdapter` interface and a stub XML-RPC client wrapper.
5. Implement read-only endpoint validation and inventory sync against one sandbox OpenNebula endpoint.
6. Add `GET /healthz`, `GET /readyz`, provider endpoint registration, validation, sync, and inventory read APIs.
7. Add secure credential encryption/decryption boundaries.
8. Add docs for Railway env vars and provider endpoint security.

Do not implement billing, public checkout, console proxy, or broad VM lifecycle in P0 unless a real sandbox provider is available.

### P1: provider onboarding and inventory sync

Goal: make providers self-serve enough to register real OpenNebula capacity.

Codex should implement:

1. Provider onboarding UI/API.
2. Credential validation with permission checks.
3. Scheduled inventory sync jobs.
4. Normalized mapping for hosts, templates, images, datastores, networks, and zones.
5. Listing draft creation from synced templates/capacity.
6. Provider health dashboard and auto-pause logic.
7. Audit log for credential changes and sync results.

### P2: marketplace listing and order/provision lifecycle

Goal: let users reserve capacity and have OpenAsstAI create/revoke provider resources.

Codex should implement:

1. Public listing browse/detail API.
2. Order state machine.
3. Idempotent provisioning jobs.
4. OpenNebula template instantiation with sanitized context.
5. Grant creation and revocation.
6. VM lifecycle actions limited by listing policy.
7. Cleanup/reconciliation worker for stuck or orphaned resources.
8. Initial credits/manual billing integration or payment provider checkout.

### P3: agent session layer and console

Goal: deliver the actual OpenAsstAI user experience on top of rented machines.

Codex should implement:

1. Web session surface for SSH/web-terminal/VNC/agent modes.
2. Short-lived access token service.
3. Agent template registry for Hermes, OpenClaw, Codex, OpenPro, and provider-specific templates.
4. Agent bootstrap through OpenNebula context/cloud-init or provider-side connector.
5. BYOK secret grant/revoke flow.
6. Session event stream and usage metering.
7. Policy enforcement for file access, network access, model/API keys, and concurrent sessions.

### P4: billing, monitoring, and multi-provider hardening

Goal: move from controlled beta to production marketplace.

Codex should implement:

1. Full billing integration, invoices, metered usage, refunds, provider payouts.
2. Provider scoring, SLA tracking, incident states, and capacity forecasting.
3. Credential rotation and provider offboarding.
4. Provider-side connector agent to avoid exposing XML-RPC endpoints publicly.
5. Multi-region routing and failover.
6. Abuse detection, quota enforcement, and rate limits.
7. Strong OpenNebula ACL/group/quota templates.
8. Observability: metrics, traces, structured audit logs, alerting.
9. Compliance exports and data-retention controls.

## Risks and open decisions

### Key risks

- Provider XML-RPC exposure: public OpenNebula endpoints are high-value targets. Prefer TLS plus allowlist/tunnel now and provider-side connector later.
- Credential blast radius: a broad service account can mutate too much infrastructure. Narrow permissions and tag managed resources.
- Inventory drift: providers may edit templates/networks outside OpenAsstAI. Scheduled sync and drift detection are required.
- Provisioning idempotency: retries can create duplicate VMs without strong idempotency keys and external tags.
- Console/network access: VNC/SSH/web console paths are more sensitive than VM creation. Delay public console until a tunnel/token design is complete.
- Billing/provision race: do not provision expensive resources until payment/credit reservation is confirmed; do not end billing until access is revoked or exceptioned.
- BYOK leakage: user keys must not be logged, stored in VM templates permanently, or exposed to providers beyond declared policy.
- OpenNebula version variance: providers may run different versions and enable different drivers/features. Capability detection must gate listings and actions.
- Upstream monorepo churn: product code inside the upstream repo can become hard to maintain unless isolated.

### Open decisions

- Repo layout: separate app repo vs `/openasstai-platform` inside this checkout.
- API framework: Next.js full-stack, Express/Fastify API plus separate frontend, or another Node/TypeScript stack.
- DB provider on Railway: Railway Postgres vs external managed Postgres.
- Queue provider: Redis/BullMQ, Postgres jobs, or managed queue.
- Provider connectivity: public HTTPS XML-RPC with allowlist for beta vs tunnel/provider-agent from the start.
- User identity: OpenAsstAI-only users mapped to service-account actions vs per-user OpenNebula users/tokens.
- Billing start: manual credits first vs immediate Stripe/Paddle integration.
- Console approach: browser SSH/VNC proxy through OpenAsstAI vs provider-local console URLs vs agent-only access initially.
- Agent bootstrap trust model: cloud-init/context injection vs pre-baked images vs provider-side session daemon.
- Listing granularity: sell templates/spec bundles, whole machines, time slots, or agent sessions as the primary product.

## Immediate recommendation

For the next Codex implementation task, choose one of these:

1. Create `/openasstai-platform` as an isolated Node/TypeScript Railway app in this checkout, with schema, adapter interfaces, health endpoints, and OpenNebula read-only validation/sync stubs.
2. Create a separate `openasstai-platform` repo and keep this `OpenNebula/one` checkout as a vendor/reference repo.

The implementation should not modify upstream OpenNebula services, FireEdge, `oned`, or VM drivers. The first real code should establish the OpenAsstAI marketplace/control-plane boundary and prove safe read-only connectivity to one external OpenNebula endpoint.
