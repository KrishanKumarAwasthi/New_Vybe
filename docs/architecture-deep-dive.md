# Vybe: Monolith → Microservices — Complete Architecture Deep Dive

> **Purpose:** This is your definitive reference for understanding every technical decision, every file, every data flow, and every failure mode in the New Vybe architecture. If you can explain everything in this document, you can explain this project in any interview.

---

## Table of Contents

1. [Why We Migrated](#1-why-we-migrated-from-monolith-to-microservices)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack — The Why Behind Every Choice](#3-technology-stack--the-why-behind-every-choice)
4. [Service-by-Service Breakdown (Every File Explained)](#4-service-by-service-breakdown)
5. [Docker & docker-compose.yml — Line by Line](#5-docker--docker-composeyml--line-by-line)
6. [How Kafka Works in This Project](#6-how-kafka-works-in-this-project)
7. [How Redis Works in This Project](#7-how-redis-works-in-this-project)
8. [Complete Data Flow Walkthroughs](#8-complete-data-flow-walkthroughs)
9. [How Authentication Works Across Services](#9-how-authentication-works-across-services)
10. [Performance: Why It Got Faster](#10-performance-why-it-got-faster)
11. [Failure Scenarios & Resilience](#11-failure-scenarios--resilience)
12. [Production Deployment Architecture](#12-production-deployment-architecture)
13. [Design Tradeoffs We Made](#13-design-tradeoffs-we-made)
14. [Interview Questions & Answers](#14-interview-questions--answers)

---

## 1. Why We Migrated from Monolith to Microservices

### The Original Monolith

The old Vybe was a single Express.js server (`backend/index.js`) that handled everything — auth, posts, messages, notifications, socket connections — in one process. This worked fine for development but had critical production problems:

**Problem 1: Single Point of Failure**
If the notification code threw an unhandled exception, the entire server crashed. Users couldn't log in, couldn't view posts, couldn't message — everything went down.

**Problem 2: Resource Contention**
When 100 users liked posts simultaneously, the monolith had to:
1. Update the `likes` array in MongoDB
2. Create a notification document in MongoDB
3. Emit a Socket.io event to the receiver
4. Respond to the user

Steps 1-3 all competed for the *same* MongoDB connection pool and the *same* Node.js event loop. Under load, the connection pool maxed out, causing a **38.86% error rate** on the like endpoint (from our k6 benchmarks).

**Problem 3: No Independent Scaling**
The messaging service handles WebSocket connections (long-lived, memory-intensive). The content service handles image uploads (CPU/bandwidth-intensive). In a monolith, you can't scale one without scaling the other. You'd have to duplicate the entire server, wasting resources.

### The Solution

Split the monolith into **6 independent services**, each with its own process, its own Express server, and its own responsibility. Add **Redis** to cache frequently-read data and **Kafka** to decouple write-heavy operations.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                          │
│                     Hosted on Vercel                               │
│              https://new-vybe.vercel.app                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  HTTP + WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (:8000)                           │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Helmet   │ │Rate Limit│ │  CORS   │ │ Proxy    │ │ WS Proxy │ │
│  └──────────┘ └──────────┘ └─────────┘ └──────────┘ └──────────┘ │
└────┬──────────┬──────────┬──────────┬──────────┬────────────────────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐
│  Auth   │ │  User   │ │ Content  │ │Messaging │ │ Notification  │
│ :3001   │ │ :3002   │ │  :3003   │ │  :3004   │ │    :3005      │
└─────────┘ └────┬────┘ └────┬─────┘ └──────────┘ └───────┬───────┘
                 │           │                             │
                 ▼           ▼                             │
            ┌─────────┐ ┌─────────┐                       │
            │  Redis  │ │  Redis  │                       │
            │ (Cache) │ │ (Cache) │                       │
            └─────────┘ └─────────┘                       │
                 │           │                             │
                 │     ┌─────┴───────┐                     │
                 │     │   Kafka     │◄────────────────────┘
                 │     │ (Events)    │   (Consumes events)
                 │     └─────────────┘
                 │           │
                 ▼           ▼
            ┌──────────────────────┐
            │     MongoDB Atlas    │
            │   (Shared Database)  │
            └──────────────────────┘
```

**Key Insight:** The frontend only ever talks to the API Gateway. It has no idea that 5 separate services exist behind it. The Gateway routes requests based on the URL path.

---

## 3. Technology Stack — The Why Behind Every Choice

### Node.js + Express
- **Why Node.js:** Its single-threaded, non-blocking event loop makes it exceptional for I/O-bound workloads (database queries, API calls, file reads). Social media is almost entirely I/O-bound.
- **Why Express:** It's the de-facto standard for Node.js HTTP servers. Minimal overhead, massive ecosystem, every developer knows it.
- **Why not Fastify/Koa:** Express is the safer resume item and has better community support for `http-proxy-middleware`.

### MongoDB + Mongoose
- **Why MongoDB:** Social media data is inherently document-shaped. A post has an author, a media URL, an array of likes, an array of comments (each with their own author). This maps perfectly to a JSON document. In SQL, this would require 4+ JOINs.
- **Why Mongoose:** It adds schema validation on top of MongoDB's schema-less documents. Without Mongoose, a typo like `usrName` instead of `userName` would silently create a malformed document. Mongoose catches this.
- **Why a shared database instead of per-service databases:** In a strict microservices design, each service has its own database. We chose a shared database because:
  1. The Content Service needs to `populate("author")` which references the `users` collection. With separate databases, this would require an HTTP call to the User Service for every post, adding massive latency.
  2. For a project at this scale, the operational overhead of managing 5 separate databases outweighs the theoretical benefits of data isolation.

### Redis (ioredis)
- **Why Redis:** MongoDB queries for feeds involve sorting, populating references, and filtering. This takes ~150ms. Redis stores data in RAM, so the same data can be returned in ~15ms — a 10x improvement.
- **Why ioredis over node-redis:** `ioredis` has better support for Cluster mode, Sentinel, and pipelining. It also handles reconnection more gracefully and supports the `lazyConnect` option we use.
- **Why not Memcached:** Redis supports richer data structures (sorted sets, hashes, pub/sub). We use its key-value caching now, but the architecture is ready for pub/sub if we add cross-service Socket.io broadcasting later.
- **Cache Strategy:** Cache-Aside (also called Lazy Loading). We check Redis first; on a miss, we query MongoDB and populate Redis. We invalidate (delete) the cache key whenever data changes.

### Apache Kafka (kafkajs)
- **Why Kafka:** When a user likes a post, the notification needs to be created. In the monolith, this was synchronous — the user had to wait for the notification write to complete before getting a response. Kafka decouples this: the Content Service publishes an event and returns immediately. The Notification Service processes it asynchronously.
- **Why not RabbitMQ:** Kafka provides *durable, ordered, replayable* event logs. If the Notification Service crashes, the events are not lost — they persist on Kafka's disk until the service recovers and catches up. RabbitMQ deletes messages once they're acknowledged.
- **Why not Redis Pub/Sub:** Redis Pub/Sub is fire-and-forget. If no subscriber is listening when a message is published, the message is lost forever. Kafka guarantees delivery.
- **Why Confluent Cloud in production:** Running a Kafka cluster yourself requires managing ZooKeeper (or KRaft), broker replication, and partition rebalancing. Confluent Cloud is fully managed and provides SASL/SSL authentication out of the box.

### Socket.io
- **Why Socket.io:** We need real-time bidirectional communication for messaging (chat) and online status tracking. HTTP is request-response only; the server can't push data to the client unprompted. WebSockets (which Socket.io wraps) maintain a persistent connection.
- **Why Socket.io over raw WebSockets:** Socket.io adds automatic reconnection, room/namespace support, and fallback to HTTP long-polling if WebSockets are blocked by a corporate firewall.

### Docker
- **Why Docker:** "Works on my machine" is eliminated. Docker packages each service with its exact Node.js version, npm dependencies, and file structure into an immutable image. The same image runs identically on a developer's laptop, in CI/CD, and in production.
- **Why Alpine base image (`node:22-alpine`):** Alpine Linux is ~5MB compared to Debian's ~100MB. Smaller images = faster builds, faster deploys, less attack surface.
- **Why `npm ci --only=production`:** `npm ci` installs from `package-lock.json` exactly (deterministic), unlike `npm install` which may resolve to different versions. `--only=production` skips `devDependencies` like `nodemon` — we don't need hot-reloading in production.

### Cloudinary
- **Why Cloudinary:** We need to store user-uploaded images and videos. Storing them on the server's filesystem doesn't work in production because Render's filesystem is ephemeral (wiped on every deploy). Cloudinary provides a permanent CDN-backed media host.
- **How it works:** Multer saves the file temporarily to `/app/public/`, Cloudinary uploads it and returns a permanent URL, then `fs.unlinkSync()` deletes the temporary file.

### Helmet + express-rate-limit (API Gateway)
- **Why Helmet:** Sets security headers like `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`. Prevents common attacks (MIME sniffing, clickjacking, XSS).
- **Why Rate Limiting:** Prevents brute-force attacks. The auth endpoints have a stricter limit (500 req/15min) than the general API (2000 req/15min) because login/signup are the primary attack targets.

---

## 4. Service-by-Service Breakdown

### Service 1: API Gateway (`services/api-gateway/`)

The API Gateway is the **only service exposed to the internet**. The frontend talks to `https://vybe-api-gateway.onrender.com` and nothing else.

#### `index.js` — The Complete Routing Engine

**Dependencies loaded (lines 1-8):**
- `express`: HTTP server
- `dotenv`: Reads `.env` file
- `cors`: Cross-Origin Resource Sharing (allows Vercel frontend to talk to Render backend)
- `cookie-parser`: Parses JWT cookies from incoming requests
- `http-proxy-middleware`: The core library that forwards requests to downstream services
- `helmet`: Security headers
- `express-rate-limit`: Throttling
- `axios`: Used to health-check downstream services

**Security Layer (lines 15-29):**
```javascript
app.use(helmet())                    // Security headers on every response
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,        // 15-minute window
    max: 2000,                        // 2000 requests per IP per window
})
const authLimiter = rateLimit({      // Stricter limit for auth endpoints
    max: 500,
})
```

**CORS Configuration (lines 31-35):**
```javascript
app.use(cors({
    origin: process.env.FRONTEND_URL, // Only allow requests from our Vercel domain
    credentials: true                  // Allow cookies to be sent cross-origin
}))
```
`credentials: true` is critical. Without it, the browser will not send the JWT cookie with requests from `vercel.app` to `onrender.com`.

**The Proxy Factory (lines 81-122):**
The `createProxy()` function creates an `http-proxy-middleware` instance. Key behaviors:
- `changeOrigin: true`: Rewrites the `Host` header to match the downstream service. Without this, some hosting platforms reject the request.
- `proxyTimeout: 60000`: 60-second timeout. File uploads (images/videos to Cloudinary) can take a while.
- `cookieDomainRewrite: ""`: Strips the domain from `Set-Cookie` headers so the browser accepts cookies from the proxy.
- Cookie forwarding in `proxyReq`: Manually forwards the `cookie` header so downstream services receive the JWT.
- Set-Cookie forwarding in `proxyRes`: When the Auth Service sets a cookie (on login), the Gateway forwards the `Set-Cookie` header back to the browser.
- Error handling: Returns `504 Gateway Timeout` for timeouts and `502 Bad Gateway` for connection failures.

**Route Mapping (lines 124-155):**
```
/api/auth/*                  → Auth Service (:3001)
/api/user/*                  → User Service (:3002)
/api/post/*, /api/loop/*, /api/story/*  → Content Service (:3003)
/api/message/*               → Messaging Service (:3004)
/api/notifications/*         → Notification Service (:3005)
/socket.io/*                 → Messaging Service (:3004) [WebSocket proxy]
```

**Special case (lines 127-132):** The notification routes are mapped with `pathRewrite` because the frontend was built to call `/api/user/getAllNotifications` (legacy monolith route), but the Notification Service exposes `/api/notifications/getAll`. The Gateway rewrites the path transparently.

**WebSocket Upgrade (line 172):**
```javascript
server.on('upgrade', wsProxy.upgrade)
```
HTTP connections upgrade to WebSocket connections via the `Upgrade` header. This line tells the server to hand off WebSocket upgrade requests to the messaging proxy.

#### `package.json` — Dependencies
```
express, cors, cookie-parser, dotenv        → Standard Express setup
http-proxy-middleware                        → The core proxy library
helmet, express-rate-limit                   → Security
axios                                        → Health checks to downstream services
nodemon (dev only)                           → Hot-reload during development
```

---

### Service 2: Auth Service (`services/auth-service/`)

**Responsibility:** User registration, login, logout, OTP-based password reset.
**Connects to:** MongoDB only. No Redis. No Kafka. This is the simplest service.

#### `index.js` — Entry Point
Connects to MongoDB, starts Express on port 3001. Has a `/health` endpoint for the Gateway's health checker.

#### `config/token.js` — JWT Generation
```javascript
jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "10y" })
```
Signs a JWT containing only `{ userId }` with a shared secret. The token expires in 10 years (effectively "never expires" — the user stays logged in until they sign out).

**Critical Design Decision:** The `JWT_SECRET` must be **identical** across all 6 services. The Auth Service *creates* the token, but every other service *verifies* it independently using the same secret. If the secrets differ, authentication breaks silently.

#### `config/Mail.js` — Nodemailer SMTP
Uses Gmail SMTP to send OTP emails. The `EMAIL_PASS` is a Gmail App Password (not your actual Gmail password). Gmail requires 2FA + App Passwords for programmatic access.

#### `controllers/auth.controllers.js` — All Auth Logic

**Cookie Configuration (lines 6-12):**
```javascript
const isProduction = process.env.NODE_ENV === "production"
const cookieOptions = {
    httpOnly: true,              // JavaScript can't read this cookie (XSS protection)
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000,  // 10 years
    secure: isProduction,         // Only sent over HTTPS in production
    sameSite: isProduction ? "none" : "strict"  // "none" allows cross-origin
}
```
**Why `SameSite=None`:** The frontend is on `vercel.app` and the backend is on `onrender.com`. These are different domains. By default, browsers block cookies from being sent to a different domain. `SameSite=None` + `Secure=true` explicitly allows this.

**Why `httpOnly=true`:** This prevents client-side JavaScript from reading the cookie via `document.cookie`. This is a critical XSS defense — even if an attacker injects JavaScript into the page, they can't steal the JWT.

**`signUp` (lines 14-48):**
1. Validates uniqueness of email and userName
2. Hashes password with `bcryptjs` (salt rounds = 10)
3. Creates user document in MongoDB
4. Generates JWT
5. Sets cookie and returns user data

**`signOut` (lines 76-87):**
```javascript
res.clearCookie("token", { httpOnly: true, secure: isProduction, sameSite: ... })
```
To clear a cookie, you must pass the **exact same options** it was set with. If the options don't match, the browser won't clear it.

**`sendOtp` / `verifyOtp` / `resetPassword` (lines 89-149):**
The OTP flow:
1. User requests OTP → server generates 4-digit code, saves to `user.resetOtp`, sets 5-minute expiry, emails OTP
2. User submits OTP → server checks `user.resetOtp === submittedOtp` and `user.otpExpires > now`
3. User submits new password → server checks `user.isOtpVerified === true`, hashes new password, saves

**Why store OTP in the database instead of Redis/session?** Simplicity. The OTP has a built-in expiry check (`otpExpires < Date.now()`). Using Redis would add a dependency to the Auth Service just for one feature.

---

### Service 3: User Service (`services/user-service/`)

**Responsibility:** Profile management, follow/unfollow, user search, suggested users.
**Connects to:** MongoDB, Redis (caching), Kafka (produces `USER_FOLLOWED` events).

#### `index.js` — Startup Sequence
```javascript
await mongoose.connect(process.env.MONGODB_URL)  // 1. Database first
await connectProducer()                            // 2. Then Kafka producer
await connectRedis()                               // 3. Then Redis
app.listen(port, ...)                              // 4. Finally start HTTP server
```
Order matters: MongoDB must connect before we start accepting requests, or the first request would fail.

#### `config/redis.js` — Redis Client Configuration
```javascript
export const redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,           // Don't connect until we explicitly call .connect()
    maxRetriesPerRequest: 3,     // Fail after 3 retries instead of hanging forever
    enableOfflineQueue: false,   // Don't queue commands if Redis is down
    retryStrategy(times) {       // Exponential backoff, max 3 seconds
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
});
```
**Why `enableOfflineQueue: false`?** If Redis goes down, we want commands to fail immediately so we can fall back to MongoDB. If we queued commands, they'd pile up in memory and cause the process to crash from memory exhaustion.

**Why `lazyConnect: true`?** We control exactly when the connection is established (in `startServer()`). Without this, the connection attempt would fire immediately on import, before the environment variables are loaded.

#### `controllers/user.controllers.js` — The Cache-Aside Pattern

**`getProfile` (lines 80-112) — The key caching example:**
```javascript
// Step 1: Try Redis first
const cachedData = await redisClient.get(`user:profile:${userName}`);
if (cachedData) {
    return res.status(200).json(JSON.parse(cachedData));  // Cache HIT → instant response
}

// Step 2: Cache MISS → query MongoDB
const user = await User.findOne({ userName }).populate("posts loops followers following")

// Step 3: Store in Redis with 5-minute TTL
await redisClient.setex(`user:profile:${userName}`, 300, JSON.stringify(user));

return res.status(200).json(user)
```

**Cache Invalidation (called in `editProfile`, `follow`):**
```javascript
await redisClient.del(`user:profile:${user.userName}`);
```
When a user edits their profile or follows someone, the cached profile becomes stale. We delete the cache key so the next request fetches fresh data from MongoDB.

**Graceful Redis Failure (every Redis call is wrapped in try/catch):**
```javascript
try {
    const cachedData = await redisClient.get(cacheKey);
    // ...
} catch (redisError) {
    console.error("[User Service] Redis get failed:", redisError.message);
    // Fall through to MongoDB query below
}
```
If Redis crashes, the app doesn't crash. It just becomes slower (hitting MongoDB directly).

**`follow` (lines 114-186) — Kafka Event Production:**
When User A follows User B:
```javascript
const eventId = uuidv4();                          // Generate unique event ID
publishEvent("user-events", "USER_FOLLOWED", {     // Send to Kafka
    eventId,
    followerId: currentUser._id,
    followedUserId: targetUser._id
});
```
The `eventId` (UUID v4) serves two purposes:
1. **Kafka message key:** Kafka uses keys for partition assignment
2. **Idempotency:** The Notification Service checks if this `eventId` has already been processed

#### `middlewares/isAuth.js` — JWT Verification
```javascript
const token = req.cookies.token                         // Read from cookie (forwarded by Gateway)
const verifyToken = await jwt.verify(token, process.env.JWT_SECRET)  // Verify signature
req.userId = verifyToken.userId                         // Attach to request object
next()                                                   // Continue to controller
```
Every protected route runs through this middleware. **This is stateless authentication** — we don't need to call the Auth Service or check a database. The JWT itself contains the userId, and we verify its signature locally.

#### `middlewares/multer.js` — File Upload Handling
Multer is Express middleware that handles `multipart/form-data` (file uploads). It saves uploaded files to `/app/public/` temporarily. After Cloudinary upload, `fs.unlinkSync()` deletes the temporary file.

#### `utils/kafka/producer.js` — Kafka Producer
```javascript
const kafka = new Kafka({
    clientId: 'user-service-producer',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_USERNAME ? { ... } : undefined,
})
```
**Conditional SASL/SSL:** In local development, Kafka runs without authentication. In production (Confluent Cloud), SASL/SSL is required. The `sasl` field is set to `undefined` when `KAFKA_SASL_USERNAME` isn't provided, which tells kafkajs to connect without auth.

**Error handling in `publishEvent`:**
```javascript
} catch (error) {
    console.error(`Failed to publish ${eventType} to ${topic}:`, error)
    // Explicitly catching this so the caller doesn't fail the HTTP request
}
```
If Kafka is down, the event is lost, but the HTTP request still succeeds. The user gets their "liked" response. The notification just doesn't get created. This is a deliberate tradeoff — we prioritize user experience over notification completeness.

---

### Service 4: Content Service (`services/content-service/`)

**Responsibility:** Posts, Loops (short videos), Stories. The heaviest service.
**Connects to:** MongoDB, Redis (caching), Kafka (produces `POST_LIKED`, `POST_COMMENTED`, `LOOP_LIKED`, `LOOP_COMMENTED` events).

#### `controllers/post.controllers.js`

**`uploadPost` (lines 8-38):**
1. Upload media to Cloudinary via Multer → Cloudinary pipeline
2. Create `Post` document in MongoDB
3. Push post ID into `user.posts` array
4. Invalidate `posts:feed` cache in Redis
5. Return populated post (with author name/image)

**`getAllPosts` (lines 40-70) — Feed with Redis Caching:**
```javascript
const cacheKey = "posts:feed";
const cachedData = await redisClient.get(cacheKey);  // Try cache
if (cachedData) return res.json(JSON.parse(cachedData));  // HIT

const posts = await Post.find({})                    // MISS → query MongoDB
    .populate("author", "name userName profileImage")
    .populate("comments.author")
    .sort({ createdAt: -1 })

await redisClient.setex(cacheKey, 120, JSON.stringify(posts));  // Cache for 2 minutes
return res.json(posts)
```

**`like` (lines 72-113) — The Kafka Integration Point:**
```javascript
if (!alreadyLiked) {
    post.likes.push(req.userId)
    if (post.author.toString() !== req.userId.toString()) {
        publishEvent("content-events", "POST_LIKED", {
            eventId: uuidv4(),
            postId: post._id,
            postOwnerId: post.author,
            userId: req.userId
        });
    }
}
await post.save()
await redisClient.del("posts:feed");  // Invalidate cache
return res.json(post)                  // Return IMMEDIATELY, don't wait for notification
```

**Why the self-like check?** `post.author.toString() !== req.userId.toString()` — we don't create a notification when you like your own post.

**`deletePost` (lines 179-221) — Cleanup Chain:**
1. Delete media from Cloudinary via `deleteFromCloudinary()`
2. Delete the `Post` document from MongoDB
3. Remove the post ID from the author's `user.posts` array
4. Remove the post ID from any user's `saved` array (other users who bookmarked it)
5. Invalidate `posts:feed` cache

#### `controllers/story.controllers.js`
**`uploadStory`:** If the user already has a story, delete the old one first (users can only have one active story). Upload new media, create `Story` document, link it to the user.

**`getAllStories`:** Fetches stories only from users the current user follows (`author: { $in: followingIds }`).

---

### Service 5: Messaging Service (`services/messaging-service/`)

**Responsibility:** Real-time chat via Socket.io + message persistence in MongoDB.
**Connects to:** MongoDB, Socket.io (WebSocket server).

#### `socket.js` — The WebSocket Server

**Server Creation (lines 9-18):**
```javascript
const server = http.createServer(app)         // Create raw HTTP server
const io = new Server(server, {               // Wrap it with Socket.io
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
    }
})
```
Note: This service uses `server.listen()` instead of `app.listen()` because Socket.io needs the raw HTTP server reference for WebSocket upgrades.

**Authentication Middleware (lines 26-49):**
Socket.io doesn't use Express middleware. Instead, it has its own `io.use()` middleware:
```javascript
io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie  // WebSocket handshake carries cookies
    // Parse cookies manually (cookie-parser doesn't work here)
    const cookies = cookieHeader.split(';').reduce(...)
    const token = cookies.token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.userId     // Attach userId to socket object
    next()
})
```
**Why manual cookie parsing?** During the WebSocket handshake, cookies are sent as a raw string in the `Cookie` header. Express's `cookie-parser` doesn't run here because this is Socket.io's connection phase, not an Express route.

**Connection Tracking (lines 20-24, 51-67):**
```javascript
const userSocketMap = {}                      // { "userId123": "socketId456" }

io.on("connection", (socket) => {
    userSocketMap[socket.userId] = socket.id   // Register
    io.emit('getOnlineUsers', Object.keys(userSocketMap))  // Broadcast online list
    socket.on('disconnect', () => {
        delete userSocketMap[socket.userId]     // Unregister
        io.emit('getOnlineUsers', Object.keys(userSocketMap))  // Re-broadcast
    })
})
```

#### `controllers/message.controllers.js`

**`sendMessage` (lines 8-47):**
1. Optionally upload image to Cloudinary
2. Create `Message` document in MongoDB
3. Find or create a `Conversation` document linking sender and receiver
4. Push message ID into conversation's `messages` array
5. Emit real-time event to receiver:
```javascript
const receiverSocketId = getSocketId(receiverId)  // Look up in userSocketMap
if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", newMessage)  // Direct emit
}
```
`io.to(socketId).emit()` sends to a specific connected client. If the receiver is offline (not in `userSocketMap`), the real-time emit is skipped — they'll see the message when they load chat history.

---

### Service 6: Notification Service (`services/notification-service/`)

**Responsibility:** Consumes Kafka events and creates notification documents. The only "worker" service — it processes background jobs.
**Connects to:** MongoDB, Kafka (consumer).

#### `index.js` — Unique Startup
```javascript
import { startNotificationConsumer } from "./consumers/notificationConsumer.js"
startNotificationConsumer()  // Start Kafka consumer BEFORE server starts
```
The Kafka consumer starts immediately on import, running in the background as a perpetual loop.

#### `consumers/notificationConsumer.js` — The Kafka Consumer

**Subscription (lines 4-6):**
```javascript
await connectConsumer(["content-events", "user-events"], async (payload, topic) => {
```
Subscribes to two Kafka topics:
- `content-events`: POST_LIKED, POST_COMMENTED, LOOP_LIKED, LOOP_COMMENTED (from Content Service)
- `user-events`: USER_FOLLOWED (from User Service)

**Idempotency Guard (lines 9-16):**
```javascript
if (eventId) {
    const existing = await Notification.findOne({ eventId })
    if (existing) {
        console.log(`Skipping duplicate eventId: ${eventId}`)
        return
    }
}
```
**Why is this needed?** Kafka guarantees *at-least-once* delivery. If the consumer crashes after processing a message but before committing its offset, Kafka will redeliver the message on restart. Without this check, the user would get duplicate notifications.

**Double Safety via MongoDB Unique Index (lines 87-89):**
```javascript
if (error.code === 11000) {  // MongoDB duplicate key error
    console.log(`Duplicate eventId ignored via MongoDB unique index: ${eventId}`)
}
```
The `eventId` field has a `unique: true` constraint in the Notification model. Even if the application-level check fails (race condition with two consumer instances), MongoDB will reject the duplicate.

**Event Routing (lines 19-85):**
A `switch` statement maps event types to notification creation:
```
USER_FOLLOWED  → type: "follow", message: "started following you"
POST_LIKED     → type: "like", message: "liked your post"
POST_COMMENTED → type: "comment", message: "commented on your post: [first 20 chars]..."
LOOP_LIKED     → type: "like", message: "liked your loop"
LOOP_COMMENTED → type: "comment", message: "commented on your loop: [first 20 chars]..."
```

#### `models/notification.model.js` — Schema Design
```javascript
{
    sender: ObjectId (ref: "User"),     // Who triggered it
    receiver: ObjectId (ref: "User"),   // Who receives it
    type: "like" | "comment" | "follow",
    message: String,
    post: ObjectId (ref: "Post"),       // Optional — only for post notifications
    loop: ObjectId (ref: "Loop"),       // Optional — only for loop notifications
    isRead: Boolean (default: false),
    eventId: String (unique, sparse)    // Kafka idempotency key
}
```
**Why `sparse: true` on eventId?** Existing notifications from the monolith era don't have an `eventId`. `sparse` means MongoDB only enforces uniqueness on documents where `eventId` actually exists.

---

## 5. Docker & docker-compose.yml — Line by Line

### Infrastructure Services

**MongoDB (mongo:7):**
```yaml
environment:
  MONGO_INITDB_DATABASE: socialMedia    # Create this DB on first startup
volumes:
  - mongodb_data:/data/db               # Persist data across container restarts
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
```
The healthcheck is crucial: downstream services have `depends_on: mongodb: condition: service_healthy`, meaning they won't start until MongoDB is ready to accept connections.

**Redis (redis:7-alpine):**
```yaml
command: redis-server --appendonly yes   # Enable AOF persistence
```
`--appendonly yes` writes every command to an append-only file (AOF). If Redis restarts, it replays the AOF to restore data. Without this, all cached data is lost on restart.

**Kafka (apache/kafka:latest):**
```yaml
KAFKA_PROCESS_ROLES: broker,controller           # KRaft mode (no ZooKeeper needed)
KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1         # Single broker, so replication = 1
```
This uses KRaft mode (Kafka Raft), which eliminates the need for a separate ZooKeeper container. `ADVERTISED_LISTENERS` is set to `kafka:9092` because Docker containers communicate via the Docker network hostname `kafka`.

### Why Named Volumes?
```yaml
volumes:
  mongodb_data:     # MongoDB data persists
  redis_data:       # Redis AOF persists
  kafka_data:       # Kafka commit log persists
```
Without named volumes, `docker-compose down` would destroy all data. Named volumes persist across container lifecycle events.

### The Docker Network
```yaml
networks:
  vybe-network:
    driver: bridge
```
All containers are on the same virtual `bridge` network. This means `auth-service` can reach MongoDB at `mongodb:27017` using the container hostname, without exposing ports to the host machine.

---

## 6. How Kafka Works in This Project

### Topics
Two Kafka topics are used:
1. **`content-events`**: Produced by Content Service, consumed by Notification Service
   - Event types: `POST_LIKED`, `POST_COMMENTED`, `LOOP_LIKED`, `LOOP_COMMENTED`
2. **`user-events`**: Produced by User Service, consumed by Notification Service
   - Event types: `USER_FOLLOWED`

### Message Format
Every Kafka message has this JSON structure:
```json
{
    "eventType": "POST_LIKED",
    "timestamp": "2026-09-13T07:30:00.000Z",
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "postId": "64a1b2c3d4e5f6789abcdef0",
    "postOwnerId": "64a1b2c3d4e5f6789abcdef1",
    "userId": "64a1b2c3d4e5f6789abcdef2"
}
```

### Consumer Group
```javascript
const consumer = kafka.consumer({ groupId: 'notification-service-group' })
```
If you scale the Notification Service to 3 instances, all 3 join the same consumer group. Kafka distributes partitions across group members — each message is processed by exactly one instance.

### SASL/SSL for Confluent Cloud
```javascript
ssl: process.env.KAFKA_SSL === 'true',
sasl: process.env.KAFKA_SASL_USERNAME ? {
    mechanism: 'plain',
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD,
} : undefined,
```
In production, Confluent Cloud requires TLS encryption (`ssl: true`) and SASL PLAIN authentication. In local Docker dev, both are `undefined`/`false`.

---

## 7. How Redis Works in This Project

### Cache Keys Used

| Key Pattern | Service | TTL | Description |
|---|---|---|---|
| `user:profile:{userName}` | User Service | 300s (5 min) | Full user profile with populated posts/loops/followers |
| `posts:feed` | Content Service | 120s (2 min) | All posts sorted by newest, with populated authors/comments |

### Cache Invalidation Events

| Action | Keys Invalidated | Why |
|---|---|---|
| Edit profile | `user:profile:{userName}` | Profile data changed |
| Follow/Unfollow | `user:profile:{currentUser}`, `user:profile:{targetUser}` | Both users' follower/following counts changed |
| Upload post | `posts:feed` | New post should appear in feed |
| Like/Unlike post | `posts:feed` | Like count changed |
| Comment on post | `posts:feed` | Comments changed |
| Delete post | `posts:feed` | Post removed from feed |

### Graceful Degradation
Every Redis call is wrapped in try/catch. If Redis is down:
- Cache reads fail silently → code falls through to MongoDB
- Cache writes fail silently → data just isn't cached
- Cache deletes fail silently → stale data serves for up to TTL duration

The app never crashes due to Redis failure. It just gets slower.

---

## 8. Complete Data Flow Walkthroughs

### Flow 1: User Signs Up (Full Journey)

```
Browser                    API Gateway           Auth Service          MongoDB
  │                           │                      │                    │
  │ POST /api/auth/signup     │                      │                    │
  │ {name,email,userName,pw}  │                      │                    │
  │──────────────────────────>│                      │                    │
  │                           │ Proxy to :3001       │                    │
  │                           │─────────────────────>│                    │
  │                           │                      │ findOne({email})   │
  │                           │                      │───────────────────>│
  │                           │                      │    null (ok)       │
  │                           │                      │<───────────────────│
  │                           │                      │ findOne({userName})│
  │                           │                      │───────────────────>│
  │                           │                      │    null (ok)       │
  │                           │                      │<───────────────────│
  │                           │                      │ bcrypt.hash(pw,10) │
  │                           │                      │ User.create(...)   │
  │                           │                      │───────────────────>│
  │                           │                      │    user document   │
  │                           │                      │<───────────────────│
  │                           │                      │ jwt.sign(userId)   │
  │                           │  Set-Cookie: token=… │                    │
  │                           │<─────────────────────│                    │
  │  Set-Cookie: token=…      │                      │                    │
  │  201 { user }             │                      │                    │
  │<──────────────────────────│                      │                    │
```

### Flow 2: User Likes a Post (Async Notification via Kafka)

```
Browser       Gateway      Content Svc     MongoDB      Kafka     Notification Svc
  │              │              │              │           │              │
  │ GET like/:id │              │              │           │              │
  │─────────────>│ Proxy :3003  │              │           │              │
  │              │─────────────>│              │           │              │
  │              │              │ findById(id) │           │              │
  │              │              │─────────────>│           │              │
  │              │              │   post doc   │           │              │
  │              │              │<─────────────│           │              │
  │              │              │ push(userId) │           │              │
  │              │              │ post.save()  │           │              │
  │              │              │─────────────>│           │              │
  │              │              │              │           │              │
  │              │              │ publishEvent("POST_LIKED")              │
  │              │              │──────────────────────────>│              │
  │              │              │              │           │              │
  │              │              │ redis.del("posts:feed")  │              │
  │              │              │              │           │              │
  │  200 { post }│              │              │           │              │
  │<─────────────│<─────────────│              │           │              │
  │              │              │              │           │              │
  │   USER IS DONE. Response was instant.      │           │              │
  │              │              │              │           │              │
  │              │              │              │    [Background]          │
  │              │              │              │           │ Consume msg  │
  │              │              │              │           │─────────────>│
  │              │              │              │           │              │
  │              │              │              │           │ Check eventId│
  │              │              │              │           │ (idempotency)│
  │              │              │              │           │              │
  │              │              │              │ Notification.create()    │
  │              │              │              │<─────────────────────────│
```

### Flow 3: Real-Time Chat Message

```
Browser A (Sender)   Gateway    Messaging Svc    MongoDB    Messaging Svc (Socket)   Browser B
      │                 │             │              │              │                    │
      │ POST send/:id  │             │              │              │                    │
      │ {message}      │             │              │              │                    │
      │───────────────>│ Proxy :3004 │              │              │                    │
      │                │────────────>│              │              │                    │
      │                │             │ Message.create()             │                    │
      │                │             │─────────────>│              │                    │
      │                │             │              │              │                    │
      │                │             │ Conversation.findOrCreate() │                    │
      │                │             │─────────────>│              │                    │
      │                │             │              │              │                    │
      │                │             │ getSocketId(receiverId)     │                    │
      │                │             │────────────────────────────>│                    │
      │                │             │              │   socketId   │                    │
      │                │             │              │              │                    │
      │                │             │ io.to(socketId).emit("newMessage")               │
      │                │             │──────────────────────────────────────────────────>│
      │                │             │              │              │    Message appears  │
      │  200 {message} │             │              │              │    instantly!       │
      │<───────────────│<────────────│              │              │                    │
```

---

## 9. How Authentication Works Across Services

This is a **stateless, distributed authentication** system.

1. **Auth Service creates the token:** On signup/signin, it creates a JWT containing `{ userId }`, signed with `JWT_SECRET`.
2. **Browser stores the token:** The JWT is set as an `httpOnly` cookie. The browser automatically sends it with every request to the same domain.
3. **API Gateway forwards the cookie:** The proxy middleware explicitly copies the `cookie` header to downstream requests.
4. **Each service verifies independently:** Every service has its own copy of `isAuth.js` middleware that calls `jwt.verify(token, process.env.JWT_SECRET)`. It never calls the Auth Service.

**Why this works:** JWT is self-contained. The signature proves the token was created by someone who knows `JWT_SECRET`. If the secret is the same everywhere, any service can verify any token.

**Why not a centralized auth check?** If every request had to call the Auth Service to validate the token, the Auth Service would become a bottleneck and a single point of failure. Stateless verification distributes the load.

---

## 10. Performance: Why It Got Faster

### Read Operations (Feed, Profile, Loops) — Redis Impact

**Before (Monolith):** Every request hit MongoDB.
```
Request → Express → Mongoose.find() → MongoDB disk read → populate() → Response
                                       ~150ms
```

**After (Microservices + Redis):**
```
Request → Gateway → Content Service → Redis RAM read → Response
                                       ~15ms
```
Redis stores data in RAM. RAM access is ~1000x faster than disk access. The 2-5 minute TTL means we tolerate slightly stale data (a post uploaded 1 minute ago might not appear for up to 2 minutes).

### Write Operations (Like, Comment, Follow) — Kafka Impact

**Before (Monolith):**
```
Request → Update likes in MongoDB (50ms)
        → Create notification in MongoDB (40ms)
        → Emit socket event (5ms)
        → Response
        Total: ~95ms synchronous, under load: connection pool exhaustion → 38% errors
```

**After (Microservices + Kafka):**
```
Request → Update likes in MongoDB (50ms)
        → Publish event to Kafka (5ms, non-blocking)
        → Response
        Total: ~55ms
        [Background] Kafka → Notification Service → Create notification (whenever)
```
The user doesn't wait for the notification to be created. Kafka absorbs the burst and feeds events to the Notification Service at a pace it can handle.

---

## 11. Failure Scenarios & Resilience

| What Fails | Impact | How System Handles It |
|---|---|---|
| **Auth Service crashes** | Can't log in/sign up. Existing users stay logged in (JWT is client-side). | Other services unaffected. Gateway returns 502 for auth routes only. |
| **User Service crashes** | Can't edit profile, follow, or search. | Posts, messages, notifications still work. |
| **Content Service crashes** | Can't create/view posts, loops, stories. | Auth, messaging, notifications still work. |
| **Messaging Service crashes** | Can't send/receive messages. Online status disappears. | Everything else works. Messages sent while down are lost (no Kafka for messages). |
| **Notification Service crashes** | No new notifications created. | Kafka holds events. When service restarts, it catches up from last committed offset. **Zero event loss.** |
| **Redis crashes** | All cached data lost. Cache reads fail silently. | App falls back to MongoDB for every request. Slower but functional. |
| **Kafka crashes** | Events can't be published or consumed. | Producers catch the error and return the HTTP response anyway. Notifications won't be created until Kafka recovers. |
| **MongoDB crashes** | Complete data layer failure. All services fail to start. | This is the true single point of failure. Mitigation: MongoDB Atlas provides automated backups and replica sets. |
| **API Gateway crashes** | Frontend can't reach any backend service. | Complete outage. Mitigation: Render auto-restarts crashed services. |

---

## 12. Production Deployment Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────┐
│     Vercel       │     │              Render                      │
│  (Frontend)      │     │  ┌────────────────────────────────────┐  │
│                  │────>│  │         API Gateway               │  │
│  React + Vite    │     │  │    (Web Service, Docker)          │  │
│  VITE_SERVER_URL │     │  └──┬────┬────┬────┬────┬───────────┘  │
│  = gateway URL   │     │     │    │    │    │    │               │
└─────────────────┘     │     ▼    ▼    ▼    ▼    ▼               │
                         │  Auth  User Cont  Msg  Notif           │
                         │  Svc   Svc  Svc   Svc  Svc             │
                         │  (Docker × 5 separate Web Services)    │
                         └──────────────────────────────────────────┘
                                    │         │         │
                         ┌──────────┘    ┌────┘    ┌────┘
                         ▼               ▼         ▼
                   ┌──────────┐  ┌────────────┐  ┌──────────┐
                   │ MongoDB  │  │ Confluent  │  │  Upstash  │
                   │  Atlas   │  │   Cloud    │  │  Redis    │
                   │ (M0 Free)│  │  (Kafka)   │  │ (256MB)   │
                   └──────────┘  └────────────┘  └──────────┘
```

**Key production differences from local Docker:**
- MongoDB: Atlas cluster with TLS (`mongodb+srv://`) instead of local Docker container
- Redis: Upstash with TLS (`rediss://`) instead of local Docker container
- Kafka: Confluent Cloud with SASL/SSL instead of local Docker KRaft broker
- All services set `NODE_ENV=production` for cookie security

---

## 13. Design Tradeoffs We Made

| Decision | Alternative | Why We Chose This |
|---|---|---|
| Shared MongoDB | Per-service databases | Avoids distributed transactions and cross-service HTTP calls for `populate()`. Simpler at this scale. |
| Cache-Aside (lazy) | Write-Through cache | Simpler to implement. Write-Through would require updating Redis on every write, even when no one reads the data. |
| Kafka for notifications only | Kafka for all inter-service communication | Most operations (create post, send message) are request-response. Only notifications are truly fire-and-forget. |
| JWT in httpOnly cookie | JWT in localStorage / Authorization header | Cookies are automatically sent by the browser. localStorage requires manual header management and is vulnerable to XSS. |
| Single Kafka consumer group | Multiple consumer groups | We only have one notification service. Multiple consumer groups would process the same event multiple times. |
| 2-min feed cache TTL | Longer TTL or real-time invalidation | 2 minutes balances freshness and performance. Real-time invalidation would require Redis Pub/Sub across services. |

---

## 14. Interview Questions & Answers

### Architecture & System Design

**Q: Walk me through what happens when a user opens the Vybe app.**
> The browser loads the React app from Vercel's CDN. React's `useEffect` in `App.jsx` fires `getCurrentUser()`, which sends `GET /api/user/current` with the JWT cookie. This hits the API Gateway on Render, which proxies to the User Service. The User Service's `isAuth` middleware verifies the JWT, extracts `userId`, and queries MongoDB for the user document. If the user is authenticated, the frontend establishes a Socket.io connection through the Gateway to the Messaging Service for real-time features.

**Q: Why didn't you put each microservice on a different database?**
> We use a shared database pattern because our services have high read coupling — the Content Service needs to `populate("author")` on every post, which references the `users` collection. With separate databases, every post fetch would require an HTTP call to the User Service to resolve author data, adding ~50ms of network latency per request. At our scale, the simplicity of a shared database outweighs the theoretical benefits of data isolation.

**Q: How would you scale this system to handle 1 million users?**
> First, horizontal scaling: Render allows multiple instances per service, and Kafka's consumer groups automatically distribute load across instances. Second, database scaling: MongoDB Atlas supports sharding by `userId` to distribute writes. Third, caching: extend Redis caching to more endpoints and increase TTLs. Fourth, CDN: put Cloudinary's CDN URLs behind a global CDN for media. Fifth, consider moving from the API Gateway's `http-proxy-middleware` to a dedicated API gateway like Kong or AWS API Gateway.

### Kafka-Specific

**Q: What happens if a Kafka message is processed but the consumer crashes before committing the offset?**
> Kafka will redeliver the message on the next poll. This is "at-least-once" delivery. To handle this, we implemented idempotency at the application level: each event has a UUID `eventId`, and the Notification Service checks `Notification.findOne({ eventId })` before creating a new notification. As a second safety net, the `eventId` field has a `unique: true` index in MongoDB, so even race conditions are caught.

**Q: Why did you choose `fromBeginning: true` in the consumer subscription?**
> This ensures that when a new consumer group is created (first deploy or after a consumer group reset), it reads all historical events from the beginning of the topic. In our case, this means any notifications that were published while the Notification Service was down will be processed when it comes back up.

### Redis-Specific

**Q: Your Redis cache has a 2-minute TTL on the feed. Doesn't that mean users see stale data?**
> Yes, for up to 2 minutes after a new post is created. However, we also implement active cache invalidation — when a post is uploaded, liked, commented on, or deleted, we call `redisClient.del("posts:feed")` to immediately invalidate the cache. So in practice, stale data only occurs if the invalidation fails (Redis is down) or if the data changes via a path we haven't instrumented (manual DB edits).

**Q: What if Redis is down? Does the app crash?**
> No. Every Redis operation is wrapped in a try/catch that logs the error and falls through to the MongoDB query. The app degrades gracefully — it becomes slower (150ms instead of 15ms for reads) but remains fully functional.

### Security

**Q: How do you prevent CSRF attacks with `SameSite=None` cookies?**
> `SameSite=None` does make us vulnerable to CSRF in theory, because any website can now send requests that include our cookie. However, our API only accepts requests from a single `origin` (the Vercel frontend URL) via the CORS `origin` configuration. Browsers enforce CORS by blocking cross-origin requests from unauthorized origins before they reach the server. For additional protection, we could add CSRF tokens in the future.

**Q: Why httpOnly cookies instead of storing JWT in localStorage?**
> localStorage is accessible to any JavaScript running on the page, including injected scripts from XSS attacks. httpOnly cookies are completely invisible to JavaScript — `document.cookie` won't return them. This means even a successful XSS attack can't steal the authentication token.

### Docker

**Q: Why do you use `npm ci` instead of `npm install` in the Dockerfile?**
> `npm ci` (Clean Install) deletes `node_modules` and installs dependencies exactly as specified in `package-lock.json`. This ensures deterministic builds — the same Dockerfile always produces the same image regardless of when or where it's built. `npm install` might resolve to different minor/patch versions depending on when it runs.

**Q: What does `server.on('upgrade', wsProxy.upgrade)` do in the Gateway?**
> WebSocket connections start as HTTP requests with an `Upgrade: websocket` header. Node.js's HTTP server emits an `upgrade` event for these. This line tells the API Gateway to hand off WebSocket upgrade requests to the `wsProxy`, which forwards them to the Messaging Service. Without this, WebSocket connections would fail because the default Express handler doesn't know what to do with upgrade requests.

---

*This document was generated from a complete analysis of every source file in the New Vybe codebase. Last updated: 13 September 2026.*
