# Railway Feasibility Report for OpenAsstAI on OpenNebula/one

Research date: 2026-05-26 Asia/Shanghai

## Executive verdict

Direct deployment of the full upstream `OpenNebula/one` stack to Railway is not realistically feasible for a production OpenAsstAI rebuild.

OpenNebula is an infrastructure control plane plus virtualization platform. Its normal deployment model is a Linux front-end host running OpenNebula daemons, a database, SSH-managed hypervisor nodes, libvirt/QEMU/KVM or LXC, bridge/storage drivers, and persistent system directories. Railway is a container application platform. It can run web services from source, Dockerfiles, or Docker images, expose HTTP/HTTPS and selected TCP ports, and attach volumes, but it is not a host virtualization environment and does not provide privileged host control, `/dev/kvm`, kernel module loading, libvirt/systemd host service management, broad port ranges, or VM datastore semantics.

The best practical Railway architecture is:

1. Run OpenNebula itself outside Railway on a VPS, bare-metal host, or cloud VM that supports the required Linux OS, system packages, services, storage, networking, and hypervisor access.
2. Put only an OpenAsstAI web frontend/API proxy on Railway.
3. Have the Railway service call the external OpenNebula front-end API (`oned` XML-RPC, optionally OneFlow/OneGate/Form) over a secured endpoint or VPN/tunnel.

Railway can be used for limited slices:

- Feasible: OpenAsstAI custom UI/API proxy against an external OpenNebula controller.
- Feasible with engineering work: Upstream FireEdge/Sunstone-style UI container against an external OpenNebula controller, after rendering its config files from Railway environment variables.
- Feasible only as a demo/stub: Static documentation/demo container or UI mock that does not run OpenNebula.
- Not feasible: Full OpenNebula controller plus local hypervisor and VM runtime on Railway.

No product-code changes were made for this report.

## OpenNebula runtime requirements discovered

### Repository structure

This checkout is the upstream OpenNebula monorepo, not a small deployable web app. Important top-level/runtime areas discovered:

- Core daemon and control plane: `src/nebula`, `src/rm`, `src/schedm`, `src/monitor`, `src/sql`, `src/raft`.
- CLI tools and SDKs: `src/cli`, `src/oca`.
- Web/UI and API helpers: `src/fireedge`, `src/flow`, `src/onegate`, `src/form`, `src/hem`.
- Virtualization, monitoring, transfer, storage, IPAM, marketplace, networking drivers: `src/vmm_mad`, `src/im_mad`, `src/tm_mad`, `src/datastore_mad`, `src/vnm_mad`, `src/ipamm_mad`, `src/market_mad`.
- System packaging/service files: `share/pkgs/services/systemd`, `share/pkgs/logrotate`, `share/pkgs/sudoers`, `share/pkgs/tmpfiles`.
- Main daemon config: `share/etc/oned.conf`.

The repository README describes the front-end as the central OpenNebula installation point and says hosts are prepared afterward for KVM/LXC workloads (`README.md:38-48`).

### Normal installation model

OpenNebula documentation describes two principal deployment components: the Front-end control plane and Clusters/Hosts for workloads. The 7.2 docs say the Front-end hosts core services, REST API, CLI, and Sunstone UI, and must be deployed on an on-prem server, VM, or bare-metal/IaaS instance that meets OS/hardware requirements. The same docs list manual installation steps as database setup, repository configuration, and front-end package installation.

Local repo evidence matches that model:

- `install.sh` installs to system-style paths by default and has targeted install modes for FireEdge, Gate, Flow, Form, clients, and full OpenNebula (`install.sh:31-52`).
- `install.sh` installs `oned`, all CLI tools, `onedb`, and helper scripts as binaries (`install.sh:874-906`).
- Systemd units exist for `opennebula.service`, `opennebula-fireedge.service`, `opennebula-flow.service`, `opennebula-gate.service`, `opennebula-guacd.service`, SSH helper services, HEM, Form, showback, and Prometheus exporters.

### Main services

OpenNebula's service files show a multi-service OS deployment:

- `opennebula.service` runs `/usr/bin/oned -f` as `oneadmin`, after MySQL/MariaDB and `opennebula-ssh-agent.service`, with logrotate and cleanup hooks (`share/pkgs/services/systemd/opennebula.service:1-29`).
- `opennebula-fireedge.service` runs Node at `/usr/lib/one/fireedge/dist/index.js`, depends on `opennebula.service`, wants `opennebula-guacd.service`, and requires `/var/lib/one/.one/sunstone_auth` (`share/pkgs/services/systemd/opennebula-fireedge.service:1-23`).
- `opennebula-flow.service` runs Ruby `oneflow-server.rb` and requires `/var/lib/one/.one/oneflow_auth` (`share/pkgs/services/systemd/opennebula-flow.service:1-20`).
- `opennebula-gate.service` runs Ruby `onegate-server.rb` and requires `/var/lib/one/.one/onegate_auth` (`share/pkgs/services/systemd/opennebula-gate.service:1-20`).
- `opennebula-ssh-agent.service` maintains `/var/run/one/ssh-agent.sock` for `oneadmin` SSH operations.

### Database requirements

`share/etc/oned.conf` defaults to SQLite:

- `DB = [ BACKEND = "sqlite", TIMEOUT = 2500 ]` (`share/etc/oned.conf:80-81`).

It also includes a MySQL example:

- `BACKEND = "mysql"`, `SERVER`, `PORT`, `USER`, `PASSWD`, `DB_NAME`, `CONNECTIONS` (`share/etc/oned.conf:83-91`).

The current OpenNebula docs say SQLite is the default backend for small workloads, not recommended for production, and recommend MySQL/MariaDB for production/heavy workloads.

### Ports and endpoints

Local defaults:

- `oned` XML-RPC: port `2633`, bind `0.0.0.0` (`share/etc/oned.conf:113-115`).
- `oned` gRPC: port `2634`, bind `0.0.0.0` (`share/etc/oned.conf:117-119`).
- FireEdge web UI/API: `0.0.0.0:2616` (`src/fireedge/etc/fireedge-server.conf:11-18`).
- FireEdge event subscriber endpoint: `tcp://localhost:2101` (`src/fireedge/etc/fireedge-server.conf:35-37`).
- FireEdge Guacamole daemon: `localhost:4822` (`src/fireedge/etc/fireedge-server.conf:59-62`).
- FireEdge local zone endpoint: `http://localhost:2633/RPC2` (`src/fireedge/etc/fireedge-server.conf:64-70`).
- OneFlow: `127.0.0.1:2474`, talks to `http://localhost:2633/RPC2` (`src/flow/etc/oneflow-server.conf:5-19`).
- OneGate: `127.0.0.1:5030`, talks to `http://localhost:2633/RPC2` (`src/onegate/etc/onegate-server.conf:5-12`).
- OneForm: `127.0.0.1:13013` from `src/form/etc/oneform-server.conf`.
- VNC port pool starts at `5900` (`share/etc/oned.conf:93-97`).

### Hypervisor, storage, network, and SSH requirements

`share/etc/oned.conf` enables KVM, QEMU, and LXC VM managers:

- KVM driver: `NAME = "kvm"`, `EXECUTABLE = "one_vmm_exec"`, `TYPE = "kvm"` (`share/etc/oned.conf:467-477`).
- QEMU variant for nested/emulated guests (`share/etc/oned.conf:480-490`).
- LXC driver (`share/etc/oned.conf:508-516`).

It also configures transfer/storage drivers for dummy, LVM, shared, fs_lvm, qcow2, SSH, local, Ceph, device, iSCSI/libvirt, NetApp, PureFA, Restic, rsync, and virtiofs (`share/etc/oned.conf:543-566`).

OpenNebula's KVM node docs require:

- A deployed OpenNebula Front-end before KVM nodes.
- KVM kernel modules, QEMU accelerated by KVM, and libvirt.
- Installing `opennebula-node-kvm` and restarting `libvirtd` with `systemctl`.
- Passwordless SSH between front-end and nodes.
- Linux bridge/network configuration for VM networking.

Those requirements are fundamental blockers for Railway-hosted VM workloads.

## Railway capability/constraint matrix

| Capability or constraint | Railway status | OpenNebula impact |
| --- | --- | --- |
| Deploy a service from GitHub/source | Supported | Useful for a custom OpenAsstAI UI/API service. |
| Deploy from Dockerfile | Supported. Railway detects a root `Dockerfile`; custom path can use `RAILWAY_DOCKERFILE_PATH`. | Useful for a limited FireEdge/proxy container, not for full OpenNebula. |
| Deploy public Docker image | Supported | Could use a prebuilt image for experiments, but full stack requirements remain. |
| Service model | Railway services are containers deployed from images. | Good fit for one web process; poor fit for an OS-level cloud controller plus many system services. |
| Public HTTP/HTTPS | Supported via Railway domains and custom domains. Apps must listen on `0.0.0.0:$PORT`. | Good fit for OpenAsstAI UI/proxy or FireEdge web port. |
| WebSockets | Supported over HTTP/1.1 according to public networking specs. | FireEdge web sockets may work, but OpenNebula event/ZMQ reachability still needs design. |
| Raw TCP ingress | TCP Proxy exists and maps one internal port to a generated external domain/port. | Possible for a single non-HTTP service; not enough for broad VNC ranges or full OpenNebula network exposure. |
| Private networking | Railway supports private DNS between services in the same project. | Useful only for Railway-side helper services/databases; does not connect to external OpenNebula nodes unless bridged separately. |
| Persistent volumes | Supported for service data, mounted at runtime. | Could persist FireEdge key/session-adjacent files. Not suitable for OpenNebula VM datastores. |
| Ephemeral storage | Services have ephemeral storage limits; persistent data needs volumes. | Direct OpenNebula needs durable `/var/lib/one`, logs, images, DB, and datastores. |
| Systemd | Railway runs containers, not full Linux hosts with documented systemd service management. | Native OpenNebula package model and service dependencies do not fit directly. |
| Privileged containers / nested Docker / host virtualization | Railway support threads indicate containers cannot run Docker-in-Docker and lack permissions for virtualization. | Blocks libvirt/KVM, nested containers as infrastructure, kernel/device access, and likely `/dev/kvm`. |
| Kernel modules and `/dev/kvm` | Not exposed as a normal Railway app capability. | Blocks KVM hypervisor operation. |
| Host networking, Linux bridges, Open vSwitch, VLAN/VXLAN | Not a Railway app-level capability. | Blocks normal OpenNebula VM networking on Railway. |
| Root package installation | Possible during Docker image build, but not host-level package/service installation. | Can install app dependencies in an image, but cannot make Railway a KVM/libvirt host. |
| Database | Railway can run MySQL/Postgres services. | MySQL could back an external OpenNebula front-end, but direct `oned` on Railway would still hit service/runtime blockers. |
| Static outbound IP | Railway has outbound networking features, but it is a platform feature to plan explicitly. | If an external OpenNebula endpoint allowlists Railway, use Railway static outbound IP or a tunnel. |

## Direct deployment feasibility

### Full OpenNebula on Railway

Verdict: No.

Direct full-stack deployment would require Railway to act as an OpenNebula front-end host and one or more hypervisor nodes. That fails on several hard requirements:

- OpenNebula's official path is OS-package based and uses systemd units for `oned`, FireEdge, Flow, Gate, guacd, SSH agent, and timers.
- VM workloads need KVM/QEMU/libvirt or LXC, host kernel features, and often `/dev/kvm`.
- KVM node setup requires `systemctl restart libvirtd`.
- OpenNebula nodes need passwordless SSH among front-end and nodes, persistent `oneadmin` state, and stable host identities.
- VM networking requires Linux bridge/Open vSwitch/VLAN/VXLAN-style host networking.
- VM storage expects datastores, image files, block devices, NFS/Ceph/LVM/etc., not only app volumes.
- VNC/RDP/SSH console workflows need many private/public paths that Railway does not naturally expose as OpenNebula host networking.
- Directly exposing `oned` XML-RPC and other control-plane ports from an app platform is a security risk.

### Front-end-only `oned` on Railway with external hypervisor nodes

Verdict: Theoretically possible only with heavy custom container work, but not recommended.

You could try to run `oned` as a single foreground process with generated config files, a Railway volume for `/var/lib/one`, and Railway MySQL. This still leaves serious operational issues:

- The repo and packages assume multiple services and system paths.
- SSH agent, cleanup hooks, logrotate, timers, and auth files would need replacement supervision.
- OpenNebula front-end identity and `oneadmin` SSH keys become tied to Railway volume/redeploy behavior.
- Hypervisor nodes would have to be reachable from Railway over SSH, likely through public IPs, VPN, or tunnels.
- Railway restarts/redeploys are normal app lifecycle events; OpenNebula front-end state benefits from a more traditional host.
- This still would not run VM workloads on Railway.

### FireEdge/UI-only on Railway

Verdict: Feasible with a small wrapper/container, but only against an external OpenNebula controller.

FireEdge itself is a Node application. Its default config already supports `one_xmlrpc` pointing at a remote `oned` endpoint (`src/fireedge/etc/fireedge-server.conf:17-18`). However, the current upstream server reads YAML files from `/etc/one` or `$ONE_LOCATION/etc`; it does not directly read Railway environment variables for `port`, `one_xmlrpc`, `oneflow_server`, etc. A Railway deployment should therefore render config files at container startup from env vars.

FireEdge also reads server-admin credentials from `SUNSTONE_AUTH_PATH`, defaulting to `$ONE_LOCATION/var/.one/sunstone_auth` or `/var/lib/one/.one/sunstone_auth`. A Railway wrapper must create that file from secrets, or OpenAsstAI should avoid upstream FireEdge auth internals and implement a custom API layer.

## Best Railway-compatible architecture for OpenAsstAI based on OpenNebula

Recommended architecture:

```text
Browser
  -> Railway HTTPS domain
  -> OpenAsstAI web UI/API proxy service
  -> secured outbound HTTPS/VPN/tunnel
  -> external OpenNebula Front-end
       - oned XML-RPC: 2633/RPC2, preferably behind TLS reverse proxy
       - optional OneFlow: 2474
       - optional OneGate: 5030
       - optional OneForm: 13013
       - optional FireEdge/guacd local to OpenNebula if console features remain external
  -> OpenNebula-managed KVM/LXC hosts on private infrastructure
```

Why this is the best fit:

- Railway hosts the user-facing app where it is strong: HTTP app hosting, env vars, domains, deploys, logs.
- OpenNebula runs where it belongs: a Linux host or cluster with system packages, root-managed services, hypervisor/network/storage access, and persistent machine identity.
- The OpenAsstAI app can evolve independently from upstream FireEdge if product requirements differ.
- Security boundaries are cleaner: Railway never needs privileged host access or VM dataplane access.

Suggested product direction:

1. For fastest proof of concept, build a small OpenAsstAI service on Railway that calls OpenNebula XML-RPC/OCA APIs for read-only inventory and controlled operations.
2. For UI reuse, evaluate running upstream FireEdge in a Railway container against the external controller, but expect config/auth/startup wrapping.
3. For production, prefer a custom backend/proxy that stores no OpenNebula admin password in the browser and enforces OpenAsstAI authorization before calling OpenNebula.

## Required environment variables

### Railway service: custom OpenAsstAI proxy or wrapped FireEdge

Required:

| Variable | Example | Purpose |
| --- | --- | --- |
| `PORT` | Railway-provided | Public HTTP port. App must bind `0.0.0.0:$PORT`. |
| `OPENNEBULA_XMLRPC_URL` | `https://one.example.com/RPC2` | External `oned` XML-RPC endpoint. |
| `OPENNEBULA_ZONE_ID` | `0` | FireEdge/default zone ID or app zone config. |
| `OPENNEBULA_ZONE_NAME` | `OpenNebula` | Display/default zone name. |
| `OPENNEBULA_ZONE_ENDPOINT` | `https://one.example.com/RPC2` | Zone endpoint value. Often same as `OPENNEBULA_XMLRPC_URL`. |
| `OPENNEBULA_SERVERADMIN_USER` | `serveradmin` | Needed if using FireEdge-style server-admin token flow. |
| `OPENNEBULA_SERVERADMIN_PASSWORD` | secret | Used to render `sunstone_auth` as `user:password`; store only as Railway secret. |
| `NODE_ENV` | `production` | FireEdge/Node runtime mode. |
| `ONE_LOCATION` | `/app/one` | Recommended for FireEdge wrapper so configs live under `/app/one/etc` and writable files under `/app/one/var`. |

Recommended:

| Variable | Example | Purpose |
| --- | --- | --- |
| `OPENNEBULA_ZMQ_ENDPOINT` | `wss://one-events.example.com` or empty | Event subscription. Upstream default is `tcp://host:2101`; exposing raw ZMQ publicly is usually not recommended. |
| `OPENNEBULA_ONEFLOW_URL` | `https://one.example.com/oneflow` | Optional OneFlow API if service orchestration is required. |
| `OPENNEBULA_ONEFORM_URL` | `https://one.example.com/oneform/api/v1` | Optional OneForm/provider API. |
| `FIREEDGE_SESSION_EXPIRATION` | `180` | Render into FireEdge `session_expiration`. |
| `FIREEDGE_SESSION_REMEMBER_EXPIRATION` | `3600` | Render into FireEdge `session_remember_expiration`. |
| `FIREEDGE_API_TIMEOUT_MS` | `120000` | Render into FireEdge `api_timeout`. |
| `FIREEDGE_CORS` | `true` | Render into FireEdge `cors`. |
| `FIREEDGE_KEY` or persisted key file | secret | Stable JWT signing key. If upstream FireEdge generates this in a non-persistent path, sessions break on redeploy. |
| `RAILWAY_HEALTHCHECK_TIMEOUT_SEC` | `300` | Optional Railway deployment healthcheck tuning. |
| `RAILWAY_DOCKERFILE_PATH` | `deploy/railway/Dockerfile` | Use if Dockerfile is not at repo root. |
| `RAILWAY_RUN_UID` | `0` or app UID | Only if the container/volume permissions require it. Prefer non-root if possible. |

Optional console-related variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `GUACD_HOST` | `localhost` or external host | Only if browser console proxy is supported. |
| `GUACD_PORT` | `4822` | Guacamole daemon port. |
| `ENABLE_CONSOLES` | `false` | Strongly consider disabling consoles in the Railway slice until VNC/SSH/RDP reachability is designed. |

### External OpenNebula front-end configuration

These are normally file/config values rather than Railway env vars:

| Setting | Where | Purpose |
| --- | --- | --- |
| `ONE_XMLRPC` | Client env or app config | OpenNebula API endpoint for CLI/OCA clients. |
| `ONE_AUTH` | Client env or auth file | Path to OpenNebula credentials for CLI/OCA clients. |
| `DB BACKEND` | `/etc/one/oned.conf` | `sqlite` for small/evaluation; `mysql` for production. |
| `DB SERVER`, `PORT`, `USER`, `PASSWD`, `DB_NAME` | `/etc/one/oned.conf` | MySQL/MariaDB connection details. |
| `PORT`, `GRPC_PORT`, `LISTEN_ADDRESS` | `/etc/one/oned.conf` | `oned` XML-RPC/gRPC bind settings. |
| `ONEGATE_ENDPOINT` | `/etc/one/oned.conf` | Guest OneGate endpoint if used. |

## Deployment tutorial steps

### Path A: recommended production path

1. Provision an external OpenNebula front-end host.
   - Use a fresh supported Linux OS from the OpenNebula docs: RHEL/AlmaLinux 9 or 10, Debian 12 or 13, Ubuntu 22.04 or 24.04, or supported SUSE/openSUSE.
   - Minimum front-end-only sizing from current docs is a VM or bare-metal instance with 16 GiB RAM and 80 GiB free disk.
   - Use bare metal or virtualization-enabled infrastructure if the same host will also run KVM workloads.

2. Install OpenNebula externally.
   - For evaluation: use miniONE on a fresh Linux host.
   - For production: follow the manual path: database setup, repository setup, single front-end package install.
   - Configure MySQL/MariaDB for production workloads.
   - Start and verify `opennebula`, FireEdge, and required services with the host's normal service manager.

3. Add KVM/LXC workload nodes outside Railway.
   - Install `opennebula-node-kvm` or LXC node packages on the workload hosts.
   - Verify KVM/QEMU/libvirt availability.
   - Configure passwordless `oneadmin` SSH among front-end and nodes.
   - Configure bridge/storage networking according to your OpenNebula design.
   - Add hosts in Sunstone or CLI and verify `onehost list`.

4. Secure the OpenNebula API for Railway access.
   - Do not expose raw `http://host:2633/RPC2` broadly on the public internet.
   - Prefer a TLS reverse proxy, VPN, WireGuard/Tailscale-style tunnel, private link, or IP allowlist.
   - Create a specific OpenNebula service account for OpenAsstAI where possible.
   - Decide whether Railway needs only XML-RPC or also OneFlow/Form/Gate endpoints.

5. Build the Railway OpenAsstAI slice.
   - Prefer a small app/service that speaks OpenNebula XML-RPC/OCA APIs rather than deploying the full monorepo.
   - If reusing upstream FireEdge, add a small Dockerfile/start script in a future change that:
     - builds `src/fireedge`;
     - sets `ONE_LOCATION=/app/one`;
     - creates `/app/one/etc/fireedge-server.conf` from env vars;
     - creates `/app/one/var/.one/sunstone_auth` from Railway secrets;
     - persists `/app/one/var` on a Railway volume if stable FireEdge keys/session continuity matter;
     - starts `node dist/index.js` as the single foreground process.

6. Configure Railway.
   - Create a Railway project and service from the OpenAsstAI app path or a future FireEdge wrapper path.
   - Set the required env vars listed above.
   - Generate a public Railway domain.
   - Ensure the service binds to `0.0.0.0:$PORT`.
   - Add a volume only for app-generated runtime state, not for VM images/datastores.

7. Validate.
   - Confirm the Railway health check and public domain work.
   - Log in through the Railway-hosted app.
   - Verify read-only calls first: users, hosts, VMs, templates.
   - Test controlled actions on a non-production OpenNebula zone.
   - Leave console/VNC features disabled until networking is explicitly designed and secured.

### Path B: demo-only Railway container

Use this only for UI demos, docs, or non-production experiments.

1. Deploy a static or mock OpenAsstAI UI to Railway.
2. Use sample JSON or a read-only OpenNebula sandbox API.
3. Do not claim the Railway service is running OpenNebula workloads.
4. Do not expose real admin credentials.

### Path C: direct all-in-one container experiment

Not recommended. If attempted later, it should be labeled unsupported/research only.

A Dockerfile or public OpenNebula image may start some front-end processes, but it will not provide Railway-hosted VMs because KVM/libvirt/network/storage requirements are outside Railway's app container model.

## Dockerfile/railway.json proposal, not implemented

For a limited FireEdge-proxy slice, a safe small future implementation would be:

```dockerfile
# Proposal only. Not added by this report.
FROM node:20-bookworm AS build
WORKDIR /src/fireedge
COPY src/fireedge/package*.json ./
RUN npm ci
COPY src/fireedge ./
RUN npm run build

FROM node:20-bookworm-slim
ENV NODE_ENV=production
ENV ONE_LOCATION=/app/one
WORKDIR /app/fireedge
COPY --from=build /src/fireedge/dist ./dist
COPY --from=build /src/fireedge/etc /app/one/etc
COPY deploy/railway/start-fireedge.sh /app/start-fireedge.sh
CMD ["/app/start-fireedge.sh"]
```

The `start-fireedge.sh` wrapper would render config from env:

- `/app/one/etc/fireedge-server.conf`
- `/app/one/etc/fireedge/sunstone/sunstone-server.conf` if needed
- `/app/one/var/.one/sunstone_auth`
- `/app/one/var/.one/fireedge_key`

`railway.json` would only set the start command/healthcheck if needed. It cannot solve KVM/libvirt/systemd constraints.

## Risks / TODOs

- Decide whether to reuse upstream FireEdge or build a purpose-specific OpenAsstAI UI/API. A custom API proxy is likely cleaner and safer.
- Design OpenNebula API exposure. Public XML-RPC with admin credentials is high risk.
- Confirm exact OpenNebula version/tag and FireEdge Node version compatibility before building a container.
- Decide how OpenAsstAI maps users/roles to OpenNebula users/groups. Avoid sharing `serveradmin` broadly.
- Persist FireEdge signing key if using upstream FireEdge; otherwise all sessions may invalidate on redeploy.
- Disable or redesign console access. Browser console support may require guacd plus private reachability to VNC/SSH/RDP endpoints.
- Plan Railway outbound IP/tunnel strategy if the external OpenNebula firewall is restrictive.
- Do not put VM images, KVM disks, or OpenNebula datastores on Railway volumes.
- If using MySQL/MariaDB for external OpenNebula, run it close to the OpenNebula front-end rather than across high-latency public networking.
- Future documentation should include a threat model for OpenNebula credentials and API actions exposed through OpenAsstAI.

## References

### Local repository evidence

- `README.md`: front-end and node installation overview, lines 38-48.
- `install.sh`: install modes and installed binaries, lines 31-52 and 874-906.
- `share/etc/oned.conf`: DB, ports, KVM/QEMU/LXC, transfer/storage drivers, lines 18-120 and 410-566.
- `share/pkgs/services/systemd/opennebula.service`: systemd unit for `oned`.
- `share/pkgs/services/systemd/opennebula-fireedge.service`: systemd unit for FireEdge.
- `share/pkgs/services/systemd/opennebula-flow.service`: systemd unit for OneFlow.
- `share/pkgs/services/systemd/opennebula-gate.service`: systemd unit for OneGate.
- `src/fireedge/etc/fireedge-server.conf`: FireEdge host, port, XML-RPC, OneFlow/Form, event, guacd, zone config.
- `src/flow/etc/oneflow-server.conf`: OneFlow host/port/XML-RPC config.
- `src/onegate/etc/onegate-server.conf`: OneGate host/port/XML-RPC config.

### Public documentation

- OpenNebula 7.2 Front-end overview: https://docs.opennebula.io/7.2/software/installation_process/frontend_installation/overview/
- OpenNebula 7.2 database setup: https://docs.opennebula.io/7.2/software/installation_process/frontend_installation/database/
- OpenNebula 7.2 KVM node installation: https://docs.opennebula.io/7.2/software/installation_process/cluster_installation/kvm_node_installation/
- OpenNebula 7.2 installation overview: https://docs.opennebula.io/7.2/software/installation_process/overview/
- Railway services: https://docs.railway.com/services
- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway public networking: https://docs.railway.com/networking/public-networking
- Railway public networking specs and limits: https://docs.railway.com/networking/public-networking/specs-and-limits
- Railway application failed to respond troubleshooting: https://docs.railway.com/reference/errors/application-failed-to-respond
- Railway volumes: https://docs.railway.com/volumes
- Railway TCP proxy: https://docs.railway.com/networking/tcp-proxy
- Railway variables reference: https://docs.railway.com/variables/reference
- Railway private networking: https://docs.railway.com/networking/private-networking
- Railway Central Station, Docker-in-Docker limitation: https://station.railway.com/questions/self-hosted-runners-limitation-0229e01a
- Railway Central Station, virtualization permission limitation: https://station.railway.com/questions/deploying-a-docker-swarm-cluster-on-rail-2965021b
