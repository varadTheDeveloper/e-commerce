# Clothing store

An online clothing store for India, in Marathi, Hindi and English. Open source under the GPL-3.0 (see `LICENSE`).
The brand name is a placeholder until the client confirms it.

```
backend/      Medusa v2 server + admin panel (TypeScript, Postgres, Redis)   http://localhost:9000  (admin: /app)
storefront/   Next.js shop                                                   http://localhost:8000
```

Both started from Medusa's MIT-licensed starters; see `CREDITS.md`.

## Run it locally

Needs Node 20+ (22 recommended), Docker, and Yarn (`corepack enable` once).

```
docker compose up -d                        # Postgres 16 + Redis 7

cd backend
copy .env.template .env                     # Windows (macOS/Linux: cp)
yarn install
npx medusa db:migrate
yarn seed                                   # sample products, India region, ₹ prices
npx medusa user -e you@example.com -p <password>   # first admin user
yarn dev                                    # http://localhost:9000/app

cd ../storefront
copy .env.template .env.local
# Put the publishable key in NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:
#   admin panel -> Settings -> Publishable API Keys
yarn install
yarn dev                                    # http://localhost:8000
```

## Checks (also run on GitHub for every push and pull request)

```
cd backend;    yarn build; yarn typecheck; yarn test:integration:http
cd storefront; yarn typecheck; yarn build   # build needs the backend running
```

The backend tests create and drop their own database. They read `DB_HOST`, `DB_USERNAME` and `DB_PASSWORD`.

## Secrets

Keys live only in `.env` / `.env.local` files (git-ignored) and in AWS Secrets Manager in production.
In production the server refuses to start without real `JWT_SECRET`, `COOKIE_SECRET` and `REDIS_URL`.
