# Browser LLM Chat System Design

## Overview

This project is a lightweight, browser-based LLM chat tool for personal or team use. It supports shared model configuration managed by administrators, email/password login, and a ChatGPT-like user experience. The backend stores only low-volume system data such as users, sessions, provider settings, and model settings. Conversation history stays in the browser.

## Product Constraints

- Support email/password login only.
- Create the first administrator via a setup script that collects database settings plus admin email and password.
- Support common relational databases exposed by the chosen ORM/database framework from day one.
- Let setup choose the database type and required connection settings.
- Support the OpenAI Responses API.
- Support model-native web search without adding a user-facing web search toggle.
- Support English and Simplified Chinese UI.
- Default UI language from the browser, with user override.
- Keep the admin entry light. Admin users use the same main chat UI and access management from the user menu.
- Match the overall information architecture and interaction style of ChatGPT.

## Goals

- Deliver a minimal but complete chat product.
- Keep server responsibilities narrow: auth, configuration, provider proxying.
- Keep conversation storage local to the browser.
- Keep user UI preferences local to the browser.
- Support streaming responses.
- Make provider and model management safe for non-technical admins.
- Keep the database layer portable across the supported database set.

## Non-Goals

- Server-side conversation persistence.
- Multi-tenant org management in v1.
- File uploads, voice, image generation, or tool orchestration beyond model-native web search.
- SSO, OAuth, magic links, or email-based forgot-password recovery.
- Fine-grained RBAC beyond `admin` and `user`.

## Architecture Summary

### Frontend

- Framework: Next.js with App Router and TypeScript.
- Styling: Tailwind CSS.
- Rendering: server-rendered auth/admin pages where helpful, client-rendered chat workspace.
- Local persistence: IndexedDB for conversations, messages, drafts, and light UI state.

### Backend

- API routes inside the Next.js app.
- Session-based auth using secure HTTP-only cookies.
- Drizzle ORM for schema and queries.
- Multi-database connection factory with first-class support for SQLite, PostgreSQL, and MySQL-compatible databases.
- Provider adapter layer that normalizes chat calls behind a small interface.

### Data Ownership

- Server database: users, sessions, provider configs, model configs, audit-light metadata if needed.
- Browser local storage: conversation list, messages, drafts, last-selected local conversation, local-only titles, language preference, and last-selected model preference.

## User Roles

### User

- Log in.
- View shared enabled models.
- Create and manage local conversations in the browser.
- Chat with configured models.

### Admin

- Has all user capabilities.
- Sees a management entry in the user menu.
- Manages provider configs and model configs.

## UI Structure

### Main Chat UI

- Left sidebar
  - New chat action.
  - Local conversation list.
  - User menu at the bottom.
- Top bar
  - Current model selector.
  - Optional small status text for streaming/error state.
- Main panel
  - Empty state when no messages exist.
  - Message timeline.
  - Streaming assistant output.
- Bottom composer
  - Multiline input.
  - Send button.
  - Stop generation while streaming.

### Localization

- Support English and Simplified Chinese across chat UI and admin UI.
- On first load, infer the default language from `navigator.language`.
- If the browser language is unsupported, fall back to English.
- Let the user switch language explicitly from the UI.
- Persist the user-selected language locally in the browser.

### Admin Entry

- Placed inside the shared user menu.
- Visible only for admins.
- Navigates to a lightweight management area.

### Admin Pages

- Provider management.
- Model management.
- Reuse the main app shell instead of building a separate admin product.

## Authentication Design

- Email/password login only.
- Passwords hashed with Argon2id or bcrypt if platform constraints require it.
- Sessions stored server-side in the database.
- Session cookie is HTTP-only, secure in production, same-site `lax`.
- Middleware or route guards protect authenticated routes.
- Admin-only routes additionally check `role = admin`.
- A lower-priority in-app password reset/change flow will be added after the core chat path is complete.

## Database Design

### Guiding Rule

Persist only what must be shared or trusted by the server.

### Supported Databases

- The app is designed to run on common Drizzle-supported relational databases rather than treating SQLite as a product limitation.
- Initial supported set for implementation and setup flow:
  - SQLite
  - PostgreSQL
  - MySQL-compatible databases
- Application code should resolve a database client from configuration instead of importing a driver directly from business modules.

### Setup Flow

- The initialization script collects the database type and required connection settings before creating the first admin.
- For SQLite, the default database path should live inside the deployment directory, for example `./data/litechat.db`.
- For PostgreSQL and MySQL-compatible databases, the setup flow should accept the required connection string or equivalent discrete connection fields.
- The setup flow should write the resolved configuration into local app config such as `.env.local` for local/self-hosted deployment.

### Core Tables

#### `users`

- `id`
- `email` with unique constraint
- `password_hash`
- `role` with values `admin | user`
- `created_at`
- `updated_at`

#### `sessions`

- `id`
- `user_id`
- `expires_at`
- `created_at`

#### `provider_configs`

- `id`
- `name`
- `provider_type` with initial value `openai-responses`
- `base_url`
- `api_key_encrypted`
- `enabled`
- `created_at`
- `updated_at`

#### `model_configs`

- `id`
- `provider_config_id`
- `model_id`
- `display_name`
- `enabled`
- `supports_web_search`
- `sort_order`
- `created_at`
- `updated_at`

### Excluded Tables

No server-side `conversations` or `messages` tables in v1.

## Database Portability Strategy

- Use Drizzle schema definitions and a small repository layer.
- Keep business logic away from driver-specific APIs and SQL where possible.
- Resolve the active database through a shared connection factory keyed by configured database type.
- Avoid storing provider-specific JSON blobs unless necessary.

## Local Browser Storage Design

Use IndexedDB with a user-scoped namespace.

### Object Stores

#### `conversations`

- `id`
- `userId`
- `title`
- `modelConfigId`
- `createdAt`
- `updatedAt`

#### `messages`

- `id`
- `conversationId`
- `role`
- `parts`
- `createdAt`
- `status`

#### `drafts`

- `conversationId`
- `text`
- `updatedAt`

#### `ui_state`

- `key`
- `value`

#### `preferences`

- `key`
- `value`
- Initial keys:
  - `language`
  - `lastSelectedModelConfigId`

### Browser Storage Rules

- Namespace by authenticated user ID to avoid leaking local history between users on the same browser.
- Clear only session state on logout by default, not local conversation history.
- Persist language choice and the last selected model locally per user.
- On first use, derive language from the browser before any explicit user selection exists.
- Offer no server sync in v1.

## Provider Integration

### Adapter Interface

The backend uses a provider adapter interface so the app does not couple chat logic to one API shape.

Suggested adapter surface:

- `validateProviderConfig(input)`
- `listCapabilities(modelConfig)`
- `createResponseStream({ modelConfig, messages, signal })`

### First Adapter

- `OpenAIResponsesAdapter`
- Supports configurable `base_url` so OpenAI-compatible endpoints can be used where they expose the Responses API.

## OpenAI Responses API Design

### Request Flow

1. Browser loads enabled models from the backend.
2. Browser keeps the active conversation locally.
3. On send, browser submits:
   - selected `modelConfigId`
   - current local message history
   - new user message
4. Backend resolves the shared model config.
5. Backend decrypts the provider API key.
6. Backend builds a Responses API request and streams the result back.
7. Browser appends streamed assistant content to the local conversation.

### Message Mapping

- Map local messages to Responses API `input` items.
- Keep the mapping isolated in the adapter.
- Treat server responses as transient and stream them directly to the client.

## Web Search Policy

- No UI checkbox for web search.
- If the selected model config is marked as supporting web search, the backend automatically includes the relevant Responses tool configuration.
- The model decides whether to use the search tool.
- If the model config does not support web search, send a normal chat request without tool injection.

This keeps the feature always available where supported without adding user-facing complexity.

## Admin Management Design

### Provider Management

Admins can:

- Create provider configs.
- Edit provider name, base URL, API key, enabled state.
- Disable providers without deleting them.

### Model Management

Admins can:

- Create model configs tied to a provider.
- Edit display name, model ID, sort order, enabled state.
- Mark whether the model should receive automatic web search tooling.

### Preference Behavior

- The active language is resolved in this order:
  1. browser-local saved language preference
  2. browser language
  3. default fallback `en`
- The default model is resolved in this order:
  1. browser-local saved model preference if still enabled and visible to the user
  2. first enabled model by sort order
- If a saved model preference points to a disabled or missing model, ignore it and fall back safely.

### Password Reset Behavior

- Lower-priority scope: authenticated users can change their password from the app.
- The minimal flow should require the current password and a new password.
- After a successful password change, existing sessions should be invalidated or the user should be forced through a fresh sign-in path.
- Email-based forgot-password recovery remains out of scope for this phase.

### Validation Rules

- Model config must reference an existing provider config.
- Disabled providers should block new chat requests using dependent models.
- Disabled models should not appear in the user model selector.

## API Surface

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### Chat

- `GET /api/models`
- `POST /api/chat`

Note: language and default model preference remain client-side and do not require server preference APIs in v1.

### Admin

- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `PATCH /api/admin/providers/:id`
- `GET /api/admin/models`
- `POST /api/admin/models`
- `PATCH /api/admin/models/:id`

## Security Requirements

- Never expose provider API keys to the browser.
- Encrypt provider API keys at rest.
- Hash passwords with a modern password hashing function.
- Validate all admin writes server-side.
- Enforce auth and role checks on API routes and pages.
- Treat browser-provided conversation data as untrusted input.

## Error Handling

- Login errors return generic invalid credentials messages.
- Disabled or missing model config returns a clear user-safe error.
- Provider upstream failures surface as non-secret chat errors.
- Browser storage failures show a fallback error state and avoid silently discarding messages.

## Observability

Keep v1 lightweight.

- Structured server logs for auth events, admin writes, and chat proxy failures.
- No conversation content logging by default.
- No external telemetry requirement in v1.

## Delivery Definition Of Done

The system is considered runnable when all task files in `docs/tasks` are complete and the following path works:

1. Install dependencies and initialize the database.
2. Run the setup script, choose a database type, provide required connection info, and create the first admin.
3. Log in as the created admin.
4. Configure an OpenAI Responses provider.
5. Configure at least one enabled model.
6. Open the main chat UI.
7. Start a local conversation.
8. Send a message and receive a streamed response.
9. Reload the browser and confirm local conversation history remains available.
10. Reload the browser and confirm language and last selected model preference are restored.
11. Confirm the selected model can use model-native web search without a user toggle.

The lower-priority password reset task can be completed after the core runnable path above.

## Planned Task Breakdown

The task list lives in `docs/tasks/README.md` and individual `docs/tasks/Txxx-*.md` files. Tasks are intentionally small and sequential so that completing them one by one yields a working product at the end.
