# Local Runbook

## Goal

Use this runbook to bootstrap LiteChat locally, configure a provider and model, and verify the chat path end-to-end.

## Prerequisites

- Node.js 22+
- npm
- A writable local filesystem for `.env.local` and `data/`

## Standard Local Setup

1. Install dependencies.

```bash
npm install
```

2. Bootstrap the app and first admin account.

```bash
npm run setup:init-admin
```

3. Follow the prompts.

- Choose `sqlite` for the default local path, or select `postgres` or `mysql` and provide connection details.
- Enter the first admin email and password.
- The script updates `.env.local`, runs migrations, and creates the admin account.

4. Start the app.

```bash
npm run dev
```

5. Open `http://localhost:3000/login` and sign in with the admin account created by the setup script.

## No-Secrets Local Chat Verification

Use this path when you do not want to depend on real OpenAI credentials.

1. Start the local mock Responses server.

```bash
npm run mock:openai-responses
```

2. In the LiteChat admin area, create a provider with these values.

- Name: `Local Mock Provider`
- Provider type: `OpenAI Responses`
- Base URL: `http://127.0.0.1:11434`
- API key: any non-empty string such as `sk-local-mock`
- Enabled: checked

3. Create a model with these values.

- Provider: `Local Mock Provider`
- Model ID: `gpt-4.1-mini`
- Display name: `Mock GPT 4.1 Mini`
- Sort order: `0`
- Enabled: checked
- Supports web search: checked

4. Return to the main chat view, select the mock model, send a message, and confirm that streaming text appears.

5. Optional: inspect the latest request received by the mock server.

```bash
curl http://127.0.0.1:11434/requests/latest
```

The response should include `stream: true` and, when the selected model supports it, `tools: [{"type":"web_search"}]`.

## Manual Smoke Checklist

1. Run the setup flow from a clean local environment.
2. Confirm `/` and `/admin` redirect to `/login` before authentication.
3. Log in with the admin account and confirm the protected shell renders.
4. Create an enabled provider.
5. Create an enabled model.
6. Confirm the model appears in the workspace selector.
7. Send a chat message and confirm the response streams into the transcript.
8. Set the browser language to Chinese before first load and confirm the UI defaults to `zh-CN`.
9. Switch the language manually between `English` and `简体中文` and confirm the shell and chat copy update immediately.
10. Reload and confirm the selected language is restored.
11. Select a model, reload, and confirm the last selected model is restored.
12. Start a conversation, reload, and confirm browser-local conversation history and drafts are restored.

## Automated Verification Performed For T018

The following checks were executed locally during T018:

- `npm run build`
- `npm run db:verify-factory`
- `npm run auth:verify`
- `npm run providers:verify`
- `npm run models:verify`
- `npm run chat:verify`
- Fresh admin bootstrap against a temporary SQLite database using `scripts/setup/init-admin.ts`
- Protected-route redirect checks for `/` and `/admin`
- Form login against a local webpack dev server
- Provider creation through `/api/admin/provider-configs`
- Model creation through `/api/admin/model-configs`
- Model discovery through `/api/models`
- Streaming chat through `/api/chat` against the local mock Responses server
- Mock request inspection confirming `web_search` tool injection for a web-search-enabled model

## Known Limitations

- Browser-language default selection, manual language switching, and browser-local preference restore still require a real browser smoke pass. They are documented above but were not fully automated in this environment.
- In this environment, `next dev` with Turbopack was unstable during scripted verification. `next dev --webpack` and `next build` both worked.
- In this environment, passing `--env-file` to `scripts/setup/init-admin.ts` through `tsx` collided with the Node.js runtime flag parser. The default interactive path that writes `.env.local` still worked.
