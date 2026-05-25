export const instances = [
  {
    id: "ins-hermes-001",
    name: "阿炳开的",
    region: "广州",
    zone: "广州七区",
    status: "running",
    statusText: "运行中",
    image: "OpenAsstAI Hermes Agent Runtime 2026.04",
    bundle: "2核 4GB 承载实例",
    ipv4: "43.128.106.54",
    privateIpv4: "10.10.18.24",
    os: "Ubuntu 24.04 LTS",
    createdAt: "2026-04-30T09:30:00.000Z",
    expiresAt: "2027-04-30T09:30:00.000Z",
    traffic: {
      includedGb: 1200,
      usedGb: 186.4
    },
    cpu: {
      cores: 2,
      usage: 18
    },
    memory: {
      totalGb: 4,
      usage: 42
    },
    disk: {
      totalGb: 80,
      usage: 31
    }
  }
];

export const agents = {
  "ins-hermes-001": {
    id: "agent-hermes-001",
    instanceId: "ins-hermes-001",
    name: "Hermes Agent",
    version: "2026.4.30",
    status: "running",
    statusText: "运行中",
    heartbeatAt: "2026-05-26T00:58:00.000Z",
    modelWarning: "添加至少 1 个模型，Hermes 才能正常工作",
    modelPlans: [
      {
        id: "hy-token-personal",
        name: "腾讯云 Hy Token Plan（个人版）",
        model: "Hy3 preview",
        provider: "custom_subrouter",
        status: "active",
        quotaText: "预览额度已接入",
        latencyMs: 86
      }
    ],
    defaultModel: {
      provider: "custom_subrouter",
      model: "Hy3 preview",
      planId: "hy-token-personal"
    },
    channels: [
      {
        id: "wechat",
        name: "微信",
        status: "connected",
        statusText: "已连接",
        account: "OpenAsstAI 教学助手"
      },
      {
        id: "qq",
        name: "QQ",
        status: "connected",
        statusText: "已连接",
        account: "Hermes Agent Bot"
      }
    ],
    skills: {
      skillhubUrl: "https://skillhub.openasstai.local",
      warning: "检测到未知技能来源，请确认 SkillHub 签名与权限范围",
      installed: [
        {
          id: "teacher-ai-preparing-lesson",
          name: "teacher-ai-preparing-lesson",
          version: "2.1.1",
          source: "SkillHub"
        },
        {
          id: "teacher-assistant",
          name: "teacher-assistant",
          version: "1.0.1",
          source: "SkillHub"
        }
      ]
    }
  }
};

export const logs = {
  "ins-hermes-001": [
    {
      id: "log-001",
      level: "info",
      timestamp: "2026-05-26T00:58:14.000Z",
      message: "Hermes Agent heartbeat accepted"
    },
    {
      id: "log-002",
      level: "warn",
      timestamp: "2026-05-26T00:49:27.000Z",
      message: "Model registry contains one preview model; add a production fallback before public rollout"
    },
    {
      id: "log-003",
      level: "info",
      timestamp: "2026-05-26T00:42:03.000Z",
      message: "微信 channel token refreshed"
    }
  ]
};

export function findInstance(instanceId) {
  return instances.find((instance) => instance.id === instanceId);
}

export function findAgent(instanceId) {
  return agents[instanceId];
}
