# OpenAsstAI Platform P0

This app is an isolated OpenAsstAI Agent platform shell for Railway. It demonstrates an Agent-first console with mock Hermes Agent data and API skeletons.

The runtime carrier remains external provider infrastructure. This app does not install OpenNebula and does not call real OpenNebula XML-RPC in P0. Provider integration is isolated behind `src/server/adapters/opennebula`.

## Local Run

```bash
cd openasstai-platform
npm install
npm run dev
```

Open `http://localhost:3000/console/hermes/instances/ins-hermes-001`.

## Build And Start

```bash
cd openasstai-platform
npm run build
npm start
```

The server binds to `0.0.0.0:$PORT`, defaulting to port `3000`.

## Railway Deploy

1. Create a Railway service from this repository.
2. Set the Railway service root directory to `openasstai-platform`.
3. Use `npm run build` as the build command.
4. Use `npm start` as the start command.
5. Add environment variables from `.env.example`.

`railway.json` is included for root-directory deployment and sets the Railpack build command, start command, and `/api/health` healthcheck. Railway will provide `PORT`; do not hardcode it. The Node server binds `0.0.0.0:${PORT}` and defaults to `3000` for local runs.

Keep OpenNebula controllers, Agent runtime carriers, WeChat/QQ gateways, SkillHub, model providers, and OrcaTerm gateway as external services. The platform UI should expose them through Agent concepts, not as standalone cloud product menus.

## API Skeleton

- `GET /api/health`
- `GET /api/agents/search?q=`
- `GET /api/instances`
- `GET /api/instances/:id`
- `GET /api/instances/:id/agent`
- `PATCH /api/instances/:id/agent/models/default`
- `POST /api/instances/:id/agent/channels`
- `POST /api/instances/:id/agent/skills`
- `POST /api/instances/:id/agent/actions/restart`
- `GET /api/instances/:id/agent/logs`

## OpenNebula Adapter Boundary

The P0 adapter exposes stubs for:

- `validateConnection`
- `listHosts`
- `listTemplates`
- `listVMs`
- `createVM`
- `getVM`
- `powerAction`
- `deleteVM`
- `injectHermesAgentBootstrap`

When `OPENNEBULA_XMLRPC_URL`, `OPENNEBULA_USERNAME`, and `OPENNEBULA_PASSWORD` are present, the adapter reports `configured-stub`. Live XML-RPC transport should be added in a later provider integration milestone.

## P0 Limitations

- Data is in-memory mock/sample data.
- Authentication, tenant isolation, persistence, billing, audit trails, live terminal, and provider provisioning are not implemented yet.
- Model, channel, and skill mutations update process memory only.
