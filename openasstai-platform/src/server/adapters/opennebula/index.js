export class OpenNebulaAdapter {
  constructor(env = process.env) {
    this.endpoint = env.OPENNEBULA_XMLRPC_URL || "";
    this.username = env.OPENNEBULA_USERNAME || "";
    this.password = env.OPENNEBULA_PASSWORD || "";
  }

  get configured() {
    return Boolean(this.endpoint && this.username && this.password);
  }

  async validateConnection() {
    if (!this.configured) {
      return {
        ok: false,
        mode: "mock",
        reason: "OpenNebula credentials are not configured"
      };
    }

    return {
      ok: true,
      mode: "configured-stub",
      endpoint: this.endpoint,
      reason: "Credentials are present; live XML-RPC transport is intentionally not enabled in P0"
    };
  }

  async listHosts() {
    return this.stubResult("listHosts");
  }

  async listTemplates() {
    return this.stubResult("listTemplates");
  }

  async listVMs() {
    return this.stubResult("listVMs");
  }

  async createVM({ templateId, name, userId, bootstrap }) {
    return this.stubResult("createVM", { templateId, name, userId, bootstrapRequested: Boolean(bootstrap) });
  }

  async getVM(vmId) {
    return this.stubResult("getVM", { vmId });
  }

  async powerAction(vmId, action) {
    return this.stubResult("powerAction", { vmId, action });
  }

  async deleteVM(vmId) {
    return this.stubResult("deleteVM", { vmId });
  }

  async injectHermesAgentBootstrap(vmId, bootstrapConfig) {
    return this.stubResult("injectHermesAgentBootstrap", {
      vmId,
      hasSigningKey: Boolean(bootstrapConfig?.signingKey),
      channelCount: bootstrapConfig?.channels?.length || 0
    });
  }

  stubResult(operation, payload = {}) {
    return {
      ok: false,
      operation,
      mode: this.configured ? "configured-stub" : "mock",
      message: "OpenNebula provider calls are isolated behind this adapter and are not executed in P0.",
      payload
    };
  }
}
