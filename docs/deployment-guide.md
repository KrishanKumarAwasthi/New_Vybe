# Vybe — Production Deployment Guide

> **Stack**: Frontend on **Vercel** · Backend (6 services) on **Render** · Kafka on **Confluent Cloud** · Redis on **Upstash** · MongoDB on **Atlas**

---

## Architecture Overview (Production)

```
                    ┌──────────────────────────┐
                    │    Vercel (Frontend)      │
                    │    React 19 SPA           │
                    │  VITE_SERVER_URL → Render │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │    Render (API Gateway)   │
                    │    Web Service :8000      │
                    └──┬────┬────┬────┬────┬───┘
                       │    │    │    │    │
         ┌─────────────┤    │    │    │    ├─────────────┐
         ▼             ▼    │    ▼    ▼              ▼
   ┌──────────┐  ┌──────────┤  ┌──────────┐  ┌──────────────┐
   │  Auth    │  │  User    │  │ Content  │  │ Notification │
   │  Service │  │  Service │  │ Service  │  │  Service     │
   │ (Render) │  │ (Render) │  │ (Render) │  │  (Render)    │
   └──────────┘  └──────────┘  └──────────┘  └──────────────┘
                       │    │
                       ▼    ▼
                 ┌──────────────┐
                 │  Messaging   │
                 │   Service    │
                 │  (Render)    │
                 └──────────────┘

    ┌────────────────────────────────────────────────────┐
    │              Managed Infrastructure                 │
    │                                                    │
    │  ┌─────────────┐  ┌──────────┐  ┌──────────────┐  │
    │  │ MongoDB     │  │ Upstash  │  │  Confluent   │  │
    │  │ Atlas       │  │ Redis    │  │  Cloud Kafka │  │
    │  │ (Database)  │  │ (Cache)  │  │  (Events)    │  │
    │  └─────────────┘  └──────────┘  └──────────────┘  │
    └────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before starting, make sure you have:
- [ ] GitHub account with the `new_vybe` repo pushed
- [ ] Accounts on: [MongoDB Atlas](https://cloud.mongodb.com), [Upstash](https://upstash.com), [Confluent Cloud](https://confluent.cloud), [Render](https://render.com), [Vercel](https://vercel.com), [Cloudinary](https://cloudinary.com)
- [ ] A Gmail account with [App Password](https://myaccount.google.com/apppasswords) generated (for Nodemailer)

---

## Step 1: MongoDB Atlas Setup

### 1.1 Create a Free Cluster

1. Go to [MongoDB Atlas](https://cloud.mongodb.com) → **Create a Project** → name it `vybe`
2. Click **Build a Cluster** → Select **M0 Free Tier** → Choose region closest to your Render services (e.g., **US East**)
3. Click **Create Deployment**

### 1.2 Create Database User

1. Go to **Database Access** → **Add New Database User**
2. Set authentication method: **Password**
3. Username: `vybe-admin` (or any name)
4. Password: Generate a secure password — **save it**, you'll need it
5. Role: **Atlas Admin** (or at minimum `readWriteAnyDatabase`)
6. Click **Add User**

### 1.3 Configure Network Access

1. Go to **Network Access** → **Add IP Address**
2. Click **Allow Access from Anywhere** (0.0.0.0/0) — required for Render's dynamic IPs
3. Click **Confirm**

### 1.4 Get Connection String

1. Go to **Database** → Click **Connect** on your cluster
2. Choose **Drivers** → **Node.js**
3. Copy the connection string. It looks like:
   ```
   mongodb+srv://vybe-admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual password
5. **Append the database name** to the path:
   ```
   mongodb+srv://vybe-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/socialMedia?retryWrites=true&w=majority
   ```

> [!IMPORTANT]
> The database name must be `socialMedia` to match the existing schema. Append it before the `?` query params.

---

## Step 2: Upstash Redis Setup

### 2.1 Create a Redis Database

1. Go to [Upstash Console](https://console.upstash.com) → **Redis** → **Create Database**
2. Name: `vybe-redis`
3. Region: Choose the same region as your Render services (e.g., **US East 1**)
4. Type: **Regional** (cheaper, fine for single-region)
5. Enable **TLS** (it's on by default)
6. Click **Create**

### 2.2 Get Connection Details

1. In the database dashboard, find the **Connection** section
2. You'll need the **Redis URL** in this format:
   ```
   rediss://default:YOUR_PASSWORD@your-endpoint.upstash.io:6379
   ```

> [!NOTE]
> Notice `rediss://` (with double 's') — this enables TLS. Upstash requires TLS connections. The `ioredis` library used in the project automatically handles `rediss://` URLs with TLS.

### 2.3 Upstash Limitations to Be Aware Of

- **Pub/Sub**: Upstash **does NOT support Redis Pub/Sub** in their serverless Redis offering. This impacts:
  - Real-time broadcast events (likedPost, commentedPost, etc.) from Content Service → Messaging Service
  - Notification push events from Notification Service → Messaging Service
  
> [!WARNING]
> **Pub/Sub Workaround**: Since Upstash doesn't support Pub/Sub, you have two options:
> 1. **Skip Pub/Sub for now** — Core functionality (posts, auth, messaging, notifications) works fine without it. Only real-time broadcast updates (like count changes) won't auto-refresh. Users see updates on page reload.
> 2. **Use Upstash's `@upstash/redis` REST-based polling** or switch to a Pub/Sub alternative like **Ably** or **Pusher** for real-time events.
>
> **Recommendation**: Start with option 1. The app is fully functional without Pub/Sub — it only affects the "live counter" UI updates.

---

## Step 3: Confluent Cloud Kafka Setup

### 3.1 Create a Kafka Cluster

1. Go to [Confluent Cloud](https://confluent.cloud) → **Add Cluster**
2. Choose **Basic** tier (free $400 credit for new accounts)
3. Cloud Provider: **AWS** or **GCP** (match your Render region)
4. Region: Match your Render region (e.g., **us-east-1**)
5. Click **Launch Cluster**

### 3.2 Create Topics

1. Go to your cluster → **Topics** → **Create Topic**
2. Create the following topics:

| Topic Name | Partitions | Retention |
|---|---|---|
| `content-events` | 1 | 7 days |
| `user-events` | 1 | 7 days |
| `message-events` | 1 | 7 days |

> [!TIP]
> For a free-tier deployment, 1 partition per topic is sufficient. You can scale partitions later.

### 3.3 Create API Key

1. Go to your cluster → **API Keys** → **Create Key**
2. Choose **Global Access** (for simplicity) or create granular service accounts
3. **Save both the Key and Secret immediately** — the secret is shown only once

### 3.4 Get Bootstrap Server

1. Go to **Cluster Overview** → **Cluster Settings**
2. Copy the **Bootstrap Server** URL. It looks like:
   ```
   pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
   ```

### 3.5 Confluent Cloud Connection Details

You'll need these values for your services:

```env
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SASL_USERNAME=YOUR_API_KEY
KAFKA_SASL_PASSWORD=YOUR_API_SECRET
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
```

### 3.6 ✅ Code Changes for Confluent Cloud (Already Applied)

The Kafka producers/consumers have been updated with conditional SASL/SSL authentication for Confluent Cloud.

**Files updated:**
- `services/user-service/utils/kafka/producer.js`
- `services/content-service/utils/kafka/producer.js`
- `services/notification-service/utils/kafka/consumer.js`

The Kafka constructor now includes:
```javascript
const kafka = new Kafka({
    clientId: 'your-service-name',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_USERNAME ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD,
    } : undefined,
})
```

> [!NOTE]
> This is **backward compatible** — if `KAFKA_SASL_USERNAME` is not set (local dev), it falls back to no auth. In production with Confluent Cloud, set the SASL env vars.

---

## Step 4: Cloudinary Setup (If Not Already Done)

1. Go to [Cloudinary Console](https://console.cloudinary.com)
2. From the **Dashboard**, get your:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
3. These are needed for: `user-service`, `content-service`, `messaging-service`

---

## Step 5: Deploy Backend Services on Render

You'll deploy **6 separate Web Services** on Render. Each service lives in a subdirectory of the monorepo.

### 5.1 ✅ Dockerfiles for Production (Already Applied)

All 6 Dockerfiles have been updated to use `npm ci --only=production` and `npm start` (instead of `npm run dev` with nodemon). No action needed.

### 5.2 Push Code to GitHub

Make sure your code is pushed to GitHub:
```bash
git add -A
git commit -m "prepare for production deployment"
git push origin main
```

### 5.3 Deploy Each Service on Render

For **each** of the 6 services, repeat these steps:

#### Service Deployment Order (deploy in this order):

| # | Service | Root Directory | Port |
|---|---|---|---|
| 1 | auth-service | `services/auth-service` | 3001 |
| 2 | user-service | `services/user-service` | 3002 |
| 3 | content-service | `services/content-service` | 3003 |
| 4 | messaging-service | `services/messaging-service` | 3004 |
| 5 | notification-service | `services/notification-service` | 3005 |
| 6 | api-gateway | `services/api-gateway` | 8000 |

> [!IMPORTANT]
> Deploy the **API Gateway LAST** because it needs the URLs of all other services.

#### For each service:

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `vybe-auth-service` (use meaningful names)
   - **Region**: Match your MongoDB/Kafka region
   - **Branch**: `main`
   - **Root Directory**: `services/auth-service` (set for each service!)
   - **Runtime**: **Docker**
   - **Instance Type**: **Free** (or Starter for better uptime)

4. Set **Environment Variables** for each service (see Section 5.4 below)
5. Click **Create Web Service**

### 5.4 Environment Variables Per Service

#### Auth Service (`vybe-auth-service`)
```
NODE_ENV=production
PORT=3001
MONGODB_URL=mongodb+srv://vybe-admin:PASSWORD@cluster0.xxxxx.mongodb.net/socialMedia?retryWrites=true&w=majority
JWT_SECRET=your_strong_jwt_secret_here
EMAIL=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

#### User Service (`vybe-user-service`)
```
NODE_ENV=production
PORT=3002
MONGODB_URL=mongodb+srv://vybe-admin:PASSWORD@cluster0.xxxxx.mongodb.net/socialMedia?retryWrites=true&w=majority
JWT_SECRET=your_strong_jwt_secret_here
REDIS_URL=rediss://default:PASSWORD@your-endpoint.upstash.io:6379
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=YOUR_CONFLUENT_API_KEY
KAFKA_SASL_PASSWORD=YOUR_CONFLUENT_API_SECRET
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Content Service (`vybe-content-service`)
```
NODE_ENV=production
PORT=3003
MONGODB_URL=mongodb+srv://vybe-admin:PASSWORD@cluster0.xxxxx.mongodb.net/socialMedia?retryWrites=true&w=majority
JWT_SECRET=your_strong_jwt_secret_here
REDIS_URL=rediss://default:PASSWORD@your-endpoint.upstash.io:6379
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=YOUR_CONFLUENT_API_KEY
KAFKA_SASL_PASSWORD=YOUR_CONFLUENT_API_SECRET
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Messaging Service (`vybe-messaging-service`)
```
NODE_ENV=production
PORT=3004
MONGODB_URL=mongodb+srv://vybe-admin:PASSWORD@cluster0.xxxxx.mongodb.net/socialMedia?retryWrites=true&w=majority
JWT_SECRET=your_strong_jwt_secret_here
REDIS_URL=rediss://default:PASSWORD@your-endpoint.upstash.io:6379
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=YOUR_CONFLUENT_API_KEY
KAFKA_SASL_PASSWORD=YOUR_CONFLUENT_API_SECRET
FRONTEND_URL=https://your-vybe-app.vercel.app
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Notification Service (`vybe-notification-service`)
```
NODE_ENV=production
PORT=3005
MONGODB_URL=mongodb+srv://vybe-admin:PASSWORD@cluster0.xxxxx.mongodb.net/socialMedia?retryWrites=true&w=majority
JWT_SECRET=your_strong_jwt_secret_here
REDIS_URL=rediss://default:PASSWORD@your-endpoint.upstash.io:6379
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_SASL_USERNAME=YOUR_CONFLUENT_API_KEY
KAFKA_SASL_PASSWORD=YOUR_CONFLUENT_API_SECRET
```

#### API Gateway (`vybe-api-gateway`) — Deploy Last!

After all other services are deployed, get their Render URLs from each service's dashboard (they look like `https://vybe-auth-service.onrender.com`).

```
NODE_ENV=production
PORT=8000
FRONTEND_URL=https://your-vybe-app.vercel.app
AUTH_SERVICE_URL=https://vybe-auth-service.onrender.com
USER_SERVICE_URL=https://vybe-user-service.onrender.com
CONTENT_SERVICE_URL=https://vybe-content-service.onrender.com
MESSAGING_SERVICE_URL=https://vybe-messaging-service.onrender.com
NOTIFICATION_SERVICE_URL=https://vybe-notification-service.onrender.com
```

> [!WARNING]
> **Critical**: The `JWT_SECRET` must be **identical** across all services (auth, user, content, messaging, notification). If they differ, authentication will break because each service independently verifies the JWT token.

### 5.5 Render-Specific Considerations

#### Free Tier Spin-Down
Render's free tier spins down services after 15 minutes of inactivity. The first request after spin-down takes ~30-50 seconds.

**Mitigation options:**
- Use Render's **Starter plan** ($7/month per service) for always-on
- Set up a cron job (e.g., [cron-job.org](https://cron-job.org)) to ping `https://vybe-api-gateway.onrender.com/health` every 14 minutes

#### WebSocket Support
Render supports WebSocket connections on Web Services. The messaging service's Socket.io should work out of the box. However:

> [!IMPORTANT]
> Render terminates idle WebSocket connections after **5 minutes** on the free tier. Make sure your Socket.io client has reconnection enabled (it is by default with `socket.io-client`).

---

## Step 6: Deploy Frontend on Vercel

### 6.1 Import Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

### 6.2 Set Environment Variables

In Vercel's project settings → **Environment Variables**, add:

```
VITE_SERVER_URL=https://vybe-api-gateway.onrender.com
```

> [!IMPORTANT]
> The variable **must** be prefixed with `VITE_` for Vite to expose it to the client-side bundle. This is already how it's used in your code: `import.meta.env.VITE_SERVER_URL`.

### 6.3 Deploy

1. Click **Deploy**
2. Vercel will build and deploy your frontend
3. You'll get a URL like: `https://your-vybe-app.vercel.app`

### 6.4 Update Backend CORS After Frontend Deploy

Once you have the Vercel URL, go back to Render and update:

1. **API Gateway** → Environment Variables → Set `FRONTEND_URL=https://your-vybe-app.vercel.app`
2. **Messaging Service** → Environment Variables → Set `FRONTEND_URL=https://your-vybe-app.vercel.app`
3. Redeploy both services on Render (Render auto-redeploys on env var changes)

---

## Step 7: Post-Deployment Verification

### 7.1 Health Checks

Test each service is running:

```bash
# API Gateway health
curl https://vybe-api-gateway.onrender.com/health

# All services health
curl https://vybe-api-gateway.onrender.com/health/all
```

Expected response for `/health/all`:
```json
{
  "service": "api-gateway",
  "status": "healthy",
  "downstream": {
    "auth": "up",
    "user": "up",
    "content": "up",
    "messaging": "up",
    "notification": "up"
  }
}
```

### 7.2 Test Core Flows

| # | Test | Expected |
|---|---|---|
| 1 | Sign up a new user | User created, JWT cookie set, redirected to home |
| 2 | Sign in | JWT cookie set, user data returned |
| 3 | Edit profile with image | Profile updated, image uploaded to Cloudinary |
| 4 | Create a post with image | Post created, visible in feed |
| 5 | Like a post | Like toggled, notification created (check Kafka) |
| 6 | Send a message | Message stored, real-time delivery via Socket.io |
| 7 | Check notifications | Notifications list populated from Kafka events |

### 7.3 Monitor Kafka

In Confluent Cloud Console:
1. Go to your cluster → **Topics**
2. Click on `content-events` → **Messages** tab
3. You should see events flowing when users like/comment/post

### 7.4 Monitor Redis

In Upstash Console:
1. Go to your database → **Data Browser**
2. You should see cached keys like `cache:posts:all`, `cache:user:profile:*`

---

## Step 8: ✅ Cookie & CORS Configuration for Cross-Origin (Already Applied)

Since your frontend (Vercel, `*.vercel.app`) and backend (Render, `*.onrender.com`) are on **different domains**, cookies need special handling.

### 8.1 How It Works

The auth controller in `services/auth-service/controllers/auth.controllers.js` already uses environment-aware cookie config:

```javascript
const isProduction = process.env.NODE_ENV === "production"
const cookieOptions = {
    httpOnly: true,
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    secure: isProduction,
    sameSite: isProduction ? "none" : "strict"
}
```

The `clearCookie` in `signOut` has also been updated with matching options to ensure cookies clear properly cross-origin.

> [!CAUTION]
> **You MUST set `NODE_ENV=production`** on all Render services. Without it, cookies won't have `SameSite=None; Secure` and cross-origin auth will silently fail (signin appears to work but subsequent API calls return 401).

### 8.3 CORS Configuration Check

Your API Gateway already has CORS configured correctly with `credentials: true`. Just make sure the `FRONTEND_URL` env var matches **exactly** (including `https://` and no trailing slash):

```javascript
// api-gateway/index.js — already correct
app.use(cors({
    origin: process.env.FRONTEND_URL,  // Must be exact Vercel URL
    credentials: true
}))
```

---

## Step 9: Custom Domain (Optional)

### 9.1 Frontend (Vercel)
1. Go to Vercel → Project Settings → **Domains**
2. Add your domain (e.g., `vybe.app`)
3. Follow DNS configuration instructions

### 9.2 Backend (Render)
1. Go to Render → API Gateway Service → **Settings** → **Custom Domain**
2. Add your API domain (e.g., `api.vybe.app`)
3. Update `VITE_SERVER_URL` in Vercel to the new domain
4. Update `FRONTEND_URL` on all relevant Render services

---

## Quick Reference: All Environment Variables

| Variable | Services That Need It | Example Value |
|---|---|---|
| `NODE_ENV` | **all services** | `production` |
| `MONGODB_URL` | auth, user, content, messaging, notification | `mongodb+srv://...` |
| `JWT_SECRET` | auth, user, content, messaging, notification | `my-super-secret-key-123` |
| `REDIS_URL` | user, content, messaging, notification | `rediss://default:...@....upstash.io:6379` |
| `KAFKA_BROKERS` | user, content, notification | `pkc-xxxxx.confluent.cloud:9092` |
| `KAFKA_SSL` | user, content, notification | `true` |
| `KAFKA_SASL_MECHANISM` | user, content, notification | `plain` |
| `KAFKA_SASL_USERNAME` | user, content, notification | Confluent API Key |
| `KAFKA_SASL_PASSWORD` | user, content, notification | Confluent API Secret |
| `CLOUDINARY_CLOUD_NAME` | user, content, messaging | Your cloud name |
| `CLOUDINARY_API_KEY` | user, content, messaging | Your API key |
| `CLOUDINARY_API_SECRET` | user, content, messaging | Your API secret |
| `EMAIL` | auth | `your_email@gmail.com` |
| `EMAIL_PASS` | auth | Gmail App Password |
| `FRONTEND_URL` | api-gateway, messaging | `https://your-app.vercel.app` |
| `AUTH_SERVICE_URL` | api-gateway | `https://vybe-auth-service.onrender.com` |
| `USER_SERVICE_URL` | api-gateway | `https://vybe-user-service.onrender.com` |
| `CONTENT_SERVICE_URL` | api-gateway | `https://vybe-content-service.onrender.com` |
| `MESSAGING_SERVICE_URL` | api-gateway | `https://vybe-messaging-service.onrender.com` |
| `NOTIFICATION_SERVICE_URL` | api-gateway | `https://vybe-notification-service.onrender.com` |
| `VITE_SERVER_URL` | frontend (Vercel) | `https://vybe-api-gateway.onrender.com` |

---

## Deployment Checklist

```
Pre-deployment:
  [ ] MongoDB Atlas cluster created with network access from 0.0.0.0/0
  [ ] Upstash Redis database created with TLS URL
  [ ] Confluent Cloud Kafka cluster with 3 topics and API key
  [ ] Cloudinary credentials ready
  [ ] Gmail App Password generated
  [x] Code changes: Kafka SASL/SSL auth (Step 3.6)
  [x] Code changes: Cookie SameSite+clearCookie (Step 8)
  [x] Dockerfiles updated for production (Step 5.1)
  [x] .env.example files updated with new vars

Deploy services (in order):
  [ ] 1. auth-service on Render
  [ ] 2. user-service on Render
  [ ] 3. content-service on Render
  [ ] 4. messaging-service on Render
  [ ] 5. notification-service on Render
  [ ] 6. api-gateway on Render (needs other service URLs)
  [ ] 7. Frontend on Vercel (needs gateway URL)

Post-deployment:
  [ ] Update FRONTEND_URL on api-gateway and messaging-service
  [ ] Run health check: /health/all
  [ ] Test signup → signin → create post → like → check notification
  [ ] Verify Kafka messages in Confluent Cloud console
  [ ] Verify Redis keys in Upstash console
```

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| 401 on all API calls after signin | Cookie not sent cross-origin | Apply Step 8.2 (SameSite=None, Secure) |
| `ENOTFOUND` on MongoDB | Wrong connection string | Check for typos, ensure `socialMedia` DB name in URL |
| Kafka connection timeout | Missing SASL config | Apply Step 3.6, verify API key/secret |
| `ECONNREFUSED` on Redis | Wrong URL or missing TLS | Use `rediss://` (double s) for Upstash |
| Services return 502/504 via gateway | Downstream service sleeping (free tier) | Wait 30s or upgrade to Starter plan |
| Socket.io not connecting | CORS or FRONTEND_URL mismatch | Verify FRONTEND_URL exactly matches Vercel URL |
| Images not uploading | Cloudinary credentials wrong | Double-check all 3 Cloudinary env vars |
| Notifications not appearing | Kafka topics not created or consumer not connected | Create topics manually in Confluent, check logs |

---

## Cost Estimate (Free Tier)

| Service | Plan | Cost |
|---|---|---|
| MongoDB Atlas | M0 Free | $0 |
| Upstash Redis | Free (10K commands/day) | $0 |
| Confluent Cloud | Basic ($400 credit) | $0 for ~2-3 months |
| Render (6 services) | Free | $0 (with spin-down) |
| Vercel | Hobby | $0 |
| Cloudinary | Free (25 credits/month) | $0 |
| **Total** | | **$0/month** |

> [!NOTE]
> For a portfolio/demo project, the free tier of all services is sufficient. For production traffic, expect ~$42/month on Render (Starter plan × 6) + managed service costs.

---

*Last updated: September 2026*
