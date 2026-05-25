# Codex Mission: Cherry Studio-inspired OpenAsstAI Playground

Working directory: /Users/minihanshi/project/openasstai
Target app: /Users/minihanshi/project/openasstai/openasstai-platform
Reference repo: /Users/minihanshi/project/reference-cherry-studio

Role:
You are Codex implementing code. Hermes is the product/technical lead. Do not ask the user questions. Inspect the Cherry Studio reference repo and implement a Cherry-Studio-inspired Playground inside OpenAsstAI's isolated platform app.

Critical context:
- OpenAsstAI is Agent-first. Do NOT reintroduce generic cloud-provider navigation.
- The P0 platform shell lives under `/openasstai-platform` and must remain Railway-runnable.
- A separate Codex process may still be fixing Agent-first navigation. Avoid broad rewrites; if conflicts occur, keep the minimal Agent-first nav: 我的 Agent, Agent 实例, Playground, 模型, 通道, 技能, OrcaTerm, 自动化, 账单/用量, 设置.
- Reference Cherry Studio for interaction/design patterns only. Do NOT copy licensing-sensitive large code blocks verbatim. Learn from its layout and component behavior.

Reference files to inspect in Cherry Studio:
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/pages/home/Chat.tsx`
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/pages/home/Messages/ChatNavigation.tsx`
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/pages/home/Messages/ChatFlowHistory.tsx`
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/components/ModelSelector.tsx`
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/components/ModelSelectButton.tsx`
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/components/Popups/SelectModelPopup`
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/services/ConversationService.ts`
- `/Users/minihanshi/project/reference-cherry-studio/src/renderer/src/types/chat.ts`
- `/Users/minihanshi/project/reference-cherry-studio/packages/aiCore/src/core/models`
- `/Users/minihanshi/project/reference-cherry-studio/packages/shared/config/providers.ts`

Goal:
Add an OpenAsstAI Playground page where users can test various models and keep conversation history. It should feel inspired by Cherry Studio: model selector, chat conversation list/history, message stream area, composer, provider/model identity, and session persistence.

Implementation scope:
Only edit files under `/openasstai-platform` plus result files. Do not edit upstream OpenNebula directories.

Required UX:
1. Add `Playground` to the Agent-first nav.
2. Add route `/playground` or `/console/playground` that displays:
   - left conversation/history rail;
   - main chat panel;
   - top model selector/provider picker;
   - current model badge/provider badge;
   - message list with user/assistant roles;
   - composer textarea with send button;
   - quick prompt chips;
   - empty state for new conversation;
   - conversation title and last updated time;
   - model change should be visible per conversation.
3. Support multiple mock model providers/models:
   - custom_subrouter / Hy3 preview
   - SubRouter / Claude Sonnet
   - OpenRouter / GPT-5 Chat
   - Tencent Hunyuan / Hy3 Preview
   - Ollama local / Qwen
4. Conversation history:
   - persist in browser localStorage for P0;
   - list previous conversations;
   - create new conversation;
   - select/delete conversation if easy;
   - keep chosen model per conversation.
5. API skeleton:
   - `GET /api/playground/models` returns available models.
   - `GET /api/playground/conversations` returns sample server conversations or empty array.
   - `POST /api/playground/chat` accepts `{ conversationId, modelId, messages }` and returns a mock assistant response clearly marked as mock/P0. If easy, echo with model name and guidance.
   - Keep future integration boundary for real OpenAI-compatible `/v1/chat/completions` through user-configured model credentials.
6. The page should be responsive and not ugly. Mobile should stack history and chat gracefully.
7. README should mention Playground route and that P0 responses are mock until model credentials/inference proxy are wired.

Verification:
Run inside `/openasstai-platform`:
- `npm run build`
- `node --check src/server/index.js`
- `node --check dist/server/index.js`
- Search active source under `/openasstai-platform/src` to ensure forbidden cloud-menu labels are not present: 轻量应用服务器, 云硬盘, 防火墙模板, 对象存储.
- Do not require local socket binding if sandbox blocks it, but make sure code still binds to `0.0.0.0:$PORT`.

Output:
Write `/Users/minihanshi/project/openasstai/.codex-openasstai-playground-result.txt` with:
- Cherry Studio reference files inspected;
- files changed;
- implemented Playground features;
- verification results;
- known limitations;
- next optimization suggestions.

Do not commit or push. Hermes will monitor, review, optimize, and push.
