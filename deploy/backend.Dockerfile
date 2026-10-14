# Medusa backend (API, staff admin and background jobs in one process: MEDUSA_WORKER_MODE=shared).
# Built by GitHub Actions (.github/workflows/images.yml): the 1 GB server cannot build it.
# Context: backend/

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN corepack enable && yarn install --immutable
COPY . .
# medusa build: compiles the server and the admin panel into .medusa/server
RUN yarn build
# Production dependencies only, inside the built server folder
RUN cp .yarnrc.yml .medusa/server/ && cp -r .yarn .medusa/server/ \
 && cd .medusa/server && yarn workspaces focus --production \
 && rm -rf .yarn/cache .yarn/install-state.gz

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/.medusa/server ./
COPY --chown=node:node deploy-start.sh /usr/local/bin/start-backend
# Uploaded files when S3 is not used (a Docker volume on the server)
RUN mkdir -p /app/static && chown node:node /app/static && chmod +x /usr/local/bin/start-backend
USER node
EXPOSE 9000
CMD ["start-backend"]
