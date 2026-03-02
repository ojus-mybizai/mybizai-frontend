# Frontend Structural Audit — MyBizAI

**Scope:** Route topology, layout hierarchy, state, navigation, API layer, module gating, and subscription UX readiness.  
**No refactoring or recommendations** — analysis and reporting only.

---

## 1. Route Topology

### Routes grouped by domain

| Domain | Routes | Protected | ModuleGuard | Public |
|--------|--------|-----------|-------------|--------|
| **Core OS** | `/` (home) | No | — | Yes |
| **Auth (public)** | `/login`, `/signup`, `/verify-email`, `/auth/accept-invite` | No | — | Yes |
| **Core (post-auth)** | `/onboarding` | AuthGuard only (no shell) | — | No |
| **Dashboard** | `/dashboard` | ProtectedShell | No | No |
| **Core OS features** | `/catalog`, `/catalog/[id]`, `/catalog/new`, `/catalog/templates`, `/catalog/stats` | ProtectedShell | No | No |
| | `/orders` | ProtectedShell | No | No |
| | `/reports` | ProtectedShell | No | No |
| | `/settings` | ProtectedShell | No | No |
| **AI Agent features** | `/agents`, `/agents/new`, `/agents/templates` | ProtectedShell | `agents` | No |
| | `/agents/[agentId]`, `/agents/[agentId]/overview`, `/agents/[agentId]/channels`, `/agents/[agentId]/tools`, `/agents/[agentId]/follow-ups`, `/agents/[agentId]/knowledge-base`, `/agents/[agentId]/analytics`, `/agents/[agentId]/test` | ProtectedShell (via layout) | `agents` (via layout) | No |
| | `/deploy` | ProtectedShell | `agents` | No |
| | `/lead-templates`, `/lead-templates/new`, `/lead-templates/[id]/edit` | ProtectedShell | `agents` | No |
| | `/analytics` (agent analytics) | ProtectedShell | `agents` | No |
| **Conversations** | `/conversations`, `/conversations/[conversationId]` | ProtectedShell | **No** | No |
| **Channels** | `/channels` | ProtectedShell | `lms` | No |
| **CRM / LMS** | `/customers`, `/customers/[id]` | ProtectedShell | `lms` | No |
| | `/work`, `/work/[id]`, `/work/templates` | ProtectedShell | `lms` | No |
| | `/employees`, `/employees/[id]` | ProtectedShell | `lms` | No |
| | `/data-sheet`, `/data-sheet/new`, `/data-sheet/[modelId]`, `/data-sheet/[modelId]/settings`, `/data-sheet/[modelId]/import` | ProtectedShell | `lms` | No |
| **Storefront** | `/storefront/settings` | ProtectedShell | **No** | No |

### Protection summary

- **Protected:** Every route under Dashboard, Catalog, Orders, Reports, Settings, Agents, Conversations, Channels, Customers, Work, Employees, Data-sheet, Storefront. Each wraps its content in `<ProtectedShell>` (or inherits from a layout that does). `ProtectedShell` = `AuthGuard` → `AppShell`.
- **ModuleGuard usage:** Applied only where explicitly wrapped:
  - **`module="agents"`:** All `/agents/*`, `/deploy`, `/lead-templates/*`, `/analytics` (agent analytics), and `agents/[agentId]/layout.tsx` (so all agent sub-routes).
  - **`module="lms"`:** `/customers`, `/channels`, `/work`, `/employees`, `/data-sheet` (and data-sheet sub-routes). **Not** applied to `/conversations` or `/conversations/[conversationId]`.
- **Public:** `/`, `/login`, `/signup`, `/verify-email`, `/auth/accept-invite`. No AuthGuard, no shell.
- **Auth only (no AppShell):** `/onboarding` uses `AuthGuard` and redirects when not onboarded; no `ProtectedShell`, so no sidebar/AppShell.

---

## 2. Layout Hierarchy

### Root layout structure

- **`app/layout.tsx` (root):**  
  `html` → `body` (theme class) → `ThemeController` → `AuthBootstrap` → `{children}`.  
  No route-specific layout; no shared authenticated layout at the app level.

### ProtectedShell usage

- **Definition:** `components/protected-shell.tsx` composes `AuthGuard` → `AppShell` → `{children}`. Both guards are client components; `AppShell` is dynamically imported.
- **Usage:** Per-page (or per-segment layout). There is no single `(protected)/layout.tsx`; each protected page (or layout like `agents/[agentId]/layout.tsx`) wraps its content in `<ProtectedShell>`.

### AuthGuard usage

- **Definition:** `components/auth-guard.tsx` reads `accessToken` and `isInitialized` from `auth-store`. When initialized and no token → redirect to `/login?next=...`. When `onboardingRequired` and path ≠ `/onboarding` → redirect to `/onboarding`.
- **Used in:** (1) `ProtectedShell` (so every shell-protected route), (2) `app/onboarding/page.tsx` alone (AuthGuard only, no AppShell).

### Where AppShell lives

- **Definition:** `components/app-shell.tsx`. Renders: fixed sidebar (nav + logout), top bar (title, theme toggle, user), and main content area. Nav items are built by `buildNavItems(lmsEnabled, agentsEnabled)` from `auth-store` user.
- **Usage:** Only inside `ProtectedShell`. So AppShell is used for every route that uses `ProtectedShell`; there is no other shell.

### Shared authenticated layout

- **There is no shared authenticated layout.** No `app/(protected)/layout.tsx` or similar. Protection and shell are repeated per page (or per segment via `agents/[agentId]/layout.tsx` and data-sheet feature layout). Other segments (e.g. dashboard, settings, catalog) each wrap their page content in `ProtectedShell` locally.

### Layout tree (simplified)

```
RootLayout (app/layout.tsx)
├── ThemeController
└── AuthBootstrap
    └── children (route segment)

Route segments:
├── / (home) ................................. no guard, no shell
├── /login, /signup, /verify-email, /auth/accept-invite ... no guard, no shell
├── /onboarding ............................. AuthGuard → content (no AppShell)
└── Protected pages ......................... each wraps with:
    ProtectedShell
    ├── AuthGuard
    └── AppShell
        ├── Sidebar (nav from buildNavItems)
        ├── Header
        └── main → {children}

agents/[agentId] segment:
    AgentLayout (layout.tsx)
    └── ProtectedShell → ModuleGuard(agents) → nav + tabs → {children}
```

---

## 3. State Architecture

### Zustand stores

| Store | Location | Owns |
|-------|----------|------|
| **auth-store** | `lib/auth-store.ts` | `accessToken`, `user`, `onboardingRequired`, `defaultBusinessId`, `defaultRole`, `hasActiveBusinessAccess`, `isInitialized`; setters; `logout`. Token persisted to sessionStorage. |
| **agent-store** | `lib/agent-store.ts` | `agents`, `current`, `loading`, `error`, `lastAgentId`; list/select/create/update/remove/setStatus/saveChannels/saveTools/saveKB. |
| **catalog-store** | `lib/catalog-store.ts` | Catalog items, pagination, current item, templates, categories, stats, bestSold, itemInsights; CRUD and loaders. |
| **customer-store** | `lib/customer-store.ts` | Customers list, current customer, conversations, messages, lead stats; list/select/loadConversations/loadMessages/sendMessage/toggleMode, lead CRUD. |
| **theme-store** | `lib/theme-store.ts` | `theme` (light/dark), `setTheme`, `toggleTheme`. Hydrated and persisted by ThemeController via localStorage. |
| **kb-store** | `lib/kb-store.ts` | Knowledge bases list, current, loading, actionLoading, error; list/select/createText/uploadFile/update/delete. |
| **tool-store** | `lib/tool-store.ts` | Tools list, current, loading, error; list/select/add/update. |
| **datasheet-tool-store** | `lib/datasheet-tool-store.ts` | Data-sheet tools list, loading, error; list/get/create/update/remove. |

### Subscription state

- **None.** No store or slice for subscription, plan, entitlements, or billing. Module visibility is derived from `user?.businesses?.[0]?.agents_enabled` and `user?.businesses?.[0]?.lms_enabled` in auth-store (and in ModuleGuard / AppShell nav). There is no dedicated subscription or “product” state.

### Module state

- **Not first-class.** Module enablement is read from the first business on the user object (`business?.agents_enabled`, `business?.lms_enabled`). No dedicated module/entitlement store; no list of “enabled modules” or module metadata in state.

### Business switching

- **None.** UI and stores assume a single business: `user?.businesses?.[0]`. No business switcher, no `currentBusinessId` in auth-store (only `defaultBusinessId` is set from auth/refresh). All module and nav logic uses the first business only.

---

## 4. Navigation System

### How sidebar is generated

- **Source:** `app-shell.tsx`, function `buildNavItems(lmsEnabled, agentsEnabled)`. Returns a flat array of entries: section labels (`{ kind: 'section', label }`) and nav items (`{ label, href, short, children? }`). No config file; structure is hardcoded in `buildNavItems`.
- **Sections:** “Foundation” (Dashboard, Catalog & Stock, Orders & Bookings, Reports, Settings); conditionally “LMS” items (Customers, Conversations, Channels, Work & Tasks, Employees) when `lmsEnabled`; “Purchased Modules” (Storefront); then Business Agents tree when `agentsEnabled` (All Agents, New Agent, Last Opened Agent, Lead Templates, Agent Analytics, Message Templates).

### lms_enabled / agents_enabled and visibility

- **Source of truth:** `user?.businesses?.[0]` from auth-store. `lmsEnabled = business?.lms_enabled !== false`, `agentsEnabled = business?.agents_enabled !== false`. So default-to-true if missing.
- **Effect:** When false, LMS block or Business Agents block is omitted from the sidebar. No “disabled but visible” state; items are hidden.

### Config-driven nav

- **No.** Nav shape and labels are hardcoded in `buildNavItems`. There is no JSON/config or CMS-driven nav. Adding a new module or subscription tier would require code changes in `app-shell.tsx`.

### Ease of subscription-based visibility

- **Moderate.** Today visibility is boolean per “module” (LMS vs Agents). To add subscription-based visibility you would: (1) extend user/business payload to include plan or feature flags, (2) change `buildNavItems` to take those flags and show/hide or downgrade items. No abstraction (e.g. “nav config + feature flags”) exists yet, so any new tier or product would be wired by hand in this function.

---

## 5. API Layer Behavior

### How apiFetch works

- **File:** `lib/api-client.ts`. Builds URL from `API_BASE_URL` + path; sets `Content-Type: application/json` when body is not FormData; when `auth !== false`, adds `Authorization: Bearer <token>` from auth-store. Uses `credentials: 'include'`. On non-OK response, builds error via `buildError(response)` and throws it (status and message/detail on the thrown error).

### 401 handling

- **Centralized.** If response is 401 and request is authenticated and path is not an auth path (login, refresh, etc.), apiFetch does not throw immediately. It runs a single in-flight `refreshAccessToken()` (shared promise), then retries the request once with the new token. If refresh fails, auth-store is logged out and auth events broadcast; then the original 401 is thrown via `buildError(response)`. So 401 triggers token refresh and one retry; no global UI modal.

### 403 handling

- **No central handling.** 403 is treated like any other error: `buildError` builds an `ApiError` with status and message, and apiFetch throws. Callers must catch and interpret. Login page handles 403 for employee deactivated; knowledge-base tab formats 403 as “Permission denied”. There is no global 403 interceptor or redirect to upgrade/billing.

### Global error handling

- **None.** No global error boundary or API interceptor that catches all apiFetch errors and shows a toast/modal or redirect. Each page or component catches and displays errors locally.

### Centralized upgrade flow

- **Not present.** No shared “upgrade” or “subscription required” flow. ModuleGuard shows a fixed message and “Back to Dashboard”; it does not redirect to a billing or upgrade page. 403 from the API is not mapped to a central upgrade CTA.

---

## 6. Module Gating Mechanism

### How ModuleGuard works

- **Component:** `components/module-guard.tsx`. Reads `user` from auth-store, takes `business = user?.businesses?.[0]`. For `module === 'agents'` uses `agentsEnabled = business?.agents_enabled !== false`; for `module === 'lms'` uses `lmsEnabled = business?.lms_enabled !== false`. If the required flag is true, renders children; otherwise renders a locked-state UI (icon, “X is not enabled”, copy, “Back to Dashboard” link). No API check; purely client-side from user payload.

### Where it is used

- **Agents:** All of `/agents` (list, new, templates), `agents/[agentId]/layout.tsx` (so overview, channels, tools, follow-ups, knowledge-base, analytics, test), `/deploy`, `/lead-templates` (list, new, [id]/edit), `/analytics` (agent analytics).
- **LMS:** `/customers`, `/customers/[id]`, `/channels`, `/work`, `/work/[id]`, `/work/templates`, `/employees`, `/employees/[id]`, `/data-sheet`, `/data-sheet/new` (and data-sheet sub-routes use the same pattern via their pages/layout).

### Where it is missing

- **Conversations:** `/conversations` and `/conversations/[conversationId]` use ProtectedShell only. No ModuleGuard. Backend convo routes use `require_lms`; frontend does not gate these routes by LMS.
- **Storefront:** `/storefront/settings` uses ProtectedShell only. No ModuleGuard. No “storefront module” flag in the nav or guard.
- **Dashboard:** No ModuleGuard; dashboard is core. Some dashboard stats (e.g. lead stats) are skipped when LMS is disabled (via `useDashboardStats({ lmsEnabled })`), but the route itself is not gated.

### Backend vs frontend gating alignment

- **Backend:** Uses `require_lms` (convo, channels, work, employees, leads, dynamic_data), `require_agents` (chat_agents, analytics, tools, knowledge_base, message_templates, lead_templates, datasheet_tools, chat_agent_integrations, dashboard). Followups use `get_current_business` (no module requirement).
- **Frontend:** ModuleGuard only knows two modules: `agents` and `lms`. Conversations are LMS in backend but not wrapped in ModuleGuard on frontend. Storefront has no backend module dependency in this audit. Otherwise, agents routes are gated on both sides; LMS routes are mostly gated on both sides except conversations.

---

## 7. UX Readiness for Subscription

### Where subscription page could live

- **No subscription or billing route exists.** A natural place would be under `/settings` (e.g. “Billing” or “Subscription” tab) or a dedicated `/settings/billing` or `/subscription`. Settings today has profile, workspace, business, roles, knowledge_base, notifications — no billing/subscription.

### Where upgrade CTA could live

- **ModuleGuard:** Today it shows “Contact your reseller” and “Back to Dashboard”. An upgrade CTA could replace or supplement that (e.g. “Upgrade” → billing or plan page).
- **Nav:** When a module is disabled, its items are hidden; there is no “Upgrade to see X” in the sidebar. Upgrade could be a sidebar entry or a banner when a user hits a gated area.
- **403 from API:** No shared handling. A global 403 handler could show a modal or redirect to upgrade/billing.

### Disabled-state pattern

- **Partial.** ModuleGuard shows a full-page “not enabled” state. Dashboard uses `useDashboardStats({ lmsEnabled })` and shows “Enable LMS to see lead metrics” when LMS is disabled. There is no reusable “feature disabled for your plan” component or consistent pattern (e.g. greyed-out nav item with tooltip, or inline upgrade CTA). Disabled states are mostly for loading or form validation (e.g. “Pause agent to save”), not for subscription/entitlement.

### Where billing entry point should be added

- **Not present.** No billing or subscription entry in nav, settings, or ModuleGuard. To add one: (1) add a Billing/Subscription tab or page under settings or a top-level route, (2) optionally add a nav item or banner that links there when module is disabled or plan is limited.

---

## 8. Output Summary

### Route Map

- **Public:** `/`, `/login`, `/signup`, `/verify-email`, `/auth/accept-invite`.
- **Auth only (no shell):** `/onboarding`.
- **Protected (ProtectedShell):** All of dashboard, catalog, orders, reports, settings, agents, conversations, channels, customers, work, employees, data-sheet, storefront.
- **ModuleGuard(agents):** All agent routes, deploy, lead-templates, analytics (agent).
- **ModuleGuard(lms):** customers, channels, work, employees, data-sheet. **Not** conversations.

### Layout Map

- **Root:** ThemeController → AuthBootstrap → children. No shared protected layout.
- **ProtectedShell:** AuthGuard → AppShell → children; used per page or per segment.
- **AppShell:** Sidebar (buildNavItems) + header + main. Only inside ProtectedShell.
- **Onboarding:** AuthGuard only.

### State Map

- **Stores:** auth, agent, catalog, customer, theme, kb, tool, datasheet-tool. No subscription or module store; no business switcher.
- **Module/subscription:** Derived from `user.businesses[0].agents_enabled` / `lms_enabled` only.

### Nav Map

- **Source:** Hardcoded in `buildNavItems(lmsEnabled, agentsEnabled)` in app-shell.
- **Visibility:** LMS block and Agents block shown/hidden by flags. Not config-driven; not subscription-tier aware.

### Gating Map

- **ModuleGuard:** Two modules (`agents`, `lms`). Used on agents and LMS routes except conversations and storefront.
- **Backend:** require_lms / require_agents (or require_module) on corresponding routers. Conversations: backend require_lms, frontend no ModuleGuard.

### Weak Points

1. **No shared protected layout** — every protected route (or segment) opts in to ProtectedShell; easy to add a new page and forget the shell or guard.
2. **Conversations not gated** — backend requires LMS; frontend does not wrap conversations in ModuleGuard.
3. **Storefront not gated** — no module flag or guard; unclear if it should be a purchasable module.
4. **No subscription/plan state** — only two booleans (lms_enabled, agents_enabled); no plan, limits, or billing state.
5. **No business switching** — single business (first in list); multi-business not supported in UI or state.
6. **403 not centralized** — no global upgrade or “permission denied” flow; callers handle 403 ad hoc.
7. **Nav not config-driven** — adding a new module or tier requires editing app-shell and possibly auth payload.
8. **No billing/subscription entry** — no route or nav item for upgrade or billing.

### Subscription Readiness Score: **3 / 10**

- **Rationale:** Module visibility is driven by two booleans and ModuleGuard exists for two modules, so a minimal “feature on/off” model is in place. However: no subscription or plan state; no billing or upgrade routes; no centralized 403 → upgrade flow; nav is hardcoded and not tier-aware; conversations are not gated on the frontend; and there is no consistent “disabled for your plan” or upgrade CTA pattern. Ready for “reseller toggles a flag” only; not ready for self-serve plans, limits, or billing UX.

---

*End of audit. No implementation changes.*
