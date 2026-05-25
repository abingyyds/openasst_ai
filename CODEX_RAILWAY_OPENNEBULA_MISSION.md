# Codex Research Mission: OpenNebula/one on Railway deployment feasibility and docs

Working directory: /Users/minihanshi/project/openasstai

Context:
The repository has just been replaced with upstream OpenNebula/one source and pushed to origin/main. The user wants to reopen/rebuild OpenAsstAI based on OpenNebula/one, and asked for Codex to investigate how to deploy it on Railway, including deployment tutorial and required environment variables.

You are Codex. Do NOT make product-code changes unless they are documentation/report files only. Your primary task is research and feasibility analysis.

Goals:
1. Inspect this OpenNebula/one repository structure.
2. Identify what OpenNebula components exist and how they are normally installed/run.
3. Research Railway deployment constraints and whether this full OpenNebula stack can realistically run on Railway.
4. Produce a deployment guide or feasibility report for Railway, including:
   - whether direct Railway deployment is feasible
   - blockers (systemd, privileged services, KVM/libvirt, networking, persistent storage, root packages, ports, DB requirements, etc.)
   - possible Railway-compatible slices, e.g. FireEdge UI/API proxy only, docs/demo-only container, or external OpenNebula controller with Railway-hosted frontend/proxy
   - required environment variables for any feasible Railway slice
   - if not feasible, recommended alternative deployment targets (VPS/bare-metal, Docker host, Kubernetes, etc.)
   - step-by-step deployment tutorial for the best practical path
5. If Railway deployment requires a Dockerfile/railway.json only for a limited demo/proxy mode, propose it clearly but do not implement unless safe and small.

Research targets:
- Official OpenNebula install docs in this repo and public docs if accessible.
- Railway docs for Dockerfile/Nixpacks, persistent volumes, environment variables, services, ports, TCP limits, privileged containers/systemd constraints.
- Existing OpenNebula Docker/container deployment examples, if any.

Output:
Write a report to `/Users/minihanshi/project/openasstai/CODEX_RAILWAY_OPENNEBULA_REPORT.md` with sections:
- Executive verdict
- OpenNebula runtime requirements discovered
- Railway capability/constraint matrix
- Direct deployment feasibility
- Best Railway-compatible architecture for OpenAsstAI based on OpenNebula
- Required environment variables
- Deployment tutorial steps
- Risks / TODOs
- References

Also write your final summary to `/Users/minihanshi/project/openasstai/.codex-railway-opennebula-result.txt`.

Verification:
- Do not run destructive commands.
- Do not attempt to install OpenNebula system packages on this Mac.
- If you add report files, show git status/diff stat at the end.
