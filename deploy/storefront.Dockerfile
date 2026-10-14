# Next.js website. Built by GitHub Actions (.github/workflows/images.yml) for one server:
# the build needs that server's addresses and publishable key, and fetches the catalogue
# from its backend to pre-build product pages.
# Context: storefront/

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN corepack enable && yarn install --immutable
COPY . .
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_DEFAULT_REGION=in
ARG MEDUSA_BACKEND_URL
ARG IMAGE_HOSTS
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION \
    MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL \
    IMAGE_HOSTS=$IMAGE_HOSTS \
    ALLOW_LOCALHOST_IMAGES=false \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN yarn build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8000 HOSTNAME=0.0.0.0
WORKDIR /app
# output: "standalone" (next.config.js): the server and only the files it needs
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 8000
CMD ["node", "server.js"]
