# LLM Parameter Audit

Date: 2026-04-01

This audit covers the providers and model families exposed by the application and the parameter representation implemented in the backend.

## Sources

- OpenAI:
  - https://platform.openai.com/docs/guides/gpt-5
  - https://platform.openai.com/docs/guides/migrate-to-responses
  - https://platform.openai.com/docs/models/gpt-5.2-codex
- Anthropic:
  - https://docs.anthropic.com/en/api/messages
  - https://platform.claude.com/docs/en/build-with-claude/effort
- DeepSeek:
  - https://api-docs.deepseek.com/api/create-chat-completion/
  - https://api-docs.deepseek.com/guides/thinking_mode
- Zhipu GLM:
  - https://docs.bigmodel.cn/cn/api/introduction
  - https://docs.bigmodel.cn/cn/guide/models/text/glm-5
  - https://docs.bigmodel.cn/cn/guide/models/text/function_call
- MiniMax:
  - https://platform.minimax.io/docs/api-reference/text-openai-api
  - https://platform.minimax.io/docs/api-reference/text-anthropic-api
- Ollama:
  - https://docs.ollama.com/api/chat
  - https://docs.ollama.com/modelfile

## Provider Notes

### OpenAI

- GPT-5 family is treated as Responses-first.
- GPT-5.1 and GPT-5.2 style models only allow sampling and logprob controls when `reasoning_effort=none`.
- GPT-5 base family (`gpt-5`, `gpt-5-mini`, `gpt-5-nano`) drops `temperature`, `top_p`, `logprobs`, and `top_logprobs`.
- GPT-4.1 and GPT-4o families keep the broader OpenAI-compatible parameter set.

### Anthropic

- Claude 4 and Claude 3.7 families keep `thinking`.
- Claude 3.5 and Claude 3 Haiku families do not expose `thinking`.
- Claude Opus 4.1 drops `temperature` and `top_p` together because the provider documents that combination as restricted.

### DeepSeek

- `deepseek-chat` keeps the OpenAI-compatible surface and adds `thinking`.
- `deepseek-reasoner` drops `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`, `logprobs`, and `top_logprobs` per official thinking-mode guidance.

### GLM

- `glm-5` and `glm-5.1` expose `thinking`, `response_format`, tools, and function calling.
- `tool_choice` is restricted to `auto`.
- `temperature` and `top_p` are constrained to `[0, 1]`.
- `glm-5.1` currently reuses the `glm-5` parameter profile in the app when the public docs do not differentiate the request surface explicitly.

### MiniMax

- OpenAI-compatible MiniMax models expose `reasoning_split` and the core compatible surface.
- The docs state that `presence_penalty`, `frequency_penalty`, `logit_bias`, and some legacy parameters are ignored; the app drops those from the canonical model-parameter layer.
- Anthropic-compatible MiniMax models keep `metadata`, `tools`, `tool_choice`, `top_p`, and `stream`.
- The docs contain conflicting statements about `thinking` on the Anthropic-compatible route; the app accepts and forwards it, but treats it as provider-controlled behavior.

### Ollama

- Top-level `/api/chat` parameters represented in the app:
  - `tools`
  - `format`
  - `stream`
  - `think`
  - `keep_alive`
  - `logprobs`
  - `top_logprobs`
- Runtime `options` parameters represented in the app:
  - `temperature`
  - `num_ctx`
  - `repeat_last_n`
  - `repeat_penalty`
  - `seed`
  - `stop`
  - `num_predict`
  - `top_k`
  - `top_p`
  - `min_p`

## Implementation Files

- `server/services/llmModelCapabilities.service.js`
- `server/services/llmPayloadCapabilities.service.js`
- `server/services/llmAdminParameters.service.js`
- `server/services/openai/apiClient.js`
- `server/services/anthropic.service.js`
- `server/services/deepseek.service.js`
- `server/services/glm.service.js`
- `server/services/minimax.service.js`
- `server/services/ollama.service.js`
