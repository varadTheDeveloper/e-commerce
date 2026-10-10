import { ContainerRegistrationKeys, defineConfig, loadEnv, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const isProduction = process.env.NODE_ENV === 'production'
const redisUrl = process.env.REDIS_URL

// In production, refuse to start with missing or placeholder secrets.
function secret(name: 'JWT_SECRET' | 'COOKIE_SECRET'): string {
  const value = process.env[name]
  if (isProduction && (!value || value === 'supersecret' || value.length < 32)) {
    throw new Error(`${name} must be set to a random value of at least 32 characters in production`)
  }
  return value || 'supersecret'
}

if (isProduction && !redisUrl) {
  throw new Error('REDIS_URL must be set in production')
}

// Login codes (phone OTP): see src/lib/otp-config.ts and docs/SETUP-SMS.md
if (isProduction && (process.env.OTP_SECRET ?? '').length < 32) {
  throw new Error('OTP_SECRET must be set to a random value of at least 32 characters in production')
}
if (isProduction && process.env.SMS_PROVIDER !== 'msg91') {
  throw new Error('SMS_PROVIDER must be "msg91" in production (the console provider only logs codes)')
}

// With REDIS_URL set, events, workflows and locks go through Redis
// (needed when the server and worker run as separate processes).
// Without it (local development), Medusa uses its in-memory defaults.
const redisModules = redisUrl
  ? [
      {
        resolve: '@medusajs/medusa/event-bus-redis',
        options: { redisUrl },
      },
      {
        resolve: '@medusajs/medusa/workflow-engine-redis',
        options: { redis: { redisUrl } },
      },
      {
        resolve: '@medusajs/medusa/locking',
        options: {
          providers: [
            {
              resolve: '@medusajs/medusa/locking-redis',
              id: 'locking-redis',
              is_default: true,
              options: { redisUrl },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    workerMode: process.env.MEDUSA_WORKER_MODE as 'shared' | 'worker' | 'server' | undefined,
    http: {
      // Staff log in to the admin with email + password; customers with a phone code.
      authMethodsPerActor: {
        user: ['emailpass'],
        customer: ['phone-otp'],
      },
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: secret('JWT_SECRET'),
      cookieSecret: secret('COOKIE_SECRET'),
    },
  },
  featureFlags: {
    // Product, category and collection text in Marathi, Hindi and English
    translation: true,
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
  },
  modules: [
    // Listed explicitly: the feature flag above is read too late to enable it.
    { resolve: '@medusajs/medusa/translation' },
    {
      resolve: '@medusajs/medusa/auth',
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          { resolve: '@medusajs/medusa/auth-emailpass', id: 'emailpass' },
          {
            resolve: './src/modules/phone-otp-auth',
            id: 'phone-otp',
            options: { secret: process.env.OTP_SECRET || 'dev-only-otp-secret-change-me-0000' },
          },
        ],
      },
    },
    ...redisModules,
  ],
})
