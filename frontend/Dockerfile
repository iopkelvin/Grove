# Frontend container.
#
# Previously one comment line, so it could not build.
#
# Vite output is static files. Node is only needed to produce them, so the
# runtime image is nginx with the built assets and nothing else — no
# node_modules, no package manager, no JavaScript runtime at all.

# ── build ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# `npm ci` needs both, and copying them alone keeps the dependency layer
# cached across source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time, so they are build arguments rather than
# runtime environment variables. Changing them means rebuilding the image —
# which is inherent to how a static bundle works, not a choice made here.
ARG VITE_API_URL=""
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ── runtime ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
