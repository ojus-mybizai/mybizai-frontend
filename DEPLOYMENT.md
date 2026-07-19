# MyBizAI Frontend — Deployment

Deployed to **Azure Container Apps** app `mybizai-frontend` (external :3000,
region centralindia) as a Next.js 16 `output: "standalone"` image. CI/CD is
GitHub Actions + OIDC — see `.github/workflows/deploy-frontend.yml`.

Full system doc lives in the backend repo (`ojus-mybizai/mybizai_backend` →
`DEPLOYMENT.md`).

## Pipeline
On every push to `main` (and `workflow_dispatch`):
1. `azure/login` (OIDC).
2. `az acr build` → `mybizai-frontend:<sha>` with the `NEXT_PUBLIC_*` **build-args**
   (public client-bundle constants, defined in the workflow `env:` block — edit
   them there):
   - `NEXT_PUBLIC_API_URL=https://api.mybizai.in/api/v1`
   - `NEXT_PUBLIC_WS_URL=wss://api.mybizai.in/ws`
   - `NEXT_PUBLIC_FACEBOOK_APP_ID=781370637627825`
   - `NEXT_PUBLIC_WHATSAPP_CONFIG_ID=1283159033784294`
   - `NEXT_PUBLIC_STREAM_INTERNAL_CHAT=1`
3. Roll `mybizai-frontend` to `<sha>` (rolling revision → zero downtime).
4. Health-check `https://app.mybizai.in`; print the new revision.

## Required GitHub Actions secrets (this repo)
| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | `c0632281-d592-4aea-b1ce-93bcb4a3478b` |
| `AZURE_TENANT_ID` | `a7166c3d-56d0-4169-906a-4ec127338848` |
| `AZURE_SUBSCRIPTION_ID` | `56699d76-30fa-41d5-9fba-b83d5c0a2539` |

Set these before the first push, or `azure/login` fails.

## First push
```bash
cd D:/111/mybizai_current_version/mybizai-frontend
git add -A
git commit -m "CI/CD: Azure Container Apps deploy workflow"
git push origin main
```

## Rollback
```
az containerapp update -g mybizai_resource -n mybizai-frontend \
  --image mybizaiacr01.azurecr.io/mybizai-frontend:<previous-sha>
```

## Manual fallback
`az acr build` crashes locally on Windows (colorama) but the remote build still
succeeds — verify via `az acr repository show-tags -n mybizaiacr01 --repository mybizai-frontend`.
```
SHA=$(git rev-parse HEAD)
az acr build --registry mybizaiacr01 --image mybizai-frontend:$SHA --file Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.mybizai.in/api/v1 \
  --build-arg NEXT_PUBLIC_WS_URL=wss://api.mybizai.in/ws \
  --build-arg NEXT_PUBLIC_FACEBOOK_APP_ID=781370637627825 \
  --build-arg NEXT_PUBLIC_WHATSAPP_CONFIG_ID=1283159033784294 \
  --build-arg NEXT_PUBLIC_STREAM_INTERNAL_CHAT=1 \
  .
az containerapp update -g mybizai_resource -n mybizai-frontend --image mybizaiacr01.azurecr.io/mybizai-frontend:$SHA
```
