# Oathbreaker provider for OpenClaw

Use [Oathbreaker](https://oathbreaker.ai) models in [OpenClaw](https://openclaw.ai). Oathbreaker serves abliterated GLM-5.3, DeepSeek V4.1 Flash and Kimi K3.1 Pro through an OpenAI-compatible Chat Completions API with prepaid credit.

Step-by-step guide with model picks and fixes: [Use abliterated models in OpenClaw](https://oathbreaker.ai/agents/openclaw).

## Install

```bash
openclaw plugins install openclaw-oathbreaker
```

If ClawHub does not list the package yet, install it from npm:

```bash
openclaw plugins install npm:openclaw-oathbreaker
```

Then sign in. [Create an account](https://oathbreaker.ai/sign-up), add credit and create an API key, and paste the key in the Models page of the Control UI or run:

```bash
openclaw onboard --auth-choice oathbreaker-api-key
```

For a script or server, pass the key directly:

```bash
openclaw onboard --non-interactive --accept-risk --mode local \
  --auth-choice oathbreaker-api-key --oathbreaker-api-key "$OATHBREAKER_API_KEY"
```

The plugin also reads `OATHBREAKER_API_KEY` from the Gateway's environment. Setup saves only the connection (`https://oathbreaker.ai/v1`) and makes `oathbreaker/oathbreaker-glm-5.3` the default model. Check it with:

```bash
openclaw models list --provider oathbreaker
```

## Models

USD per million tokens, checked November 21, 2026 against [oathbreaker.ai/pricing](https://oathbreaker.ai/pricing).

| Model ref | Context in OpenClaw | Max output | Input | Cached input | Output |
| --- | ---: | ---: | ---: | ---: | ---: |
| `oathbreaker/oathbreaker-glm-5.3` | 131,072 | 32,768 | $3.00 | $0.30 | $4.00 |
| `oathbreaker/oathbreaker-glm-5.3-flash` | 131,072 | 32,768 | $0.40 | $0.05 | $1.20 |
| `oathbreaker/oathbreaker-deepseek-v4.1-flash` | 32,768 | 32,768 | $0.40 | $0.05 | $1.20 |
| `oathbreaker/oathbreaker-deepseek-v4.1-flash-fast` | 32,768 | 32,768 | $0.50 | $0.05 | $1.50 |
| `oathbreaker/oathbreaker-kimi-k3.1-pro` | 32,768 | 24,576 | $4.50 | $0.45 | $9.00 |

DeepSeek Fast is the same model as DeepSeek V4.1 Flash on a faster route. Members of Oathbreaker get lower rates on every model except Kimi K3.1 Pro; OpenClaw shows the standard rates.

Oathbreaker admits DeepSeek and Kimi requests by a 131,072-unit budget that counts UTF-8 input bytes, message framing and the requested output tokens, with a request body of at most 262,144 bytes. The plugin therefore gives those models a conservative 32,768-token context. OpenClaw lowers `max_tokens` so input and output fit inside it, and compacts the history when the context fills. Use a GLM model for long agent sessions.

## Thinking

Every model reasons, and reasoning cannot be turned off. The plugin offers `low` (the default), `high` and `max`. Other OpenClaw levels map down: `off`, `minimal` and `medium` send `low`, and `xhigh` sends `high`. Reasoning tokens count as output.

## Tools and limits

Chat Completions tools, `tool_choice` and streamed tool calls work on all five models. Oathbreaker accepts up to 128 tools per request and no strict tool schemas, so the plugin never sends `strict: true`. It also leaves out fields the API rejects, such as `store` and `prompt_cache_key`. Input is text only.

## Troubleshooting

`401` means the key is wrong or revoked. An insufficient-credit error means your prepaid balance is empty. A `context_limit` error on DeepSeek or Kimi means the conversation outgrew the byte budget; run `/compact` or switch to a GLM model. Requests can run up to ten minutes; a client timeout does not prove generation stopped, so check usage in your account before you retry. More fixes are in the [OpenClaw setup guide](https://oathbreaker.ai/agents/openclaw#limits) and the [API error reference](https://oathbreaker.ai/docs#errors).

## Development

```bash
npm install
npm test
npm pack --pack-destination /tmp
openclaw plugins install npm-pack:/tmp/openclaw-oathbreaker-<version>.tgz --force
openclaw plugins inspect oathbreaker --runtime --json
```

The model catalog lives in `openclaw.plugin.json`, so OpenClaw can list the models without running plugin code.

## License

MIT
