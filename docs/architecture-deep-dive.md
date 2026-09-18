# 🏗️ VYBE — Complete Microservices Study Guide (From Absolute Scratch)

> **This guide assumes you know NOTHING about microservices. We will teach you every concept, every technology, every file, and every data flow used in the New Vybe microservices architecture from the very beginning. If you can explain everything in this document, you can ace any interview about this project.**

---

# 📚 TABLE OF CONTENTS

1. [Part 1: New Concepts You Need to Know](#part-1-new-concepts-you-need-to-know) — Microservices, API Gateway, Docker, Kafka, Redis
2. [Part 2: Why We Migrated from Monolith](#part-2-why-we-migrated-from-monolith-to-microservices)
3. [Part 3: Architecture Overview](#part-3-architecture-overview) — The big picture with diagrams
4. [Part 4: Project Structure](#part-4-project-structure) — Every folder and file explained
5. [Part 5: Backend — Every Service Explained](#part-5-backend--every-service-explained)
6. [Part 6: Frontend — Every File Explained](#part-6-frontend--every-file-explained)
7. [Part 7: Complete Data Flows](#part-7-complete-data-flows) — Step-by-step for every feature
8. [Part 8: How Key Technologies Work](#part-8-how-key-technologies-work-in-this-project)
9. [Part 9: Performance — Before vs After](#part-9-performance--before-vs-after)
10. [Part 10: Failure Scenarios & Resilience](#part-10-failure-scenarios--resilience)
11. [Part 11: Production Deployment](#part-11-production-deployment-architecture)
12. [Part 12: Design Tradeoffs](#part-12-design-tradeoffs-we-made)
13. [Part 13: Interview Questions & Answers](#part-13-interview-questions--answers)

---

# Part 1: New Concepts You Need to Know

> **If you already read the monolith study guide**, you know React, Node, Express, MongoDB, Mongoose, Socket.IO, JWT, and Cloudinary. This section covers the **NEW** technologies we added when converting to microservices.

## 1.1 What is a Microservice?

**Simple explanation:** Instead of one big server that does everything (a "monolith"), you split your app into multiple small servers, each doing ONE job.

Think of it like a restaurant:

| Monolith | Microservices |
|----------|--------------|
| One chef who cooks, serves food, handles payments, and cleans tables | A cook, a waiter, a cashier, and a cleaner — each doing their own job |
| If the chef gets sick, the entire restaurant shuts down | If the cashier calls in sick, the kitchen still runs |
| To handle more customers, you need to hire another full chef | You can just hire an extra waiter if service is slow |

**In Vybe:**

| Old Monolith (1 server) | New Microservices (6 servers) |
|------------------------|-------------------------------|
| `backend/index.js` handled auth, posts, messages, notifications, sockets — everything | Auth Service handles ONLY login/signup |
| | User Service handles ONLY profiles/follow |
| | Content Service handles ONLY posts/loops/stories |
| | Messaging Service handles ONLY chat/sockets |
| | Notification Service handles ONLY notifications |
| | API Gateway routes traffic to the right service |

## 1.2 What is an API Gateway?

**Simple explanation:** A "front door" that the frontend talks to. It receives all requests and forwards them to the correct microservice.

```
Without Gateway:                      With Gateway:
Frontend must know                    Frontend only knows ONE URL
about ALL services:

Frontend → Auth (:3001)               Frontend → API Gateway (:8000)
Frontend → User (:3002)                              ├→ Auth (:3001)
Frontend → Content (:3003)                           ├→ User (:3002)
Frontend → Messaging (:3004)                         ├→ Content (:3003)
Frontend → Notification (:3005)                      ├→ Messaging (:3004)
                                                     └→ Notification (:3005)
(5 different URLs! Messy!)            (1 URL! Clean!)
```

**Why this matters:** The frontend code doesn't need to change at all. It still calls `http://localhost:8000/api/auth/signup` — it has NO IDEA that 6 different servers exist behind the gateway. The gateway is invisible to the user.

## 1.3 What is Docker?

**Simple explanation:** Docker packages your app + its dependencies into a "container" — like a shipping container for software. The container runs exactly the same way on every computer.

**The problem Docker solves:**
```
Developer A: "It works on my machine!"
Developer B: "Well, it crashes on mine."
Developer A: "Do you have Node 22? Did you install Redis? Is MongoDB running?"
```

**With Docker:**
```
Developer A: "Run docker compose up"
Developer B: "Done. Everything works."
```

Docker automatically downloads and runs Node.js, MongoDB, Redis, and Kafka — all with the exact right versions, on any computer.

**Key Docker concepts used in Vybe:**

| Concept | What It Is | Example in Vybe |
|---------|-----------|-----------------|
| **Image** | A snapshot of your app (like a blueprint) | `node:22-alpine` is the base image for all services |
| **Container** | A running instance of an image (like a building from the blueprint) | Each service runs in its own container |
| **Dockerfile** | Instructions to build an image | Each service has one — installs deps, copies code |
| **docker-compose.yml** | A file that defines ALL your containers and how they connect | Defines all 6 services + MongoDB + Redis + Kafka |
| **Volume** | Persistent storage that survives container restarts | `mongodb_data`, `redis_data`, `kafka_data` |
| **Network** | A virtual network connecting containers | `vybe-network` lets all services talk to each other |

## 1.4 What is Apache Kafka?

**Simple explanation:** Kafka is a message queue — it lets one service send a message to another service without waiting for a response. Think of it like a mailbox.

**The problem Kafka solves:**

In the monolith, when you liked a post:
```
1. Update likes in MongoDB     (50ms)
2. Create notification in MongoDB (40ms)  ← USER WAITS for this!
3. Emit socket event            (5ms)
4. Send response to user        
Total: ~95ms — user waits for ALL steps
```

With Kafka in microservices:
```
1. Update likes in MongoDB     (50ms)
2. Drop a message in Kafka     (5ms)   ← Just "mail a letter", don't wait!
3. Send response to user
Total: ~55ms — user is DONE

[Later, in the background...]
4. Notification Service reads the Kafka message
5. Creates notification in MongoDB
(User doesn't wait for steps 4-5!)
```

**How Kafka works (simple version):**

```
                    ┌──────────────────┐
 Content Service    │      KAFKA       │    Notification Service
 (Producer)    ──→  │  ┌────────────┐  │  ←── (Consumer)
 "Hey, someone      │  │ content-   │  │      "Oh! Let me create
  liked a post!"    │  │ events     │  │       a notification..."
                    │  │ topic      │  │
 User Service  ──→  │  ├────────────┤  │
 "Hey, someone      │  │ user-      │  │
  followed a user!" │  │ events     │  │
                    │  │ topic      │  │
                    │  └────────────┘  │
                    └──────────────────┘
```

**Key Kafka terms:**

| Term | What It Means | In Vybe |
|------|-------------|---------|
| **Topic** | A category/channel for messages | `content-events`, `user-events` |
| **Producer** | A service that SENDS messages | Content Service, User Service |
| **Consumer** | A service that READS messages | Notification Service |
| **Message** | The data sent (JSON) | `{ eventType: "POST_LIKED", postId: "...", userId: "..." }` |
| **Consumer Group** | Multiple consumers sharing the workload | `notification-service-group` |
| **Offset** | A bookmark — "I've read up to message #47" | Prevents re-processing messages |

## 1.5 What is Redis?

**Simple explanation:** Redis is a super-fast database that stores data in RAM (computer memory) instead of on disk. It's ~10x faster than MongoDB for reads.

**The problem Redis solves:**

Every time someone opens the Vybe feed, the server runs this MongoDB query:
```javascript
Post.find({}).populate("author").populate("comments.author").sort({ createdAt: -1 })
```
This takes ~150ms because MongoDB reads from disk, joins data from multiple collections, and sorts.

**With Redis caching:**
```
First request:  Redis empty → query MongoDB (150ms) → save result in Redis → respond
Second request: Redis has data → return instantly (15ms) → skip MongoDB entirely!
Third request:  Redis has data → return instantly (15ms)
...
After 2 minutes: Redis data expires → next request queries MongoDB again
```

**Think of it like this:**
- MongoDB = Filing cabinet in the basement (slow but holds everything)
- Redis = Sticky note on your desk (super fast but temporary)

**Redis in Vybe is used for exactly 2 things:**

| What's Cached | Cache Key | How Long (TTL) | Why |
|--------------|-----------|----------------|-----|
| All posts feed | `posts:feed` | 2 minutes | Feed query is expensive (sort + populate) |
| User profiles | `user:profile:{userName}` | 5 minutes | Profile query populates posts/loops/followers |

## 1.6 Quick Refresher — Technologies from the Monolith

If you haven't read the monolith study guide, here's a one-line summary of each:

| Technology | What It Does | In Vybe |
|-----------|-------------|---------|
| **Node.js** | Runs JavaScript on a server (outside the browser) | Every backend service runs on Node.js |
| **Express** | Framework to build web servers easily | Every service uses Express for HTTP routes |
| **MongoDB** | NoSQL database — stores data as JSON-like documents | Stores users, posts, loops, stories, messages, notifications |
| **Mongoose** | Library to define data schemas and query MongoDB | All services use Mongoose models |
| **React** | JavaScript library for building UI components | The entire frontend |
| **Redux** | State management — stores app data accessible from any component | User data, posts, messages, socket, notifications |
| **Socket.IO** | Real-time two-way communication (WebSockets) | Chat messages, online presence |
| **JWT** | JSON Web Token — proves "I am logged in" without re-entering password | Stored in httpOnly cookie, verified by all services |
| **Cloudinary** | Cloud service that stores uploaded images/videos | Profile pics, post media, story media, message images |
| **Axios** | Library to make HTTP requests from frontend to backend | Every API call from React |
| **Bcrypt** | Hashes passwords so they can't be read if stolen | Passwords stored as `$2b$10$...` |
| **Multer** | Express middleware that handles file uploads | Receives images/videos from frontend |
| **Nodemailer** | Sends emails from Node.js | OTP emails for password reset |

---

# Part 2: Why We Migrated from Monolith to Microservices

## 2.1 The Original Monolith

The old Vybe was a single Express.js server ([`backend/index.js`](file:///c:/Users/krish/.vscode/new_vybe/docs/current-architecture.md)) that handled everything — auth, posts, messages, notifications, socket connections — in one process.

This worked fine for development but had critical production problems:

### Problem 1: Single Point of Failure
If the notification code threw an unhandled exception, the **entire server crashed**. Users couldn't log in, couldn't view posts, couldn't message — everything went down.

### Problem 2: Resource Contention
When 100 users liked posts simultaneously, the monolith had to:
1. Update the `likes` array in MongoDB
2. Create a notification document in MongoDB
3. Emit a Socket.io event to the receiver
4. Respond to the user

Steps 1-3 all competed for the *same* MongoDB connection pool and the *same* Node.js event loop. Under load, the connection pool maxed out, causing a **38.86% error rate** on the like endpoint (from our k6 benchmarks).

### Problem 3: No Independent Scaling
The messaging service handles WebSocket connections (long-lived, memory-intensive). The content service handles image uploads (CPU/bandwidth-intensive). In a monolith, you can't scale one without scaling the other.

## 2.2 Before vs After Comparison

| Aspect | Monolith (Before) | Microservices (After) |
|--------|-------------------|----------------------|
| **Server count** | 1 Express server | 6 independent services |
| **Crash impact** | Everything goes down | Only the crashed service is affected |
| **Like endpoint errors** | 38.86% under load | 0% (Kafka decouples notification) |
| **Feed response time** | ~150ms (always MongoDB) | ~15ms (Redis cache hit) |
| **Like response time** | ~95ms (waits for notification) | ~55ms (Kafka is non-blocking) |
| **Notification processing** | Synchronous (blocks user) | Asynchronous (background via Kafka) |
| **Scaling** | Duplicate entire server | Scale individual services |

## 2.3 The Solution

Split the monolith into **6 independent services**, each with its own process, its own Express server, and its own responsibility. Add **Redis** to cache frequently-read data and **Kafka** to decouple write-heavy operations.

---

# Part 3: Architecture Overview

## 3.1 The Big Picture

1. **Frontend (Browser):** Built with React/Vite, hosted on Vercel. Manages state via Redux and connects to the backend via Axios (HTTP) and Socket.IO (WebSockets).
2. **API Gateway (Port 8000):** The single entry point. Handles security, rate limiting, and proxies requests to the appropriate microservice based on the URL path.
3. **Backend Microservices:**
   - **Auth Service (Port 3001):** Handles login/signup. Connects to MongoDB and Gmail SMTP.
   - **User Service (Port 3002):** Profiles & follow system. Connects to MongoDB, Redis (caching), and Kafka (producing events).
   - **Content Service (Port 3003):** Posts, loops, & stories. Connects to MongoDB, Redis, Kafka, and Cloudinary.
   - **Messaging Service (Port 3004):** Real-time chat. Connects to MongoDB, Cloudinary, and runs the Socket.IO server.
   - **Notification Service (Port 3005):** Background worker. Consumes Kafka events and saves notifications to MongoDB.
4. **Infrastructure:**
   - **MongoDB Atlas:** Shared database storing all persistent data.
   - **Redis Cache:** Fast-access storage for feed caches and user profiles.
   - **Apache Kafka:** Message broker handling asynchronous events between services.
   - **Cloudinary:** External CDN for uploaded media.

## 3.2 Detailed ASCII Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      FRONTEND (React + Vite)                                     │
│                                    Hosted on Vercel (HTTPS)                                       │
│                               https://new-vybe.vercel.app                                        │
│                                                                                                  │
│   Pages: SignIn · SignUp · Home (Feed) · Profile · Messages · Explore · Loops · Stories           │
│   State: Redux (auth, messages, notifications)                                                   │
│   Real-time: Socket.io client → /socket.io/*                                                     │
└──────────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                       │
                          HTTP REST + WebSocket (wss://)
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY (Express) — Port 8000                                   │
│                              The ONLY service exposed to the internet                            │
│                                                                                                  │
│   Middleware Pipeline:                                                                           │
│   ┌──────────┐  ┌────────────────────┐  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│   │  Helmet   │→│  Rate Limiter      │→│   CORS     │→│ Cookie Parser│→│ http-proxy-       │  │
│   │(security │  │ Global: 2000/15min │  │(Vercel     │  │(forwards JWT│  │ middleware        │  │
│   │ headers) │  │ Auth:   500/15min  │  │ origin)    │  │ cookies)    │  │(route → service)  │  │
│   └──────────┘  └────────────────────┘  └────────────┘  └──────────────┘  └───────────────────┘  │
│                                                                                                  │
│   Route Map:                                                                                     │
│   /api/auth/*            ──→  Auth Service         (:3001)                                       │
│   /api/user/*            ──→  User Service         (:3002)                                       │
│   /api/post/*            ──→  Content Service      (:3003)                                       │
│   /api/loop/*            ──→  Content Service      (:3003)                                       │
│   /api/story/*           ──→  Content Service      (:3003)                                       │
│   /api/message/*         ──→  Messaging Service    (:3004)                                       │
│   /api/notifications/*   ──→  Notification Service (:3005)                                       │
│   /socket.io/*           ──→  Messaging Service    (:3004)  [WebSocket upgrade]                  │
└───┬──────────┬───────────┬───────────┬──────────────┬────────────────────────────────────────────┘
    │          │           │           │              │
    ▼          ▼           ▼           ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│  AUTH  │ │  USER  │ │ CONTENT  │ │MESSAGING │ │ NOTIFICATION │
│ :3001  │ │ :3002  │ │  :3003   │ │  :3004   │ │    :3005     │
│        │ │        │ │          │ │          │ │              │
│ Signup │ │ Get    │ │ Posts    │ │ Socket.io│ │ Kafka        │
│ Login  │ │ Profile│ │ Loops    │ │ Server   │ │ Consumer     │
│ Logout │ │ Edit   │ │ Stories  │ │          │ │              │
│ Verify │ │ Follow │ │ Like     │ │ 1:1 Chat │ │ Processes:   │
│        │ │ Search │ │ Comment  │ │ Online   │ │ POST_LIKED   │
│ JWT    │ │        │ │ Upload   │ │ Presence │ │ POST_COMMENT │
│ Issuer │ │        │ │ (Multer +│ │          │ │ LOOP_LIKED   │
│        │ │        │ │Cloudinary│ │ Events:  │ │ LOOP_COMMENT │
│        │ │        │ │          │ │ newMsg   │ │ USER_FOLLOWED│
│        │ │        │ │          │ │ onlineUsr│ │              │
└────┬───┘ └───┬────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
     │         │           │            │               │
     ▼         ▼           ▼            ▼               ▼
┌──────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                           │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Redis  │  │  Redis  │  │    KAFKA     │  │   MongoDB    │  │
│  │ (Cache) │  │(Presence│  │              │  │   Atlas      │  │
│  │         │  │  Hash)  │  │ content-     │  │              │  │
│  │ posts:  │  │         │  │  events      │  │ Collections: │  │
│  │  feed   │  │ online: │  │ user-events  │  │ users, posts │  │
│  │ user:   │  │  users  │  │              │  │ loops,stories│  │
│  │ profile │  │         │  │ Producers:   │  │ conversations│  │
│  │         │  │         │  │  Content Svc │  │ messages     │  │
│  │ TTL:    │  │         │  │  User Svc    │  │ notifications│  │
│  │ 2-5 min │  │         │  │ Consumer:    │  │              │  │
│  │         │  │         │  │  Notif. Svc  │  │              │  │
│  └─────────┘  └─────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## 3.3 What Talks to What?

| Service | MongoDB | Redis | Kafka (Produce) | Kafka (Consume) | Socket.IO | Cloudinary | Gmail |
|---------|---------|-------|-----------------|-----------------|-----------|------------|-------|
| API Gateway | ✗ | ✗ | ✗ | ✗ | ✗ (proxy only) | ✗ | ✗ |
| Auth Service | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| User Service | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Content Service | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Messaging Service | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Notification Service | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |

---

# Part 4: Project Structure

## 4.1 Complete Folder Tree

```
new_vybe/
├── docker-compose.yml           → Defines ALL containers (MongoDB, Redis, Kafka, 6 services)
├── .env.example                 → Template for environment variables
├── services/
│   ├── api-gateway/             → The front door (Port 8000)
│   │   ├── Dockerfile
│   │   ├── index.js             → Helmet, CORS, rate limiting, proxy routes
│   │   └── package.json
│   │
│   ├── auth-service/            → Login/Signup (Port 3001)
│   │   ├── Dockerfile
│   │   ├── index.js             → Entry point, connects to MongoDB
│   │   ├── config/
│   │   │   ├── token.js         → JWT generation (jwt.sign)
│   │   │   ├── Mail.js          → Nodemailer SMTP for OTP emails
│   │   │   └── db.js            → MongoDB connection
│   │   ├── controllers/
│   │   │   └── auth.controllers.js → signUp, signIn, signOut, sendOtp, verifyOtp, resetPassword
│   │   ├── middlewares/
│   │   │   ├── isAuth.js        → JWT verification middleware
│   │   │   └── multer.js        → File upload handler
│   │   ├── models/
│   │   │   └── user.model.js    → User schema (shared across services)
│   │   └── routes/
│   │       └── auth.routes.js   → POST /signup, /signin, /signout, /sendOtp, etc.
│   │
│   ├── user-service/            → Profiles & Follow (Port 3002)
│   │   ├── Dockerfile
│   │   ├── index.js             → Connects to MongoDB + Redis + Kafka producer
│   │   ├── config/
│   │   │   ├── redis.js         → Redis client (ioredis) with retry strategy
│   │   │   └── cloudinary.js    → Upload/delete media
│   │   ├── controllers/
│   │   │   └── user.controllers.js → getProfile (cached), editProfile, follow, search
│   │   ├── middlewares/
│   │   │   ├── isAuth.js        → JWT verification (same logic, own copy)
│   │   │   └── multer.js
│   │   ├── models/
│   │   │   └── user.model.js
│   │   ├── routes/
│   │   │   └── user.routes.js
│   │   └── utils/kafka/
│   │       └── producer.js      → Publishes USER_FOLLOWED events
│   │
│   ├── content-service/         → Posts, Loops, Stories (Port 3003)
│   │   ├── Dockerfile
│   │   ├── index.js             → Connects to MongoDB + Redis + Kafka producer
│   │   ├── config/
│   │   │   ├── redis.js         → Redis client for feed caching
│   │   │   └── cloudinary.js
│   │   ├── controllers/
│   │   │   ├── post.controllers.js  → upload, getAll (cached), like, comment, delete, save
│   │   │   ├── loop.controllers.js  → upload, getAll, like, comment
│   │   │   └── story.controllers.js → upload, getAll, getByUser, viewStory
│   │   ├── models/
│   │   │   ├── post.model.js
│   │   │   ├── loop.model.js
│   │   │   ├── story.model.js
│   │   │   └── user.model.js    → Needed for populate() and user arrays
│   │   ├── routes/
│   │   │   ├── post.routes.js
│   │   │   ├── loop.routes.js
│   │   │   └── story.routes.js
│   │   └── utils/kafka/
│   │       └── producer.js      → Publishes POST_LIKED, POST_COMMENTED, etc.
│   │
│   ├── messaging-service/       → Chat & Sockets (Port 3004)
│   │   ├── Dockerfile
│   │   ├── index.js             → Connects to MongoDB, starts HTTP+Socket server
│   │   ├── socket.js            → Socket.IO server, auth middleware, userSocketMap
│   │   ├── config/
│   │   │   └── cloudinary.js
│   │   ├── controllers/
│   │   │   └── message.controllers.js → sendMessage, getAllMessages, getPrevChats
│   │   ├── models/
│   │   │   ├── conversation.model.js
│   │   │   ├── message.model.js
│   │   │   └── user.model.js
│   │   ├── middlewares/
│   │   │   ├── isAuth.js
│   │   │   └── multer.js
│   │   └── routes/
│   │       └── message.routes.js
│   │
│   ├── notification-service/    → Background Notifications (Port 3005)
│   │   ├── Dockerfile
│   │   ├── index.js             → Starts Kafka consumer + HTTP server
│   │   ├── consumers/
│   │   │   └── notificationConsumer.js → Kafka consumer logic with idempotency
│   │   ├── controllers/
│   │   │   └── notification.controllers.js → getAll, markAsRead
│   │   ├── models/
│   │   │   ├── notification.model.js → Has unique eventId for idempotency
│   │   │   └── user.model.js
│   │   ├── routes/
│   │   │   └── notification.routes.js
│   │   └── utils/kafka/
│   │       └── consumer.js      → Kafka consumer connection + message handling
│   │
│   └── shared/
│       └── events.js            → Shared Kafka event type constants
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx             → Entry point (BrowserRouter + Redux Provider)
│   │   ├── App.jsx              → Routes + Socket.IO setup + all data fetching hooks
│   │   ├── redux/
│   │   │   ├── store.js         → Combines all slices
│   │   │   ├── userSlice.js     → userData, suggestedUsers, following, notifications
│   │   │   ├── postSlice.js     → postData (all posts)
│   │   │   ├── loopSlice.js     → loopData (all loops)
│   │   │   ├── storySlice.js    → storyData, storyList, currentUserStory
│   │   │   ├── messageSlice.js  → selectedUser, messages, prevChatUsers
│   │   │   └── socketSlice.js   → socket instance, onlineUsers
│   │   ├── hooks/               → 8 custom hooks that fetch data on mount
│   │   │   ├── getCurrentUser.jsx
│   │   │   ├── getSuggestedUsers.jsx
│   │   │   ├── getAllPost.jsx
│   │   │   ├── getAllLoops.jsx
│   │   │   ├── getAllStories.jsx
│   │   │   ├── getFollowingList.jsx
│   │   │   ├── getPrevChatUsers.jsx
│   │   │   └── getAllNotifications.jsx
│   │   ├── pages/               → 13 page components
│   │   │   ├── SignUp.jsx, SignIn.jsx, ForgotPassword.jsx
│   │   │   ├── Home.jsx, Profile.jsx, EditProfile.jsx
│   │   │   ├── Upload.jsx, Loops.jsx, Story.jsx
│   │   │   ├── Messages.jsx, MessageArea.jsx
│   │   │   ├── Search.jsx, Notifications.jsx
│   │   └── components/          → 15 reusable components
│   │       ├── Feed.jsx, LeftHome.jsx, RightHome.jsx, Nav.jsx
│   │       ├── Post.jsx, LoopCard.jsx, StoryDp.jsx, StoryCard.jsx
│   │       ├── VideoPlayer.jsx, FollowButton.jsx
│   │       ├── OtherUser.jsx, OnlineUser.jsx
│   │       ├── SenderMessage.jsx, ReceiverMessage.jsx
│   │       └── NotificationCard.jsx
│   └── package.json
│
├── tests/                       → k6 performance tests
└── docs/                        → Architecture & deployment docs
```

---

# Part 5: Backend — Every Service Explained

## 5.1 Service 1: API Gateway ([`services/api-gateway/`](file:///c:/Users/krish/.vscode/new_vybe/services/api-gateway))

The API Gateway is the **only service exposed to the internet**. The frontend talks to `https://vybe-api-gateway.onrender.com` and nothing else.

### What It Does

Think of it as a **security guard + receptionist** at a hospital:
1. Checks your ID (rate limiting — are you making too many requests?)
2. Checks if you're allowed in (CORS — are you coming from our website?)
3. Reads your appointment slip (cookie parsing — extracts your JWT)
4. Sends you to the right department (proxy — routes to the correct service)

### How Requests Flow Through the Gateway

```
Browser Request: POST /api/auth/signup
        │
        ▼
   ┌─────────────┐
   │   Helmet     │  Adds security headers (X-Frame-Options, etc.)
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │ Rate Limiter │  Is this IP under 2000 requests? (500 for auth routes)
   └──────┬──────┘  If over limit → 429 Too Many Requests
          ▼
   ┌─────────────┐
   │    CORS      │  Is this from our Vercel domain? 
   └──────┬──────┘  If not → blocked by browser
          ▼
   ┌─────────────┐
   │Cookie Parser │  Extract cookies from request headers
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │  Proxy       │  URL starts with /api/auth → forward to Auth Service (:3001)
   └──────┬──────┘
          ▼
   Auth Service receives the request as if the browser sent it directly
```

### Key Code Explained

**Rate Limiting** ([`index.js`](file:///c:/Users/krish/.vscode/new_vybe/services/api-gateway/index.js)):
```javascript
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,        // 15-minute window
    max: 2000,                        // 2000 requests per IP per window
})
const authLimiter = rateLimit({       // Stricter limit for auth endpoints
    max: 500,                         // Only 500 login attempts per 15 min
})
```
**Why stricter for auth?** Login/signup are the primary targets for brute-force attacks. An attacker trying to guess passwords would hammer `/api/auth/signin`.

**CORS Configuration:**
```javascript
app.use(cors({
    origin: process.env.FRONTEND_URL, // Only allow requests from our Vercel domain
    credentials: true                  // Allow cookies to be sent cross-origin
}))
```
`credentials: true` is critical. Without it, the browser will **not** send the JWT cookie with requests from `vercel.app` to `onrender.com`.

**The Proxy Routes:**
```
/api/auth/*                  → Auth Service (:3001)
/api/user/*                  → User Service (:3002)
/api/post/*, /api/loop/*, /api/story/*  → Content Service (:3003)
/api/message/*               → Messaging Service (:3004)
/api/notifications/*         → Notification Service (:3005)
/socket.io/*                 → Messaging Service (:3004) [WebSocket upgrade]
```

**WebSocket Upgrade:**
```javascript
server.on('upgrade', wsProxy.upgrade)
```
WebSocket connections start as HTTP requests with an `Upgrade: websocket` header. This line tells the server to hand off WebSocket upgrade requests to the messaging proxy.

---

## 5.2 Service 2: Auth Service ([`services/auth-service/`](file:///c:/Users/krish/.vscode/new_vybe/services/auth-service))

**Responsibility:** User registration, login, logout, OTP-based password reset.
**Connects to:** MongoDB only. No Redis. No Kafka. This is the simplest service.

### How JWT Authentication Works (Step by Step)

```
Step 1: User signs up or signs in
        ↓
Step 2: Auth Service creates a JWT: jwt.sign({ userId: "123" }, SECRET)
        ↓
Step 3: Auth Service puts this token in a COOKIE and sends it to the browser
        ↓
Step 4: On EVERY future request, the browser automatically sends this cookie
        ↓
Step 5: The isAuth middleware in ANY service reads the cookie, verifies the JWT,
        extracts the userId, and attaches it to req.userId
        ↓
Step 6: The controller function now knows WHO is making the request
```

### Key Code Explained

**Cookie Configuration** ([`auth.controllers.js`](file:///c:/Users/krish/.vscode/new_vybe/services/auth-service/controllers/auth.controllers.js)):
```javascript
const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER
const cookieOptions = {
    httpOnly: true,              // JavaScript can't read this cookie (XSS protection)
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000,  // 10 years
    secure: isProduction,         // Only sent over HTTPS in production
    sameSite: isProduction ? "none" : "lax",  // "none" allows cross-origin
    ...(isProduction && { partitioned: true })
}
```

| Option | What It Does | Why |
|--------|-------------|-----|
| `httpOnly: true` | JavaScript can't read `document.cookie` | Prevents XSS attacks from stealing your token |
| `secure: true` | Cookie only sent over HTTPS | Prevents interception on insecure connections |
| `sameSite: "none"` | Cookie sent to different domains | Frontend (vercel.app) and backend (onrender.com) are different domains |
| `partitioned: true` | Chrome's CHIPS requirement | New browser privacy feature for cross-site cookies |

**SignUp Flow** ([`auth.controllers.js`](file:///c:/Users/krish/.vscode/new_vybe/services/auth-service/controllers/auth.controllers.js)):
```javascript
export const signUp = async (req, res) => {
    const { name, email, password, userName } = req.body

    // 1. Check if email already exists
    const findByEmail = await User.findOne({ email })
    if (findByEmail) return res.status(400).json({ message: "Email already exist !" })

    // 2. Check if username already exists
    const findByUserName = await User.findOne({ userName })
    if (findByUserName) return res.status(400).json({ message: "UserName already exist !" })

    // 3. Hash the password (bcrypt with 10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10)

    // 4. Create user in MongoDB
    const user = await User.create({ name, userName, email, password: hashedPassword })

    // 5. Generate JWT token
    const token = await genToken(user._id)

    // 6. Set cookie and respond
    res.cookie("token", token, cookieOptions)
    return res.status(201).json(user)
}
```

**OTP Password Reset Flow:**
```
1. User enters email → POST /api/auth/sendOtp
   Server: Generate 4-digit OTP → Save to user.resetOtp → Email OTP via Gmail SMTP

2. User enters OTP → POST /api/auth/verifyOtp
   Server: Check user.resetOtp === submitted OTP AND user.otpExpires > now

3. User enters new password → POST /api/auth/resetPassword
   Server: Check user.isOtpVerified === true → Hash new password → Save
```

> [!IMPORTANT]
> **Critical Design Decision:** The `JWT_SECRET` must be **identical** across all 6 services. The Auth Service *creates* the token, but every other service *verifies* it independently using the same secret. If the secrets differ, authentication breaks silently.

---

## 5.3 Service 3: User Service ([`services/user-service/`](file:///c:/Users/krish/.vscode/new_vybe/services/user-service))

**Responsibility:** Profile management, follow/unfollow, user search, suggested users.
**Connects to:** MongoDB, Redis (caching), Kafka (produces `USER_FOLLOWED` events).

### Startup Sequence

```javascript
// services/user-service/index.js
await mongoose.connect(process.env.MONGODB_URL)  // 1. Database first
await connectProducer()                            // 2. Then Kafka producer
await connectRedis()                               // 3. Then Redis
app.listen(port, ...)                              // 4. Finally start HTTP server
```
**Order matters:** MongoDB must connect before we start accepting requests, or the first request would fail.

### Redis Caching — The Cache-Aside Pattern

This is the most important pattern to understand. Here's how `getProfile` works:

```javascript
// controllers/user.controllers.js — getProfile
export const getProfile = async (req, res) => {
    const { userName } = req.params
    const cacheKey = `user:profile:${userName}`

    // STEP 1: Try Redis first (fast path)
    try {
        const cachedData = await redisClient.get(cacheKey)
        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData))  // ← Cache HIT! ~15ms
        }
    } catch (redisError) {
        console.error("[User Service] Redis get failed:", redisError.message)
        // If Redis is down, just continue to MongoDB
    }

    // STEP 2: Cache MISS → Query MongoDB (slow path, ~150ms)
    const user = await User.findOne({ userName })
        .populate("posts").populate("loops").populate("followers").populate("following")

    // STEP 3: Save result in Redis for next time (5-minute TTL)
    try {
        await redisClient.setex(cacheKey, 300, JSON.stringify(user))
    } catch (redisError) {
        console.error("[User Service] Redis set failed:", redisError.message)
    }

    return res.status(200).json(user)
}
```

**Visual flow:**
```
Request for profile "krishan"
        │
        ▼
   Redis: GET user:profile:krishan
        │
   ┌────┴────┐
   │         │
 HIT ✓    MISS ✗
   │         │
   │    MongoDB query (150ms)
   │    + Save to Redis
   │         │
   ▼         ▼
 Return data (15ms vs 150ms)
```

### Cache Invalidation

When data changes, we **delete** the cache so the next request gets fresh data:

```javascript
// When a user edits their profile:
await redisClient.del(`user:profile:${user.userName}`)

// When a user follows someone (both profiles change):
await redisClient.del(`user:profile:${currentUser.userName}`)
await redisClient.del(`user:profile:${targetUser.userName}`)
```

### Follow + Kafka Event

When User A follows User B:
```javascript
// controllers/user.controllers.js — follow
const eventId = uuidv4()                          // Generate unique ID
publishEvent("user-events", "USER_FOLLOWED", {     // Send to Kafka
    eventId,
    followerId: currentUser._id,
    followedUserId: targetUser._id
})
```

The function returns **immediately** — it doesn't wait for the notification to be created. The Notification Service picks up this message from Kafka in the background and creates the "started following you" notification.

### API Routes

```
GET  /api/user/current          → isAuth → getCurrentUser
GET  /api/user/getProfile/:userName → isAuth → getProfile (Redis cached)
GET  /api/user/suggested        → isAuth → getSuggestedUsers
GET  /api/user/search/:query    → isAuth → searchUsers
POST /api/user/editProfile      → isAuth → multer → editProfile
GET  /api/user/follow/:targetUserId → isAuth → follow (Kafka event)
GET  /api/user/followingList    → isAuth → getFollowingList
```

---

## 5.4 Service 4: Content Service ([`services/content-service/`](file:///c:/Users/krish/.vscode/new_vybe/services/content-service))

**Responsibility:** Posts, Loops (short videos), Stories. The heaviest service.
**Connects to:** MongoDB, Redis (caching), Kafka (produces events), Cloudinary (media).

### Post Upload Flow

```javascript
// controllers/post.controllers.js — uploadPost
export const uploadPost = async (req, res) => {
    const { caption, mediaType } = req.body

    // 1. Upload file to Cloudinary (Multer already saved it temporarily)
    let media = await uploadOnCloudinary(req.file.path)

    // 2. Create post in MongoDB
    const post = await Post.create({ caption, media, mediaType, author: req.userId })

    // 3. Add post ID to user's posts array
    const user = await User.findById(req.userId)
    user.posts.push(post._id)
    await user.save()

    // 4. INVALIDATE the feed cache (new post should appear!)
    await redisClient.del("posts:feed")

    // 5. Return the populated post
    const populatedPost = await Post.findById(post._id)
        .populate("author", "name userName profileImage")
    return res.status(201).json(populatedPost)
}
```

### Post Like — The Kafka Integration Point

```javascript
// controllers/post.controllers.js — like
export const like = async (req, res) => {
    const post = await Post.findById(req.params.postId)
    const alreadyLiked = post.likes.includes(req.userId)

    if (alreadyLiked) {
        post.likes.pull(req.userId)        // Unlike
    } else {
        post.likes.push(req.userId)        // Like

        // Only send notification if it's NOT your own post
        if (post.author.toString() !== req.userId.toString()) {
            const eventId = uuidv4()
            publishEvent("content-events", "POST_LIKED", {
                eventId,
                postId: post._id,
                postOwnerId: post.author,
                userId: req.userId
            })
            // ↑ This is NON-BLOCKING — we don't await a response
        }
    }

    await post.save()
    await redisClient.del("posts:feed")    // Invalidate cache
    return res.status(200).json(post)       // Return IMMEDIATELY
}
```

> [!TIP]
> **Why the self-like check?** We don't create a notification when you like your own post. The check `post.author.toString() !== req.userId.toString()` prevents this.

### Feed with Redis Caching

```javascript
// controllers/post.controllers.js — getAllPosts
const cacheKey = "posts:feed"

// Try cache first
const cachedData = await redisClient.get(cacheKey)
if (cachedData) return res.status(200).json(JSON.parse(cachedData))  // 15ms!

// Cache miss → expensive MongoDB query
const posts = await Post.find({})
    .populate("author", "name userName profileImage")
    .populate("comments.author", "name userName profileImage")
    .sort({ createdAt: -1 })                                          // 150ms

// Cache for 2 minutes
await redisClient.setex(cacheKey, 120, JSON.stringify(posts))
return res.status(200).json(posts)
```

### Cache Invalidation Map

| Action | Cache Key Deleted | Why |
|--------|------------------|-----|
| Upload post | `posts:feed` | New post should appear in feed |
| Like/Unlike post | `posts:feed` | Like count changed |
| Comment on post | `posts:feed` | Comments changed |
| Delete post | `posts:feed` | Post removed from feed |

### API Routes

```
POST /api/post/upload           → isAuth → multer → uploadPost
GET  /api/post/getAll           → isAuth → getAllPosts (Redis cached)
GET  /api/post/like/:postId     → isAuth → like (Kafka event)
POST /api/post/comment/:postId  → isAuth → comment (Kafka event)
POST /api/post/save/:postId     → isAuth → savePost
DELETE /api/post/delete/:postId → isAuth → deletePost

POST /api/loop/upload           → isAuth → multer → uploadLoop
GET  /api/loop/getAll           → isAuth → getAllLoops
GET  /api/loop/like/:loopId     → isAuth → like (Kafka event)
POST /api/loop/comment/:loopId  → isAuth → comment (Kafka event)

POST /api/story/upload          → isAuth → multer → uploadStory
GET  /api/story/getAll          → isAuth → getAllStories
GET  /api/story/getByUserName/:userName → isAuth → getStoryByUserName
GET  /api/story/view/:storyId   → isAuth → viewStory
```

> [!NOTE]
> Every route has `isAuth` middleware. This means you MUST be logged in (have a valid JWT cookie) to access them.

---

## 5.5 Service 5: Messaging Service ([`services/messaging-service/`](file:///c:/Users/krish/.vscode/new_vybe/services/messaging-service))

**Responsibility:** Real-time chat via Socket.IO + message persistence in MongoDB.
**Connects to:** MongoDB, Socket.IO (WebSocket server), Cloudinary.

### Socket.IO Server Setup

```javascript
// socket.js — The WebSocket server
import http from "http"
import express from "express"
import { Server } from "socket.io"

const app = express()
const server = http.createServer(app)       // Create raw HTTP server
const io = new Server(server, {             // Wrap it with Socket.IO
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
    }
})
```

> [!IMPORTANT]
> This service uses `server.listen()` instead of `app.listen()` because Socket.IO needs the raw HTTP server reference for WebSocket upgrades. If you used `app.listen()`, Socket.IO wouldn't work.

### Socket Authentication Middleware

Socket.IO doesn't use Express middleware. It has its own `io.use()`:

```javascript
// socket.js — Authentication
io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie  // WebSocket carries cookies
    // Parse cookies manually (cookie-parser doesn't work here)
    const cookies = cookieHeader.split(';').reduce((res, item) => {
        const data = item.trim().split('=')
        return { ...res, [data[0]]: data[1] }
    }, {})
    const token = cookies.token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.userId     // Attach userId to socket object
    next()
})
```

**Why manual cookie parsing?** During the WebSocket handshake, cookies are sent as a raw string. Express's `cookie-parser` doesn't run here because this is Socket.IO's connection phase, not an Express route.

### Online User Tracking

```javascript
// socket.js — Connection tracking
const userSocketMap = {}  // { "userId123": "socketId456" }

io.on("connection", (socket) => {
    userSocketMap[socket.userId] = socket.id   // Register user
    io.emit('getOnlineUsers', Object.keys(userSocketMap))  // Tell EVERYONE

    socket.on('disconnect', () => {
        delete userSocketMap[socket.userId]     // Remove user
        io.emit('getOnlineUsers', Object.keys(userSocketMap))  // Update EVERYONE
    })
})

// Helper: Find a specific user's socket to send them a direct message
export const getSocketId = (receiverId) => userSocketMap[receiverId]
```

### Sending a Real-Time Message

```javascript
// controllers/message.controllers.js — sendMessage
export const sendMessage = async (req, res) => {
    const { message } = req.body
    const { receiverId } = req.params

    // 1. Upload image to Cloudinary (if any)
    let image = null
    if (req.file) image = await uploadOnCloudinary(req.file.path)

    // 2. Create message in MongoDB
    const newMessage = await Message.create({
        sender: req.userId,
        receiver: receiverId,
        message,
        image
    })

    // 3. Find or create conversation between these two users
    let conversation = await Conversation.findOne({
        participants: { $all: [req.userId, receiverId] }
    })
    if (!conversation) {
        conversation = await Conversation.create({
            participants: [req.userId, receiverId]
        })
    }
    conversation.messages.push(newMessage._id)
    await conversation.save()

    // 4. Send message in REAL-TIME to receiver (if they're online)
    const receiverSocketId = getSocketId(receiverId)
    if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage)
        // ↑ ONLY the receiver gets this — not everyone!
    }

    return res.status(200).json(newMessage)
}
```

### `io.emit()` vs `io.to(socketId).emit()`

```javascript
// io.emit() → Sends to EVERYONE connected
io.emit("getOnlineUsers", ["user1", "user2", "user3"])
// ALL users receive the updated online list

// io.to(socketId).emit() → Sends to ONE specific user
io.to(receiverSocketId).emit("newMessage", newMessage)
// ONLY the receiver gets this message
```

---

## 5.6 Service 6: Notification Service ([`services/notification-service/`](file:///c:/Users/krish/.vscode/new_vybe/services/notification-service))

**Responsibility:** Consumes Kafka events and creates notification documents in MongoDB. The only "worker" service — it processes background jobs.
**Connects to:** MongoDB, Kafka (consumer).

### How It Works

Unlike other services that respond to HTTP requests, the Notification Service runs a **Kafka consumer loop** in the background, constantly listening for events:

```javascript
// index.js — Unique startup
import { startNotificationConsumer } from "./consumers/notificationConsumer.js"
startNotificationConsumer()  // Start Kafka consumer BEFORE HTTP server
```

### The Kafka Consumer

```javascript
// consumers/notificationConsumer.js
await connectConsumer(["content-events", "user-events"], async (payload, topic) => {
    const { eventType, eventId, ...data } = payload

    // IDEMPOTENCY CHECK — Prevent duplicate notifications
    if (eventId) {
        const existing = await Notification.findOne({ eventId })
        if (existing) {
            console.log(`Skipping duplicate eventId: ${eventId}`)
            return  // Already processed this event!
        }
    }

    // Route event to correct notification type
    switch (eventType) {
        case "USER_FOLLOWED":
            await Notification.create({
                sender: data.followerId,
                receiver: data.followedUserId,
                type: "follow",
                message: "started following you",
                eventId
            })
            break

        case "POST_LIKED":
            await Notification.create({
                sender: data.userId,
                receiver: data.postOwnerId,
                type: "like",
                message: "liked your post",
                post: data.postId,
                eventId
            })
            break

        case "POST_COMMENTED":
            // ... similar pattern
            break
        // ... LOOP_LIKED, LOOP_COMMENTED
    }
})
```

### Why Idempotency Matters

**Problem:** Kafka guarantees *at-least-once* delivery. If the consumer crashes AFTER processing a message but BEFORE committing its offset, Kafka will redeliver the message on restart.

```
Without idempotency:
1. Consumer reads "POST_LIKED" message
2. Creates notification ✓
3. Consumer crashes BEFORE committing offset ✗
4. Consumer restarts, reads same message again
5. Creates DUPLICATE notification ✗ ← BAD!

With idempotency (our approach):
1. Consumer reads "POST_LIKED" message with eventId: "abc-123"
2. Checks: Notification.findOne({ eventId: "abc-123" }) → null (not found)
3. Creates notification ✓
4. Consumer crashes BEFORE committing offset ✗
5. Consumer restarts, reads same message again
6. Checks: Notification.findOne({ eventId: "abc-123" }) → FOUND!
7. Skips it ✓ ← No duplicate!
```

**Double safety:** Even if the application check fails (race condition), the `eventId` field has a `unique: true` index in MongoDB. MongoDB itself rejects duplicates with error code `11000`.

### Kafka Event Types

| Event | Topic | Produced By | Notification Created |
|-------|-------|-------------|---------------------|
| `USER_FOLLOWED` | `user-events` | User Service | "started following you" |
| `POST_LIKED` | `content-events` | Content Service | "liked your post" |
| `POST_COMMENTED` | `content-events` | Content Service | "commented on your post: {first 20 chars}..." |
| `LOOP_LIKED` | `content-events` | Content Service | "liked your loop" |
| `LOOP_COMMENTED` | `content-events` | Content Service | "commented on your loop: {first 20 chars}..." |

---

# Part 6: Frontend — Every File Explained

The frontend is a React application built with Vite. It only talks to the API Gateway (`http://localhost:8000`). It has **no idea** that microservices exist behind the gateway.

## 6.1 Redux Store (`frontend/src/redux/`)

The Redux store holds global state. We split it into 5 "slices" (categories):

| Slice | File | What It Stores | Why It's Needed |
|-------|------|----------------|-----------------|
| `userSlice` | `userSlice.js` | `userData` (logged in user), `suggestedUsers`, `following`, `notifications` | Used everywhere to check if logged in, show avatar, check notifications |
| `postSlice` | `postSlice.js` | `postData` (all feed posts) | Feed page needs posts; Post component needs to update likes |
| `loopSlice` | `loopSlice.js` | `loopData` (all TikTok-style loops) | Loops page needs them |
| `storySlice`| `storySlice.js`| `storyData` (stories from people you follow) | Home page top row |
| `messageSlice`| `messageSlice.js`| `messages`, `prevChatUsers` | Chat UI needs message history |
| `socketSlice`| `socketSlice.js`| `socket` (connection object), `onlineUsers` (array of IDs) | Any component can emit events or show green online dots |

## 6.2 Custom Hooks — Data Fetching Pattern

We have 8 custom hooks in `frontend/src/hooks/`. They all run when the app loads (in `App.jsx`) and follow the exact same pattern:

```javascript
// Example: getCurrentUser.jsx
function getCurrentUser() {
    const dispatch = useDispatch()
    
    useEffect(() => {
        const fetchUser = async () => {
            try {
                // 1. Fetch data from API Gateway (with cookies!)
                const result = await axios.get(`${serverUrl}/api/user/current`, {
                    withCredentials: true 
                })
                // 2. Save data in Redux store
                dispatch(setUserData(result.data))
            } catch (error) {
                console.log(error)
            }
        }
        fetchUser()
    }, [])
}
```

| Hook | Gateway URL Called | Proxied To | Redux Action Dispatched |
|------|--------------------|------------|-------------------------|
| `getCurrentUser` | `/api/user/current` | User Service | `setUserData` |
| `getSuggestedUsers` | `/api/user/suggested` | User Service | `setSuggestedUsers` |
| `getAllPost` | `/api/post/getAll` | Content Service | `setPostData` |
| `getAllLoops` | `/api/loop/getAll` | Content Service | `setLoopData` |
| `getAllStories` | `/api/story/getAll` | Content Service | `setStoryList` |
| `getFollowingList` | `/api/user/followingList` | User Service | `setFollowing` |
| `getPrevChatUsers` | `/api/message/prevChats` | Messaging Svc | `setPrevChatUsers` |
| `getAllNotifications`| `/api/notifications/getAll` | Notification Svc | `setNotificationData` |

## 6.3 Pages Explained

### `App.jsx` (The Heart)
- Runs all 8 custom hooks on mount.
- Connects to Socket.IO when `userData` exists.
- Listens for real-time notifications:
  ```javascript
  socket?.on("newNotification", (noti) => {
      dispatch(setNotificationData([...notificationData, noti]))
  })
  ```
- Defines all `<Route>` paths. Checks `userData` to redirect to `/signin` if logged out.

### `Home.jsx`
The simplest page — just composes 3 components side-by-side:
```
┌─────────────────┬─────────────────────────┬─────────────────┐
│ LeftHome        │ Feed                    │ RightHome       │
│ (25% width)     │ (50% width)             │ (25% width)     │
│                 │                         │                 │
│ • Your profile  │ • Stories row           │ • Messages list │
│ • Suggestions   │ • Post cards            │ • Online users  │
│                 │ • Nav bar (mobile)      │                 │
└─────────────────┴─────────────────────────┴─────────────────┘
```
On mobile, `LeftHome` and `RightHome` are hidden (`hidden lg:block`), and only `Feed` is shown.

### `SignUp.jsx` & `SignIn.jsx`
- Form inputs for credentials.
- Calls `/api/auth/signup` or `signin`.
- On success: Dispatches `setUserData` → React Router instantly redirects to `/` (Home).

### `Profile.jsx`
- Uses `:userName` from URL to fetch profile data.
- Shows "Edit Profile" if it's YOUR profile. Shows "Follow" / "Message" if it's someone else's.
- Shows grid of the user's posts (filtered from Redux `postData`).

### `Upload.jsx`
- Switch between Post / Story / Loop.
- File picker + VideoPlayer preview.
- Creates `FormData` to handle the file upload + caption text.

## 6.4 Key Components Explained

### `Post.jsx`
Handles displaying a single post and interacting with it:
- **Like:** Calls `/api/post/like/:id`, gets updated post back, updates Redux `postData` locally so the heart turns red instantly.
- **Comment:** Opens comment section, calls API, updates Redux.
- **Real-time:** Listens to Socket.IO events (like `likedPost`) so if someone else likes it, your screen updates.

### `LoopCard.jsx`
Full-screen TikTok-style video player:
- **Auto-play/pause:** Uses `IntersectionObserver` — plays when visible on screen, pauses when scrolled away.
- **Double-tap to like:** Custom double-click event handler that shows a heart animation.
- Uses CSS `snap-y snap-mandatory` on the parent for smooth scrolling between videos.

### `MessageArea.jsx`
- Individual chat view.
- Fetches message history on mount.
- **Send:** Calls `/api/message/send/:id`.
- **Receive:** Listens to `socket.on("newMessage", (msg) => setMessages([...messages, msg]))`.
- Renders `SenderMessage` (right side) or `ReceiverMessage` (left side) depending on `msg.sender === userData._id`.

---

# Part 7: Complete Data Flows

## 7.1 User Sign Up Flow (Microservices)

1. **User Input:** The user fills out the form in their browser (Frontend) and clicks "Sign Up".
2. **API Request:** The Frontend sends a `POST /api/auth/signup` request with the user's data `{name, email, ...}` to the API Gateway.
3. **Routing:** The API Gateway proxies the request to the Auth Service (Port 3001).
4. **Validation:** The Auth Service queries MongoDB Atlas to check if the email or username already exists.
5. **Security & Storage:** The Auth Service hashes the password using `bcrypt` and creates a new User document in MongoDB.
6. **Authentication:** The Auth Service generates a JWT (JSON Web Token) for the user.
7. **Response:** The Auth Service sends a `201` response with the user data and a `Set-Cookie` header containing the JWT back to the API Gateway, which forwards it to the Frontend.
8. **State Update:** The Frontend receives the response and dispatches `setUserData(user)` to the Redux store.
9. **Navigation:** The Frontend redirects the user to the Home page (`/`).
10. **Real-time Connection:** `App.jsx` detects the new `userData` and initiates a `Socket.IO` connection (`ws://`) to the API Gateway.
11. **WebSocket Proxying:** The API Gateway proxies the WebSocket connection to the Messaging Service (Port 3004).

## 7.2 Post Upload Flow (Media + Cache)

```
1. User selects image, types caption, clicks Upload.
2. Frontend creates FormData { media, caption, mediaType }.
3. Frontend → POST /api/post/upload → API Gateway.
4. Gateway → Forwards request + JWT cookie to Content Service.
5. Content Svc:
   - `isAuth` middleware verifies JWT → sets `req.userId`
   - `multer` middleware saves image to `/public/` temporarily.
6. Controller: `uploadOnCloudinary()` uploads file to Cloudinary CDN.
7. Controller: Deletes temporary local file.
8. Controller: Creates `Post` in MongoDB with Cloudinary URL.
9. Controller: `redisClient.del("posts:feed")` → Invalidates old feed cache!
10. Content Svc → Returns new post JSON.
11. Frontend → Redux: updates `postData` array → UI shows new post.
```

## 7.3 User Likes a Post (Kafka + Background Worker)

1. **User Action:** The user clicks the heart icon on a post.
2. **API Request:** The Frontend sends a `GET /api/post/like/:id` request to the API Gateway, which proxies it to the Content Service.
3. **Database Update:** The Content Service pushes the user's ID into the post's `likes` array in MongoDB and saves it.
4. **Cache Invalidation:** The Content Service deletes the `posts:feed` key in Redis, so the next feed fetch will show the updated like count.
5. **Publish Event:** The Content Service generates a unique `eventId` and publishes a `POST_LIKED` event to Kafka. **(This is non-blocking!)**
6. **Instant Response:** The Content Service immediately returns a `200 OK` to the Frontend, and the heart icon turns red for the user.
7. **Background Consumption (Kafka):** Meanwhile, the Notification Service reads the `POST_LIKED` event from Kafka.
8. **Idempotency Check:** The Notification Service checks MongoDB to see if a notification with that `eventId` already exists.
9. **Notification Creation:** If it doesn't exist, the Notification Service creates the "liked your post" notification in MongoDB.

## 7.4 Real-Time Messaging Flow (Socket.IO)

1. **User Action:** User A types a message to User B and hits send.
2. **API Request:** The Frontend sends a `POST /api/message/send/:receiverId` request to the API Gateway, which proxies it to the Messaging Service.
3. **Database Storage:** The Messaging Service creates a new `Message` document and updates the `Conversation` document in MongoDB.
4. **Socket Lookup:** The Messaging Service checks its in-memory `userSocketMap` to see if User B is currently online.
5. **Real-Time Emit:** If User B is online, the Messaging Service uses `io.to(receiverSocketId).emit("newMessage", message)` to push the message directly to User B's open WebSocket connection. *(Note: If User B is offline, this emit is simply skipped. The message is already saved in MongoDB from Step 3, so they will see it the next time they open the app and fetch their message history.)*
6. **Frontend Update:** User B's Frontend receives the `newMessage` event and instantly updates the Redux store (`messageSlice`), displaying the new chat bubble without refreshing.
7. **Response:** The Messaging Service returns a `200 OK` to User A, updating their local chat UI as well.

## 7.5 Fetching User Profile (Redis Cache-Aside Pattern)

1. **User Action:** The user navigates to someone's profile page.
2. **API Request:** The Frontend sends a `GET /api/user/getProfile/:userName` request to the API Gateway, which proxies it to the User Service.
3. **Cache Check:** The User Service queries Redis for the key `user:profile:{userName}`.
4. **Cache Hit (Fast Path):** If the data is in Redis, the User Service parses the JSON and returns it immediately (~15ms). The flow ends here.
5. **Cache Miss (Slow Path):** If the data is NOT in Redis, the User Service queries MongoDB, using `.populate()` to fetch all posts, loops, and followers linked to that user (~150ms).
6. **Populate Cache:** The User Service saves the MongoDB result into Redis with a 5-minute expiration time (TTL).
7. **Response:** The User Service returns the profile data to the Frontend.

---

# Part 8: How Key Technologies Work in This Project

## 8.1 Shared JWT Authentication

How do 6 different services all know you are logged in, without constantly asking the Auth Service?

**The Secret:** `process.env.JWT_SECRET` must be the **exact same string** in every service's `.env` file.

1. **Auth Service** generates the token using the secret: `jwt.sign({ userId }, SECRET)`.
2. The token is sent to the browser and stored in an `httpOnly` cookie.
3. On every request, the browser sends the cookie to the **API Gateway**.
4. The **API Gateway** blindly forwards the cookie header to the destination service.
5. The **destination service** (e.g., Content Service) has an `isAuth` middleware. It reads the cookie, and runs `jwt.verify(token, SECRET)`.
6. Because the secret matches, the verification succeeds, and the service knows the `userId` without ever talking to the Auth Service!

This is called **Stateless Authentication**.

## 8.2 The Docker Compose Orchestration

The `docker-compose.yml` file is the master blueprint.

1. **Infrastructure first:** It defines MongoDB, Redis, and Kafka containers.
2. **Health checks:** Kafka is configured to wait for Zookeeper. Services are configured to `depends_on` MongoDB being healthy.
3. **The 6 Services:** Each service builds from its `Dockerfile`, mounts the source code (so changes reflect instantly in dev), and connects to the `vybe-network`.

```yaml
# Example snippet from docker-compose.yml
services:
  api-gateway:
    build: ./services/api-gateway
    ports:
      - "8000:8000"           # ONLY service exposed to outside world
    networks:
      - vybe-network          # Can talk to all other containers
  
  user-service:
    build: ./services/user-service
    ports:
      - "3002:3002"           # Exposed ONLY to host for debugging, not internet
    depends_on:
      mongodb:
        condition: service_healthy
```

---

# Part 9: Performance — Before vs After

Why did we add Redis and Kafka? Because the monolith was struggling under load.

### Read Performance (Fetching the Feed)

**Before (Monolith):**
Every request hit MongoDB. It had to search the disk, join the `users` collection to get author names, and sort by date.
**Time:** ~150ms per request.

**After (Microservices + Redis):**
The first request takes 150ms and saves the result in Redis RAM. The next 10,000 requests for the next 2 minutes read directly from RAM.
**Time:** ~15ms per request (10x faster).

### Write Performance (Liking a Post)

**Before (Monolith):**
`Request → Update Post in DB → Create Notification in DB → Socket emit → Response`
**Time:** ~95ms. Under heavy load, the database connection pool maxed out, causing 38% of likes to fail.

**After (Microservices + Kafka):**
`Request → Update Post in DB → Send event to Kafka → Response`
**Time:** ~55ms. Kafka absorbs the burst, and the Notification Service creates notifications at its own pace in the background. **0% failure rate.**

---

# Part 10: Failure Scenarios & Resilience

In microservices, things WILL crash. Here's how Vybe handles it gracefully:

| What Crashes | Impact on User | How the System Handles It |
|--------------|----------------|---------------------------|
| **Auth Service** | Can't log in/sign up. | Already logged-in users are unaffected! Their JWT is on their browser and verified locally by other services. |
| **Content Service** | Can't view/upload posts. | Chat, notifications, and profile editing still work perfectly. |
| **Notification Service** | Notifications stop appearing. | Kafka **saves** the events on disk. When the service restarts, it reads the backlog and creates all missing notifications. **Zero data loss.** |
| **Redis** | Feed gets slower. | `try/catch` around Redis calls. If Redis is down, it silently falls back to querying MongoDB. App doesn't crash, just slows down. |
| **Kafka** | Likes/comments work, but no notifications. | Producers catch the error, log it, and return HTTP 200 anyway. We prioritize user experience over notification completeness. |
| **MongoDB** | Everything breaks. | This is our single point of failure. In production, MongoDB Atlas handles replication/backups. |

---

# Part 11: Production Deployment Architecture

Running `docker compose` is for local development. In production, we deploy to specialized cloud hosts:

| Component | Dev (Local) | Production (Cloud) | Why? |
|-----------|-------------|--------------------|------|
| **Frontend** | `localhost:5173` | Vercel (`vercel.app`) | Global CDN, instant deployments. |
| **Services (x6)** | Docker Desktop | Render (Web Services) | Connects to GitHub, auto-deploys on push, provides SSL (`onrender.com`). |
| **Database** | Docker MongoDB | MongoDB Atlas | Managed backups, automatic failover, free M0 tier. |
| **Cache** | Docker Redis | Upstash Serverless Redis | Pay-per-request, zero maintenance. |
| **Message Queue**| Docker Kafka | Confluent Cloud | Fully managed Kafka cluster, handles broker replication. |

**The Vercel-Render CORS Challenge:**
In prod, the frontend is on `vercel.app` and backend is on `onrender.com`. Cookies are blocked cross-domain by default. We solved this by setting the cookie with `SameSite="none"` and `Secure=true`.

---

# Part 12: Design Tradeoffs We Made

Every architectural decision has pros and cons. Here's what we chose and why:

| Decision | The Alternative | Why We Chose It (The Pro) | The Con |
|----------|-----------------|---------------------------|---------|
| **Shared MongoDB** | One database per microservice | **Simplicity.** Content Service can easily `populate("author")` from the users collection. | Not a "pure" microservice. Services are coupled at the DB layer. |
| **Cache-Aside** (Redis) | Write-Through cache | **Simpler logic.** We just delete (`del`) the cache on changes, letting the next read rebuild it. | The very next user experiences a slow 150ms read. |
| **Kafka for Notifs Only** | Kafka for everything (e.g. Chat) | **Appropriate tool use.** Chat needs instant delivery (Socket.IO). Notifications are true background tasks. | Two different event systems to maintain. |
| **JWT in Cookies** | JWT in `localStorage` | **Security.** `httpOnly` cookies are immune to XSS attacks (JS can't read them). | Susceptible to CSRF, requires strict CORS setup. |

---

# Part 13: Interview Questions & Answers

If you put this project on your resume, expect these questions:

### Q1: Walk me through what happens when a user opens the app.
> "The browser loads the React app from Vercel. React's `useEffect` fires `getCurrentUser()`, sending a GET request with the JWT cookie. This hits the API Gateway on Render, which proxies it to the User Service. The User Service verifies the JWT locally, queries MongoDB for the user, and returns it. Once the frontend receives the user data, it opens a Socket.IO connection through the Gateway to the Messaging Service for real-time chat."

### Q2: Why did you migrate from a Monolith to Microservices?
> "In our load testing, the monolith struggled with resource contention. When a user liked a post, the Node event loop had to update the post, create a notification, and emit a socket event all synchronously. This blocked the thread and caused database pool exhaustion (38% error rate). By moving to microservices, we offloaded the notification creation to a background worker via Kafka, dropping response times by 40% and eliminating errors."

### Q3: Why didn't you give each microservice its own database?
> "In a strict microservices architecture, yes, database-per-service is standard. However, our services have high read coupling — the Content Service needs to join (`populate`) user data on every post. If they had separate databases, we'd have to make an HTTP call to the User Service for every post in the feed, adding massive network latency. At our current scale, a shared database was a pragmatic tradeoff for performance."

### Q4: What happens if your Kafka consumer (Notification Service) crashes?
> "Kafka uses an offset tracking system. If the Notification Service crashes before processing a message, that message is NOT lost — it remains safely on Kafka's disk. When the service restarts, it reads from its last committed offset and processes the backlog. To prevent duplicate notifications (if it crashed mid-process), we implemented an idempotency check using a unique `eventId`."

### Q5: Your Redis feed cache has a 2-minute TTL. Doesn't that mean users see stale data?
> "Only if active invalidation fails. We use a Cache-Aside pattern with active invalidation. When someone uploads, likes, or comments on a post, we call `redisClient.del('posts:feed')` to immediately clear the cache. The TTL is just a fallback mechanism. So users see real-time data, but we get the performance benefits of caching for the 99% of requests that are just passive scrolling."

### Q6: How do you handle authentication across 6 different servers?
> "We use stateless JWT authentication. The Auth Service generates the token and signs it with a `JWT_SECRET`. We store that token in an `httpOnly` cookie. The API Gateway forwards the cookie to the downstream services. Each service has a middleware that verifies the token locally using the same `JWT_SECRET` environment variable. This way, we authenticate every request without creating a bottleneck at the Auth Service."

---

*This document was generated from a complete analysis of every source file in the New Vybe codebase. Last updated: September 2026.*
