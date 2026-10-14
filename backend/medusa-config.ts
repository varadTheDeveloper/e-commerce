import { ContainerRegistrationKeys, defineConfig, loadEnv, Modules } from '@medusajs/framework/utils'
import { SHOP } from './src/config/shop'
import { otpConfig } from './src/lib/otp-config'

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
if (isProduction && !['msg91', 'messagecentral'].includes(process.env.SMS_PROVIDER ?? '')) {
  throw new Error('SMS_PROVIDER must be "msg91" or "messagecentral" in production (the console provider only logs codes)')
}
if (isProduction && process.env.SMS_PROVIDER === 'messagecentral') {
  if (!process.env.MESSAGECENTRAL_CUSTOMER_ID || !process.env.MESSAGECENTRAL_PASSWORD) {
    throw new Error('MESSAGECENTRAL_CUSTOMER_ID and MESSAGECENTRAL_PASSWORD must be set in production')
  }
  if (process.env.MESSAGECENTRAL_BASE_URL) {
    throw new Error('MESSAGECENTRAL_BASE_URL is for tests only; leave it empty in production')
  }
}

// Online payments (Razorpay): see docs/SETUP-PAYMENTS.md
if (isProduction) {
  for (const name of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const) {
    if (!process.env[name]) {
      throw new Error(`${name} must be set in production`)
    }
  }
  if (process.env.RAZORPAY_API_BASE) {
    throw new Error('RAZORPAY_API_BASE is for tests only; leave it empty in production')
  }
}

// Delivery (Shiprocket): see docs/SETUP-SHIPPING.md
if (isProduction) {
  for (const name of ['SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD', 'SHIPROCKET_WEBHOOK_TOKEN'] as const) {
    if (!process.env[name]) {
      throw new Error(`${name} must be set in production`)
    }
  }
  if (process.env.SHIPROCKET_API_BASE) {
    throw new Error('SHIPROCKET_API_BASE is for tests only; leave it empty in production')
  }
}

// Order emails (Resend) and update SMS (Message Central): see docs/SETUP-SHIPPING.md
if (isProduction) {
  for (const name of ['RESEND_API_KEY', 'EMAIL_FROM', 'STOREFRONT_URL'] as const) {
    if (!process.env[name]) {
      throw new Error(`${name} must be set in production`)
    }
  }
  if (process.env.RESEND_API_BASE) {
    throw new Error('RESEND_API_BASE is for tests only; leave it empty in production')
  }
}

// Uploaded files: S3 needs the bucket's public address too
if (process.env.S3_BUCKET && !process.env.S3_FILE_URL) {
  throw new Error('S3_FILE_URL must be set with S3_BUCKET (e.g. https://<bucket>.s3.ap-south-1.amazonaws.com)')
}
if (isProduction && !process.env.S3_BUCKET && !process.env.FILE_BASE_URL) {
  throw new Error('Set S3_BUCKET (S3) or FILE_BASE_URL (server disk) in production, or uploaded photos get localhost addresses')
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
    // Saved products per customer (src/modules/wishlist)
    { resolve: './src/modules/wishlist' },
    // Customer return and size-exchange requests (src/modules/returns)
    { resolve: './src/modules/returns' },
    {
      resolve: '@medusajs/medusa/auth',
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          { resolve: '@medusajs/medusa/auth-emailpass', id: 'emailpass' },
          {
            resolve: './src/modules/phone-otp-auth',
            id: 'phone-otp',
            options: { secret: otpConfig().secret },
          },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/fulfillment',
      options: {
        providers: [
          // Manual stays for returns until Step 6
          { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
          { resolve: './src/modules/shiprocket', id: 'shiprocket' },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: './src/modules/razorpay',
            id: 'razorpay',
            options: {
              keyId: process.env.RAZORPAY_KEY_ID,
              keySecret: process.env.RAZORPAY_KEY_SECRET,
              webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
              apiBaseUrl: process.env.RAZORPAY_API_BASE,
            },
          },
          {
            resolve: './src/modules/cod',
            id: 'cod',
            options: {
              secret: otpConfig().secret,
              maxOrder: SHOP.codMaxOrder,
            },
          },
        ],
      },
    },
    {
      // Uploaded files (return photos, product images added in the admin). With S3_BUCKET set
      // they go to S3, using the server's IAM role (no access keys in files); otherwise to the
      // server's disk under static/, served by the backend at FILE_BASE_URL.
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          process.env.S3_BUCKET
            ? {
                resolve: '@medusajs/medusa/file-s3',
                id: 's3',
                options: {
                  authentication_method: 's3-iam-role',
                  bucket: process.env.S3_BUCKET,
                  region: process.env.S3_REGION || 'ap-south-1',
                  file_url: process.env.S3_FILE_URL,
                  // Buckets with "Object Ownership: bucket owner enforced" refuse ACLs;
                  // public reading is set by the bucket policy instead (docs/EC2-SETUP.md)
                  acl: false,
                },
              }
            : {
                resolve: '@medusajs/medusa/file-local',
                id: 'local',
                options: { backend_url: process.env.FILE_BASE_URL || 'http://localhost:9000/static' },
              },
        ],
      },
    },
    ...redisModules,
  ],
})
