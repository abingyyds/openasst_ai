# OpenAsstAI Phase 1 Full User + Provider Flow Follow-up

Working directory: /Users/minihanshi/project/openasstai

## Context
A previous Codex worker is already improving the Phase 1 MVP. Continue from the current checkout and complete the most important remaining Phase 1 product gaps. The user specifically cares about the USER-SIDE setup flow and Provider/server handoff flow, not just backend primitives.

## User's latest requirements
1. Make Phase 1 feel complete enough to demo end-to-end.
2. The user-side configuration flow must be very clear:
   - choose an AI Agent/template,
   - understand what will be installed/running,
   - create an instance,
   - configure model/API key,
   - configure channels,
   - configure skills,
   - use chat/terminal/logs/usage.
3. Show clearly how different AI Agent/templates are installed/started.
4. Add/complete the Provider flow: a server provider should be able to hand a server to the platform with a one-click-ish agent install command/token flow.
5. Keep claims honest: do not say this is production secure if it is still local/dev sandbox.

## Hard constraints
- Do not break existing auth/session/API contracts.
- Do not store raw SSH passwords or build a flow where the platform directly manages user servers by saved SSH passwords.
- Provider handoff should be token + Node Agent install command style: server calls back to platform.
- Keep payment as internal estimate/ledger only.
- Keep changes focused and buildable.

## Implementation priorities
A. User onboarding wizard / guided flow
- Add or polish a clear stepper/checklist in the user console: Choose Agent -> Create Instance -> Configure Model -> Enable Channel -> Enable Skills -> Test Chat -> Terminal/Logs.
- Make template cards/details explain what gets installed, runtime, commands/adapters, required config, estimated cost.
- Make instance detail page clearly show next actions and completion status.

B. Template install/start clarity
- Add data fields/seed data if needed for install method, framework, startup command, health check, default config hints.
- Surface these in template detail and instance console.

C. Provider/server handoff flow
- Complete Provider application UI/API if partial.
- Let approved/pending providers create/register a node and get a one-line install command like:
  curl -fsSL <platform>/install-node.sh | sh -s -- --token <token>
- Add public or authenticated install script endpoint if appropriate.
- Node registration/heartbeat should be demoable with token and status visible in provider console/admin.
- Admin should be able to approve/reject provider/node if the foundation exists.

D. Verification
- Run npm run db:migrate.
- Run npm run build.
- Add/run npm run smoke if present/possible.
- Report exact files changed and gaps left.

## Output format
Concise final report:
- Implemented
- Verification commands/results
- Remaining blockers
- Files changed
