# MyBizAI frontend — Next.js 16 (App Router), output: "standalone".
#
# NOTE: The repo's root server.js forces HTTPS with local .pem certs and is for
# local dev only. In production, Azure Container Apps terminates TLS at the
# ingress, so we run Next's generated standalone server (plain HTTP on $PORT)
# and never copy the custom server.js into the image.
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# MUST be passed as --build-arg (NOT as runtime Container App env vars).

# ---------- build stage ----------
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_FACEBOOK_APP_ID
ARG NEXT_PUBLIC_WHATSAPP_CONFIG_ID
ARG NEXT_PUBLIC_STREAM_INTERNAL_CHAT
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_FACEBOOK_APP_ID=$NEXT_PUBLIC_FACEBOOK_APP_ID \
    NEXT_PUBLIC_WHATSAPP_CONFIG_ID=$NEXT_PUBLIC_WHATSAPP_CONFIG_ID \
    NEXT_PUBLIC_STREAM_INTERNAL_CHAT=$NEXT_PUBLIC_STREAM_INTERNAL_CHAT \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- runtime stage ----------
FROM node:20-slim AS run
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Standalone output bundles a minimal server.js + traced node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
