import { buildOpenAICompletionsParams } from "openclaw/plugin-sdk/provider-transport-runtime";
import { describe, expect, it } from "vitest";
import plugin from "../index.js";
import { buildOathbreakerProvider } from "../models.js";

const DEFAULT_MODEL = "oathbreaker/oathbreaker-glm-5.3";

// Published limits and USD prices per million tokens, checked 2026-11-21 at
// https://oathbreaker.ai/pricing and the model pages. DeepSeek and Kimi admit
// requests by a 131,072-unit byte budget, so their context is a conservative
// 32,768-token estimate.
const EXPECTED = {
  "oathbreaker-glm-5.3": { contextWindow: 131072, maxTokens: 32768, cost: [3, 4, 0.3] },
  "oathbreaker-glm-5.3-flash": { contextWindow: 131072, maxTokens: 32768, cost: [0.4, 1.2, 0.05] },
  "oathbreaker-deepseek-v4.1-flash": { contextWindow: 32768, maxTokens: 32768, cost: [0.4, 1.2, 0.05] },
  "oathbreaker-deepseek-v4.1-flash-fast": { contextWindow: 32768, maxTokens: 32768, cost: [0.5, 1.5, 0.05] },
  "oathbreaker-kimi-k3.1-pro": { contextWindow: 32768, maxTokens: 24576, cost: [4.5, 9, 0.45] },
};

// The only top-level fields Oathbreaker's Chat Completions route accepts. Any
// other field (store, prompt_cache_key, user, metadata, ...) is a 400.
const ACCEPTED_FIELDS = new Set([
  "model", "messages", "max_tokens", "max_completion_tokens", "stream", "stream_options",
  "temperature", "top_p", "tools", "tool_choice", "reasoning_effort", "parallel_tool_calls",
  "response_format",
]);

function registerProvider() {
  const providers = [];
  const api = new Proxy(
    { registerProvider: (provider) => providers.push(provider) },
    { get: (target, key) => (key in target ? target[key] : () => {}) },
  );
  plugin.register(api);
  expect(providers).toHaveLength(1);
  return providers[0];
}

describe("registration", () => {
  it("registers API-key onboarding that saves only the connection", async () => {
    const provider = registerProvider();
    expect(provider.id).toBe("oathbreaker");
    expect(provider.envVars).toEqual(["OATHBREAKER_API_KEY"]);
    const method = provider.auth.find((entry) => entry.id === "api-key");
    expect(method?.starterModel).toBe(DEFAULT_MODEL);
    const requests = [];
    const config = await method.runNonInteractive({
      authChoice: "oathbreaker-api-key",
      opts: { oathbreakerApiKey: "synthetic-key" },
      config: {},
      baseConfig: {},
      runtime: { log() {}, error() {}, exit(code) { throw new Error(`exit ${code}`); } },
      resolveApiKey: async (request) => {
        requests.push(request);
        return { key: "synthetic-key", source: "profile" };
      },
      toApiKeyCredential: () => null,
    });
    expect(requests).toEqual([{
      provider: "oathbreaker",
      flagValue: "synthetic-key",
      flagName: "--oathbreaker-api-key",
      envVar: "OATHBREAKER_API_KEY",
    }]);
    expect(config.models.providers.oathbreaker).toEqual({
      baseUrl: "https://oathbreaker.ai/v1",
      api: "openai-completions",
      models: [],
    });
    expect(config.agents.defaults.model.primary).toBe(DEFAULT_MODEL);
    expect(config.agents.defaults.models[DEFAULT_MODEL].alias).toBe("GLM-5.3 Abliterated");
  });

  it("publishes all five models in the static catalog without credentials", async () => {
    const provider = registerProvider();
    const catalog = await provider.staticCatalog.run({});
    expect(catalog.provider.baseUrl).toBe("https://oathbreaker.ai/v1");
    expect(catalog.provider.models.map((model) => model.id)).toEqual(Object.keys(EXPECTED));
  });
});

describe("catalog", () => {
  const provider = buildOathbreakerProvider();

  it.each(Object.entries(EXPECTED))("%s has the published limits and prices", (id, expected) => {
    const model = provider.models.find((entry) => entry.id === id);
    expect(model).toBeDefined();
    expect(model.reasoning).toBe(true);
    expect(model.input).toEqual(["text"]);
    expect(model.contextWindow).toBe(expected.contextWindow);
    expect(model.maxTokens).toBe(expected.maxTokens);
    const [input, output, cacheRead] = expected.cost;
    expect(model.cost).toEqual({ input, output, cacheRead, cacheWrite: 0 });
  });
});

describe("Chat Completions payloads", () => {
  const provider = buildOathbreakerProvider();
  const tools = [{ name: "get_time", description: "Current time", parameters: { type: "object", properties: {} } }];
  const history = [
    { role: "user", content: "What time is it?", timestamp: 1 },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "I should call get_time." },
        { type: "toolCall", id: "call_1", name: "get_time", arguments: {} },
      ],
      api: "openai-completions",
      provider: "oathbreaker",
      model: "oathbreaker-glm-5.3",
      stopReason: "toolUse",
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      timestamp: 2,
    },
    { role: "toolResult", toolCallId: "call_1", toolName: "get_time", content: [{ type: "text", text: "12:00" }], isError: false, timestamp: 3 },
  ];

  for (const model of provider.models) {
    for (const [thinking, effort] of [["off", "low"], ["minimal", "low"], ["low", "low"], ["medium", "low"], ["high", "high"], ["xhigh", "high"], ["max", "max"]]) {
      it(`${model.id} at ${thinking} sends only accepted fields and effort ${effort}`, () => {
        const payload = buildOpenAICompletionsParams(
          { ...model, provider: "oathbreaker", baseUrl: provider.baseUrl, api: "openai-completions" },
          { systemPrompt: "You are helpful.", messages: history, tools },
          { reasoning: thinking, sessionId: "synthetic-session", maxTokens: 100_000, cacheRetention: "long" },
        );
        for (const key of Object.keys(payload)) expect(ACCEPTED_FIELDS.has(key), `unexpected field ${key}`).toBe(true);
        expect(payload.reasoning_effort).toBe(effort);
        // Never above the model's output cap. On the 32,768-token DeepSeek
        // rows OpenClaw also trims it so input plus output fit the context.
        expect(payload.max_tokens).toBeGreaterThan(0);
        expect(payload.max_tokens).toBeLessThanOrEqual(model.maxTokens);
        if (model.contextWindow > model.maxTokens) expect(payload.max_tokens).toBe(model.maxTokens);
        expect(payload).not.toHaveProperty("max_completion_tokens");
        expect(payload.stream_options).toEqual({ include_usage: true });
        for (const message of payload.messages) {
          expect(["system", "user", "assistant", "tool"]).toContain(message.role);
        }
        for (const tool of payload.tools) expect(tool.function.strict).not.toBe(true);
      });
    }
  }
});
