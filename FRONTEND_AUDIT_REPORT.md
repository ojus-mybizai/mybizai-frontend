# Frontend Architectural Audit Report — Modular SaaS Readiness

**Date:** February 2025  
**Scope:** Full frontend codebase audit before subscription billing (Razorpay), paid module gating (Chat Agent), feature visibility, upgrade prompts, and subscription lifecycle UI.  
**Intent:** No implementation — audit only.

---

## 1. Frontend Stack Overview

| Area | Technology |
|------|------------|
| **Framework** | **Next.js 16.0.3** (App Router) |
| **React** | 19.2.0 |
| **State management** | **Zustand** (auth-store, theme-store, agent-store, catalog-store, customer-store, etc.). No Redux. No global React Context for app state. |
| **Routing** | Next.js App Router (`app/`). File-based routes; no central route config. |
| **Auth handling** | Session token in `sessionStorage` (`access_token`). **AuthBootstrap** in root layout restores token, calls `/auth/refresh` then `/auth/users/me`, populates **auth-store**. **AuthGuard** redirects unauthenticated users to `/login?next=...` and onboarding to `/onboarding`. **ProtectedShell** = AuthGuard + AppShell; used per-page, not in a shared layout. |
| **API layer** | Single **api-client** (`lib/api-client.ts`): `apiFetch(path, options)`. Base URL from `NEXT_PUBLIC_API_URL`. Auth: Bearer from store; 401 triggers token refresh and single retry. No axios/fetch wrapper abstraction beyond this. |
| **Global layout** | Root `app/layout.tsx`: ThemeController + AuthBootstrap wrap children. No shared layout for authenticated app — each protected page wraps itself with `<ProtectedShell>`. |
| **UI components** | Co-located under `components/` (dashboard, agents, catalog, customers, conversations, orders-bookings, data-sheet, settings, etc.). One feature folder: `features/data-sheet/` (context, api, routes, components). Tailwind + CSS variables for theme. |
| **Sidebar / menu** | Implemented inside **AppShell** (`components/app-shell.tsx`). No separate nav component; nav structure is a **function** `buildNavItems(lmsEnabled, agentsEnabled)` in the same file. |
| **Environment** | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FACEBOOK_APP_ID`. Read at runtime in `api-client.ts` and `app/layout.tsx`. No `.env.example` or central config module in repo. |

---

## 2. Current Feature Organization

### Where features live

| Feature | Route(s) | Notes |
|--------|----------|--------|
| **Chat Agent UI** | `app/agents/`, `app/agents/new`, `app/agents/[agentId]/*` (overview, channels, tools, follow-ups, knowledge-base, analytics, test), `app/agents/templates` | All under `agents/`. Components in `components/agents/`. Services: `services/agents.ts`, `services/followups.ts`, `services/message-templates.ts`, `services/channels.ts`, `services/knowledge-base.ts`, `services/datasheet-tools.ts`, `services/tools.ts`. State: `lib/agent-store.ts`. |
| **Manual messaging / Conversations** | `app/conversations`, `app/conversations/[conversationId]` | Single conversations page with list + detail; uses `ConversationsView` from same page. Services: `services/customers.ts` (listAllConversations, listMessages, appendMessage, toggleConversationStatus, etc.). **No ModuleGuard** — only sidebar hides when LMS off. |
| **Follow-ups UI** | `app/agents/[agentId]/follow-ups` | Agent-scoped; uses `services/followups.ts`. Gated by ModuleGuard `agents`. |
| **Dynamic sheets** | `app/data-sheet`, `app/data-sheet/new`, `app/data-sheet/[modelId]/*` (settings, import) | Feature-style in `features/data-sheet/` (context, api, routes, state). Pages delegate to feature. Gated by ModuleGuard `lms`. |
| **Dashboard** | `app/dashboard` | Metrics + chat view; uses `useDashboardStats`, `useReportsDashboard`, `sendDashboardChat` (services/dashboard, dynamic-data). No module guard. |
| **Settings / Account** | `app/settings`, `app/storefront/settings` | Single settings page with tabs (profile, workspace, business, roles, knowledge_base, notifications). Services: `services/settings.ts`. No subscription/billing UI. |

### Domain grouping

- **Partially grouped:** Agents are under `app/agents/` and `components/agents/` with a dedicated store and services. Data-sheet is the only feature using a `features/`-style folder.
- **Scattered:** Conversations, channels, customers, work, employees, catalog, orders live as top-level app routes with components in `components/` by name (e.g. `customers`, `conversations`, `orders-bookings`). No domain folders like `features/conversations` or `features/catalog`.
- **LMS vs “Foundation”:** Sidebar groups “Foundation” (Dashboard, Catalog, Orders, Reports, Settings) vs “Purchased Modules” (Storefront, Business Agents). Chat Agent is the only real “module” with a guard; LMS (Customers, Conversations, Channels, Work, Employees, Data-sheet) is gated by `lms_enabled` but conversations route has **no ModuleGuard**, so direct URL access is possible without LMS.

---

## 3. Permissions / Role Control (Current)

| Mechanism | Present? | Details |
|-----------|----------|---------|
| **Role-based access** | Partial | Backend has roles (owner, manager, executive). Frontend **auth-store** has `defaultRole`; **no** role-based UI or route guards. |
| **Permission context** | No | No React context or store for permissions. |
| **Middleware** | No | No `middleware.ts` in frontend. |
| **Route guards** | Auth only | **AuthGuard** checks `accessToken` and `onboardingRequired`; redirects to login or onboarding. No route-level check for roles or modules. |
| **Feature flags** | Via business | `user?.businesses?.[0]?.lms_enabled` and `agents_enabled` drive sidebar and **ModuleGuard**. No dedicated feature-flag system. |
| **Conditional rendering by role** | Local only | e.g. `employees` page uses “canManageEmployees” (owner/manager); no shared hook or provider. |

**Summary:** After login, any authenticated user can hit any URL. Sidebar hides items when `lms_enabled` or `agents_enabled` is false. **ModuleGuard** shows a “not enabled” message on many pages (LMS and Agents) but **conversations are not wrapped** — so Conversations is accessible without LMS. There is no subscription status, no “upgrade” flow, and no 403-driven UI.

---

## 4. Sidebar / Navigation Structure

- **Static vs config:** Nav is **code-driven** in `app-shell.tsx`: `buildNavItems(lmsEnabled, agentsEnabled)` returns a mixed array of sections and items. No separate JSON/YAML nav config file.
- **Dynamic hiding:** Yes. When `lmsEnabled` is false, Foundation + Storefront + (if agents) Business Agents are shown; Customers, Conversations, Channels, Work, Employees are omitted. When `agentsEnabled` is false, the whole “Business Agents” block is omitted.
- **Central config:** No. Nav shape and labels live only in `app-shell.tsx`.
- **Layout per module:** No shared layout that applies one shell per “module”. Each page uses `<ProtectedShell>` (and often `<ModuleGuard>`) individually. Agent detail has `app/agents/[agentId]/layout.tsx` for tabs and breadcrumb but still wraps with ProtectedShell + ModuleGuard in that layout.

**Risks for billing:** Adding “Subscription” or “Upgrade” links, or hiding whole sections by subscription status, will require editing `buildNavItems` and possibly introducing a shared nav config that can be driven by subscription/module entitlement.

---

## 5. API Response Handling

- **Global interceptor:** Only the 401 + refresh + retry logic in `apiFetch`. No response interceptor that runs for every request (e.g. to show toasts or redirect on 403).
- **Errors:** Non-401 errors: `buildError(response)` builds an `ApiError` (message from body, `error.status`, `error.data`). Caller must handle. No global error boundary or toast for API errors.
- **401:** Handled in api-client: refresh token, retry once, then throw. On refresh failure, `logout()` and `broadcastAuthEvent("logout")` run.
- **403:** **Not treated specially** in api-client. Same as 4xx: build error and throw. Only **knowledge-base-tab** and **login** page check `err?.status === 403` for user-facing copy. No global 403 → “upgrade” or “permission denied” flow.
- **Centralized request wrapper:** Only `apiFetch`. Services and components call it directly; no wrapper that e.g. maps 403 to a modal or redirect.

**Gap for subscription:** When backend returns 403 for “module not subscribed” or “plan limit”, the frontend has no single place to show an upgrade modal or redirect. Each caller would need to branch on `error.status === 403`.

---

## 6. Chat Agent Frontend Flow

- **Enabling chat agent:** There is no “enable chat agent” onboarding step in the frontend. Backend exposes `agents_enabled` (and entitlement service) per business; frontend reads `user?.businesses?.[0]?.agents_enabled` and uses it for sidebar and ModuleGuard. Enabling is assumed to be done by reseller/owner (backend).
- **Chat agent settings:** Under **Agents** → select agent → tabs: **Overview**, **Channels**, **Tools**, **Follow-ups**, **Knowledge Base**, **Analytics**, **Test**. Agent config (name, role, instructions, model, reply mode, etc.) is in Overview and other tabs; state in **agent-store**; persistence via `services/agents.ts` (updateAgent, bindChannels, bindTools, bindKnowledgeBases, etc.).
- **Conversation UI (inbox):** **Conversations** (`app/conversations`) lists all conversations (from `listAllConversations`); clicking one shows thread and allows sending messages and toggling AI vs Manual. Messages from `listMessages(conversationId)`; send via `appendMessage`; toggle mode via `toggleConversationStatus`. This is the main “conversation” experience; it is **not** under the agents route but under a top-level “Conversations” route (and not guarded by ModuleGuard).
- **How messages are fetched:** `services/customers.ts`: `listMessages(conversationId)` → `GET /convo/:id/messages?page=1&limit=50`. Conversations list: `listAllConversations()` → `GET /convo/` (with optional filters).
- **Agent configuration storage:** In **Zustand** (`lib/agent-store.ts`): `current` agent, `agents` list, `lastAgentId`. Persistence is via API (create/update/bind endpoints). No local-only config.

---

## 7. Refactor Risks (Adding Module Gating, Subscription, Upgrade)

1. **No shared layout for protected app**  
   Every protected page wraps itself with `<ProtectedShell>`. Adding a subscription check or upgrade banner in one place (e.g. layout) would require either a shared `(app)/layout.tsx` for all authenticated routes or wrapping at a single parent. Today that would be a broad change.

2. **ModuleGuard is page-level and duplicated**  
   Many pages wrap large blocks with `<ModuleGuard module="lms">` or `<ModuleGuard module="agents">`. If you add subscription-driven gating (e.g. “trial ended” or “upgrade to use this”), you’ll need either a new guard variant (e.g. `SubscriptionGuard`) or to extend ModuleGuard with subscription state. Duplication and inconsistent UX are likely if each page handles 403 or “not subscribed” differently.

3. **403 not handled globally**  
   Backend can return 403 for “module not subscribed” or “plan limit”. Today 403 is only handled in a couple of components. Adding upgrade modals or redirects will either require a global API layer (e.g. interceptor or wrapper that shows a modal and optionally redirects) or many local checks.

4. **Nav is hardcoded in AppShell**  
   Adding “Upgrade” or “Subscription” or hiding items by plan will mean changing `buildNavItems` and possibly passing more state (e.g. subscription status, entitlements). No central nav config makes it harder to drive nav from backend/entitlements.

5. **Conversations not guarded**  
   `/conversations` and `/conversations/[id]` do **not** use ModuleGuard. If Conversations should be part of a paid or LMS-gated surface, adding a guard (or redirect) is required; otherwise direct URL access remains.

6. **First business only**  
   Frontend uses `user?.businesses?.[0]` for `lms_enabled` and `agents_enabled`. Multi-business or “current business” switching would require a different source of truth and possibly subscription per business.

7. **No subscription or plan in auth state**  
   Auth store has no `subscription`, `plan`, or `entitlements`. When backend adds subscription/plan to the user or business response, the frontend will need to store and use it in guards, nav, and upgrade prompts.

8. **Disabled UI states**  
   There is no pattern for “feature visible but disabled” (e.g. greyed button + “Upgrade to enable”). ModuleGuard currently replaces content with a full “not enabled” message. Adding soft paywalls or disabled states will need new components and possibly a small design system addition.

---

## 8. Output Summary

### Full folder tree (frontend, source only; excludes `node_modules`, `.next`)

```
frontend/
├── app/
│   ├── agents/
│   │   ├── [agentId]/
│   │   │   ├── analytics/
│   │   │   ├── channels/
│   │   │   ├── follow-ups/
│   │   │   ├── knowledge-base/
│   │   │   ├── overview/
│   │   │   ├── test/
│   │   │   ├── tools/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── new/
│   │   ├── templates/
│   │   └── page.tsx
│   ├── analytics/
│   ├── auth/
│   │   └── accept-invite/
│   ├── catalog/
│   │   ├── [id]/
│   │   ├── new/
│   │   ├── stats/
│   │   └── templates/
│   ├── channels/
│   ├── conversations/
│   │   └── [conversationId]/
│   ├── customers/
│   │   └── [id]/
│   ├── dashboard/
│   ├── data-sheet/
│   │   ├── [modelId]/
│   │   │   ├── import/
│   │   │   ├── settings/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── new/
│   ├── deploy/
│   ├── employees/
│   │   └── [id]/
│   ├── lead-templates/
│   │   ├── [id]/
│   │   │   └── edit/
│   │   └── new/
│   ├── login/
│   ├── onboarding/
│   ├── orders/
│   ├── reports/
│   ├── settings/
│   ├── signup/
│   ├── storefront/
│   │   └── settings/
│   ├── verify-email/
│   ├── work/
│   │   ├── [id]/
│   │   └── templates/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── agents/
│   ├── app-shell.tsx
│   ├── auth-bootstrap.tsx
│   ├── auth-guard.tsx
│   ├── catalog/
│   ├── conversations/
│   ├── customers/
│   ├── dashboard/
│   ├── data-sheet/
│   ├── employees/
│   ├── integrations/
│   ├── module-guard.tsx
│   ├── orders-bookings/
│   ├── protected-shell.tsx
│   ├── reports/
│   ├── settings/
│   ├── theme-controller.tsx
│   └── work/
├── features/
│   └── data-sheet/
│       ├── api/
│       ├── components/
│       ├── context/
│       ├── mappers/
│       ├── routes/
│       ├── state/
│       ├── utils/
│       └── index.ts
├── lib/
│   ├── agent-store.ts
│   ├── api-client.ts
│   ├── auth-actions.ts
│   ├── auth-events.ts
│   ├── auth-store.ts
│   ├── catalog-api.ts
│   ├── catalog-store.ts
│   ├── customer-store.ts
│   ├── datasheet-tool-store.ts
│   ├── kb-store.ts
│   ├── post-auth-redirect.ts
│   ├── storefront-api.ts
│   ├── theme-store.ts
│   ├── tool-store.ts
│   ├── use-dashboard-stats.ts
│   ├── use-leads-activity.ts
│   └── use-reports-dashboard.ts
├── services/
│   ├── agents.ts
│   ├── analytics.ts
│   ├── appointments.ts
│   ├── channels.ts
│   ├── contacts.ts
│   ├── customers.ts
│   ├── dashboard.ts
│   ├── datasheet-tools.ts
│   ├── dynamic-data.ts
│   ├── employees.ts
│   ├── followups.ts
│   ├── knowledge-base.ts
│   ├── lead-templates.ts
│   ├── message-templates.ts
│   ├── orders.ts
│   ├── reports.ts
│   ├── settings.ts
│   ├── tools.ts
│   └── work.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── server.js
├── tsconfig.json
└── ...
```

### Architecture (short)

- **Next.js App Router** with per-page **ProtectedShell** (AuthGuard + AppShell). No route groups or shared auth layout.
- **Zustand** for auth, theme, agents, catalog, customer; **apiFetch** for all API calls with 401 refresh.
- **Sidebar** is built in AppShell from `lms_enabled` and `agents_enabled`; **ModuleGuard** used on many LMS and Agent pages but **not** on Conversations.
- **403** and subscription state are not handled globally; no subscription/plan in auth state.

### Risk areas

- Conversations route not module-guarded; direct URL access.
- No global 403 or subscription handling; upgrade flows would be ad hoc.
- Nav and module visibility are hardcoded in AppShell; adding subscription/plan will touch that file and possibly require a nav config.
- No shared authenticated layout; subscription banner or guard would need a structural change.
- First-business-only assumption for entitlements.

### Readiness score for modular SaaS: **4 / 10**

- **Strengths:** ModuleGuard exists; sidebar already hides by `lms_enabled`/`agents_enabled`; backend has entitlement service and business flags.
- **Gaps:** No subscription/plan in frontend state; no 403/upgrade handling; no shared layout for protected app; Conversations unguarded; nav not config-driven; no pattern for “disabled but visible” features.

### Suggested structural improvements before billing

1. **Introduce a shared layout for authenticated app**  
   Use a route group, e.g. `app/(protected)/layout.tsx`, that renders `ProtectedShell` once and wraps all authenticated routes (dashboard, catalog, agents, conversations, settings, etc.). Move subscription/entitlement checks or upgrade banner to this layout later.

2. **Centralize nav config**  
   Extract `buildNavItems` (or equivalent) into a small module (e.g. `lib/nav-config.ts` or `config/navigation.ts`) that takes `{ lmsEnabled, agentsEnabled, subscription?, entitlements? }` and returns nav structure. AppShell imports and uses it. Prepares for “Upgrade” links and plan-based visibility.

3. **Guard Conversations by module**  
   Wrap Conversations page (and conversation detail) with `ModuleGuard module="lms"` (or the appropriate module) so behavior matches sidebar and backend entitlement.

4. **Handle 403 in the API layer**  
   In `apiFetch` (or a thin wrapper), on 403 optionally parse a code/body (e.g. `module_required`, `subscription_required`), set a global store or event (e.g. “show upgrade modal”), and throw a typed error so callers can handle or ignore. Add a single “Upgrade” or “Permission denied” modal component used from that path.

5. **Add subscription/entitlement to auth state**  
   When backend returns subscription/plan/entitlements (e.g. on `/auth/users/me` or refresh), add to auth-store (e.g. `subscription`, `plan`, `entitlements`) and optionally a small `useEntitlements()` or `useSubscription()` hook. Use in ModuleGuard, nav config, and upgrade prompts.

6. **Document env and add .env.example**  
   Add `.env.example` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_FACEBOOK_APP_ID`. Document any future billing keys (e.g. Razorpay) and keep them out of client bundle if not needed on frontend.

7. **Optional: “disabled” feature pattern**  
   For soft paywalls, add a small pattern (e.g. `FeatureGate` component or wrapper) that can show either the feature or a disabled state with “Upgrade” CTA, so you can show Chat Agent (or others) as visible but locked without a full-page ModuleGuard.

---

*End of audit. No code was implemented; recommendations are structural and preparatory for billing and module gating.*
