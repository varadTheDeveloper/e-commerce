#!/bin/sh
# Docker start: apply database migrations, then start Medusa (see deploy/backend.Dockerfile).
# Medusa is called directly, not through npx, which would keep a second ~70 MB process alive.
set -e
./node_modules/.bin/medusa db:migrate
exec ./node_modules/.bin/medusa start
