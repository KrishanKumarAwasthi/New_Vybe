# Vybe — Proposed Microservices Architecture (Phase 1)

## 1. Architecture Overview

The monolithic backend will be decomposed into **6 independently deployable services** plus infrastructure components. The design prioritizes clear domain boundaries, practical separation of concerns, and preserving all existing frontend behavior without rewrites.

```
                              ┌─────────────────────────────────┐
                              │           Frontend              │
                              │    React 19 SPA (Port 5173)     │
                              │  Redux / Axios / socket.io-client│
                              └──────────────┬──────────────────┘
                                             │
                                             │  All HTTP + WebSocket traffic
                                             ▼
                              ┌─────────────────────────────────┐
                              │          API Gateway            │
                              │        (Port 8000)              │
                              │  Route proxying, CORS, Cookie   │
                              │  forwarding, WS upgrade proxy   │
                              └──────┬──────┬──────┬──────┬─────┘
                                     │      │      │      │
                ┌────────────────────┤      │      │      ├────────────────────┐
                │                    │      │      │      │                    │
                ▼                    ▼      │      ▼      ▼                    │
     ┌──────────────────┐  ┌──────────────┐│ ┌──────────────┐                 │
     │   Auth Service   │  │ User Service ││ │Content Service│                 │
     │   (Port 3001)    │  │ (Port 3002)  ││ │ (Port 3003)  │                 │
     │                  │  │              ││ │              │                 │
     │ - signup/signin  │  │ - profiles   ││ │ - posts      │                 │
     │ - signout        │  │ - follow     ││ │ - loops      │                 │
     │ - OTP/reset pwd  │  │ - search     ││ │ - stories    │                 │
     │ - JWT issuance   │  │ - discovery  ││ │ - likes      │                 │
     └──────────────────┘  └──────────────┘│ │ - comments   │                 │
                                           │ │ - saved      │                 │
                                           │ └──────────────┘                 │
                                           │                                  │
                                           ▼                                  ▼
                              ┌──────────────────┐              ┌──────────────────┐
                              │Messaging Service │              │Notification Svc  │
                              │  (Port 3004)     │              │  (Port 3005)     │
                              │                  │              │                  │
                              │ - send/get msgs  │              │ - get notifs     │
                              │ - conversations  │              │ - mark as read   │
                              │ - Socket.io hub  │              │ - Kafka consumer │
                              │ - online presence│              │ - real-time push │
                              └──────────────────┘              └──────────────────┘

     ┌─────────────────────────────────────────────────────────────────────────────┐
     │                          Infrastructure Layer                               │
     │                                                                             │
     │   ┌──────────┐     ┌──────────┐     ┌──────────┐                           │
     │   │ MongoDB  │     │  Redis   │     │  Kafka   │                           │
     │   │ (27017)  │     │ (6379)   │     │ (9092)   │                           │
     │   │          │     │          │     │          │                           │
     │   │ Primary  │     │ Cache &  │     │ Async    │                           │
     │   │ Database │     │ Presence │     │ Events   │                           │
     │   └──────────┘     └──────────┘     └──────────┘                           │
     └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Directory Structure

```
services/
├── api-gateway/            # Express reverse proxy (Port 8000)
│   ├── package.json
│   ├── index.js
│   ├── Dockerfile
│   └── .env.example
│
├── auth-service/           # Authentication & credential management (Port 3001)
│   ├── package.json
│   ├── index.js
│   ├── config/
│   │   ├── db.js
│   │   ├── token.js
│   │   └── Mail.js
│   ├── models/
│   │   └── user.model.js   # Credentials subset of User schema
│   ├── controllers/
│   │   └── auth.controllers.js
│   ├── routes/
│   │   └── auth.routes.js
│   ├── Dockerfile
│   └── .env.example
│
├── user-service/           # Profiles, social graph, search (Port 3002)
│   ├── package.json
│   ├── index.js
│   ├── config/
│   │   ├── db.js
│   │   ├── cloudinary.js
│   │   ├── redis.js
│   │   └── kafka.js
│   ├── models/
│   │   └── user.model.js   # Full User schema (shared DB)
│   ├── middlewares/
│   │   ├── isAuth.js
│   │   └── multer.js
│   ├── controllers/
│   │   └── user.controllers.js
│   ├── routes/
│   │   └── user.routes.js
│   ├── Dockerfile
│   └── .env.example
│
├── content-service/        # Posts, Loops, Stories, Engagements (Port 3003)
│   ├── package.json
│   ├── index.js
│   ├── config/
│   │   ├── db.js
│   │   ├── cloudinary.js
│   │   ├── redis.js
│   │   └── kafka.js
│   ├── models/
│   │   ├── post.model.js
│   │   ├── loop.model.js
│   │   ├── story.model.js
│   │   └── user.model.js   # Read-only reference for populating author
│   ├── middlewares/
│   │   ├── isAuth.js
│   │   └── multer.js
│   ├── controllers/
│   │   ├── post.controllers.js
│   │   ├── loop.controllers.js
│   │   └── story.controllers.js
│   ├── routes/
│   │   ├── post.routes.js
│   │   ├── loop.routes.js
│   │   └── story.routes.js
│   ├── Dockerfile
│   └── .env.example
│
├── messaging-service/      # Chat, conversations, Socket.io hub (Port 3004)
│   ├── package.json
│   ├── index.js
│   ├── socket.js
│   ├── config/
│   │   ├── db.js
│   │   ├── cloudinary.js
│   │   ├── redis.js
│   │   └── kafka.js
│   ├── models/
│   │   ├── conversation.model.js
│   │   ├── message.model.js
│   │   └── user.model.js   # Read-only reference for populating participants
│   ├── middlewares/
│   │   ├── isAuth.js
│   │   └── multer.js
│   ├── controllers/
│   │   └── message.controllers.js
│   ├── routes/
│   │   └── message.routes.js
│   ├── Dockerfile
│   └── .env.example
│
├── notification-service/   # Event-driven notifications (Port 3005)
│   ├── package.json
│   ├── index.js
│   ├── config/
│   │   ├── db.js
│   │   ├── redis.js
│   │   └── kafka.js
│   ├── models/
│   │   ├── notification.model.js
│   │   └── user.model.js   # Read-only reference for populating sender/receiver
│   ├── middlewares/
│   │   └── isAuth.js
│   ├── controllers/
│   │   └── notification.controllers.js
│   ├── routes/
│   │   └── notification.routes.js
│   ├── consumers/
│   │   └── notificationConsumer.js
│   ├── Dockerfile
│   └── .env.example
│
└── shared/                 # Shared utilities (NOT a service, just reusable code)
    ├── kafka/
    │   ├── producer.js
    │   └── consumer.js
    └── events.js           # Event type constants
```

---

## 3. Service Responsibilities & Boundaries

### 3.1. API Gateway (Port 8000)

**Role**: The single entry point for all frontend traffic. Acts as a reverse proxy.

**Responsibilities**:
- Receives all HTTP requests from the frontend at `:8000`
- Proxies requests to downstream services based on URL path prefix
- Handles CORS configuration centrally (so downstream services don't need it)
- Forwards cookies transparently (the `token` cookie passes through unchanged)
- Proxies WebSocket upgrade requests (`/socket.io/*`) to the Messaging Service
- Does **NOT** contain business logic, authentication verification, or database access

**Routing Table**:

| Incoming Path | Proxied To | Service |
|---|---|---|
| `/api/auth/*` | `http://auth-service:3001/api/auth/*` | Auth Service |
| `/api/user/*` | `http://user-service:3002/api/user/*` | User Service |
| `/api/post/*` | `http://content-service:3003/api/post/*` | Content Service |
| `/api/loop/*` | `http://content-service:3003/api/loop/*` | Content Service |
| `/api/story/*` | `http://content-service:3003/api/story/*` | Content Service |
| `/api/message/*` | `http://messaging-service:3004/api/message/*` | Messaging Service |
| `/api/notifications/*` | `http://notification-service:3005/api/notifications/*` | Notification Service |
| `/socket.io/*` | `ws://messaging-service:3004/socket.io/*` | Messaging Service |

**Backward Compatibility**: The existing frontend notification routes (`/api/user/getAllNotifications` and `/api/user/markAsRead`) will be routed to the Notification Service transparently by adding specific path overrides in the gateway.

**Technology**: Express + `http-proxy-middleware`.

---

### 3.2. Auth Service (Port 3001)

**Domain**: Identity verification, credential management, session issuance.

**Endpoints** (unchanged from monolith):

| Route | Method | Description |
|---|---|---|
| `/api/auth/signup` | POST | Register new user, issue JWT cookie |
| `/api/auth/signin` | POST | Authenticate user, issue JWT cookie |
| `/api/auth/signout` | GET | Clear JWT cookie |
| `/api/auth/sendOtp` | POST | Generate OTP and send via email |
| `/api/auth/verifyOtp` | POST | Validate OTP |
| `/api/auth/resetPassword` | POST | Reset password after OTP verification |

**Database Access**: Reads/writes to `users` collection (credential fields: `email`, `userName`, `password`, `resetOtp`, `otpExpires`, `isOtpVerified`).

**Dependencies**: `bcryptjs`, `jsonwebtoken`, `nodemailer`, `mongoose`.

**Design Decisions**:
- Auth Service and User Service share the same `users` collection in MongoDB. This is intentional and practical — splitting the user collection across two separate databases would require complex data synchronization for a portfolio project. Both services connect to the same MongoDB instance, and the schema is consistent.
- Auth routes have **no** `isAuth` middleware (they are public endpoints).
- On signup, the Auth Service creates the full `User` document (including profile fields with default empty values), so the User Service has immediate read access.

---

### 3.3. User Service (Port 3002)

**Domain**: User profiles, social graph, user discovery, search.

**Endpoints**:

| Route | Method | Middleware | Description |
|---|---|---|---|
| `/api/user/current` | GET | `isAuth` | Get authenticated user's full profile |
| `/api/user/suggested` | GET | `isAuth` | Get suggested users to follow |
| `/api/user/getProfile/:userName` | GET | `isAuth` | Get user profile by username |
| `/api/user/editProfile` | POST | `isAuth`, `multer` | Update profile (with optional image upload) |
| `/api/user/follow/:targetUserId` | GET | `isAuth` | Toggle follow/unfollow |
| `/api/user/followingList` | GET | `isAuth` | Get current user's following list |
| `/api/user/search` | GET | `isAuth` | Search users by keyword |

**Database Access**: Reads/writes to `users` collection (profile metadata: `name`, `userName`, `profileImage`, `bio`, `profession`, `gender`, `followers`, `following`, `posts`, `saved`, `loops`, `story`).

**Key Change from Monolith**: The `follow` action no longer synchronously creates notifications. Instead, it publishes a `USER_FOLLOWED` event to Kafka. The Notification Service consumes this event asynchronously.

**Redis Usage**: Cache frequently requested user profiles (e.g., `user:profile:{userName}`) with TTL.

**Kafka Events Produced**:
- `USER_FOLLOWED` — when a user follows another user

---

### 3.4. Content Service (Port 3003)

**Domain**: All user-generated content (Posts, Loops, Stories) and engagements (likes, comments, saved).

**Rationale for Keeping Posts, Loops, and Stories Together**:
- Posts and Loops share nearly identical schemas (author, media, caption, likes, comments) and identical controller patterns (upload → Cloudinary → create → push to user).
- Stories share the same media pipeline (Multer → Cloudinary).
- Likes and comments on Posts and Loops follow the same toggle/append pattern.
- Separating these into 3 distinct services would triple the operational overhead with virtually no architectural benefit.

**Endpoints**:

| Route | Method | Middleware | Description |
|---|---|---|---|
| `/api/post/upload` | POST | `isAuth`, `multer` | Create a new post |
| `/api/post/getAll` | GET | `isAuth` | Get all posts (feed) |
| `/api/post/like/:postId` | GET | `isAuth` | Toggle like on post |
| `/api/post/comment/:postId` | POST | `isAuth` | Add comment to post |
| `/api/post/saved/:postId` | GET | `isAuth` | Toggle bookmark on post |
| `/api/post/delete/:postId` | DELETE | `isAuth` | Delete own post |
| `/api/loop/upload` | POST | `isAuth`, `multer` | Create a new loop |
| `/api/loop/getAll` | GET | `isAuth` | Get all loops |
| `/api/loop/like/:loopId` | GET | `isAuth` | Toggle like on loop |
| `/api/loop/comment/:loopId` | POST | `isAuth` | Add comment to loop |
| `/api/story/upload` | POST | `isAuth`, `multer` | Create/replace story |
| `/api/story/getAll` | GET | `isAuth` | Get stories from followed users |
| `/api/story/getByUserName/:userName` | GET | `isAuth` | Get story by username |
| `/api/story/view/:storyId` | GET | `isAuth` | Record story view |

**Database Access**: Reads/writes to `posts`, `loops`, `stories` collections. Reads `users` collection for populating author info and managing `user.posts`, `user.loops`, `user.saved`, `user.story` arrays.

**Key Changes from Monolith**:
- **No direct socket.io calls**: The Content Service no longer imports `socket.js` or calls `io.emit(...)` directly. Instead:
  - After a like/comment, it publishes an event to Kafka (e.g., `POST_LIKED`).
- **No direct notification creation**: All notification generation is deferred to the Notification Service via Kafka events.

**Redis Usage**: Cache `getAllPosts` and `getAllLoops` responses with short TTLs, invalidated on new content creation.

**Kafka Events Produced**:
- `POST_CREATED`
- `POST_LIKED`
- `POST_COMMENTED`
- `POST_DELETED`
- `LOOP_CREATED`
- `LOOP_LIKED`
- `LOOP_COMMENTED`
- `STORY_CREATED`

---

### 3.5. Messaging Service (Port 3004)

**Domain**: Direct messaging, conversations, Socket.io WebSocket hub, online presence.

**Endpoints**:

| Route | Method | Middleware | Description |
|---|---|---|---|
| `/api/message/send/:receiverId` | POST | `isAuth`, `multer` | Send a message (text and/or image) |
| `/api/message/getAll/:receiverId` | GET | `isAuth` | Get all messages in a conversation |
| `/api/message/prevChats` | GET | `isAuth` | Get previous chat partners |

**Socket.io Events Emitted to Clients**:

| Event | Payload | Trigger |
|---|---|---|
| `getOnlineUsers` | `string[]` (user IDs) | User connects/disconnects |
| `newMessage` | `Message` object | Message sent to receiver |

**Database Access**: Reads/writes to `conversations` and `messages` collections.

**Key Changes from Monolith**:
- **Redis-backed presence**: The in-memory `userSocketMap` is replaced with Redis hashes (`online:users`). This allows presence state to be shared if multiple Messaging Service instances are running.
- **Kafka Events Produced**: `MESSAGE_SENT` (consumed by Notification Service to generate notifications if desired in the future).

---

### 3.6. Notification Service (Port 3005)

**Domain**: Asynchronous notification generation, notification persistence, read/unread management.

**Endpoints**:

| Route | Method | Middleware | Description |
|---|---|---|---|
| `/api/notifications/getAll` | GET | `isAuth` | Get all notifications for current user |
| `/api/notifications/markAsRead` | POST | `isAuth` | Mark notification(s) as read |

**Backward Compatibility**: The API Gateway will route the legacy frontend paths:
- `GET /api/user/getAllNotifications` → `GET /api/notifications/getAll`
- `POST /api/user/markAsRead` → `POST /api/notifications/markAsRead`

This means the frontend code does **not** need to be updated for notification endpoints.

**Database Access**: Reads/writes to `notifications` collection. Reads `users`, `posts`, `loops` for populating references.

**Kafka Events Consumed**:

| Event | Action |
|---|---|
| `POST_LIKED` | Create "liked your post" notification |
| `POST_COMMENTED` | Create "commented on your post" notification |
| `LOOP_LIKED` | Create "liked your loop" notification |
| `LOOP_COMMENTED` | Create "commented on your loop" notification |
| `USER_FOLLOWED` | Create "started following you" notification |

**After creating a notification**: The notification is persisted in MongoDB and served to the client on the next fetch.

---

## 4. Communication Patterns

### 4.1. Synchronous (HTTP — Request/Response)

Used when the frontend needs an immediate response:

```
Frontend → API Gateway → Target Service → MongoDB → Response
```

All existing API calls use this pattern. The Gateway proxies transparently.

### 4.2. Asynchronous (Kafka — Event-Driven)

Used for decoupled business events where the original action should not wait:

```
User likes post
    │
    ▼
Content Service
    │
    ├── 1. Save like to MongoDB (synchronous, returns to client)
    │
    └── 2. Publish POST_LIKED to Kafka (fire-and-forget)
                │
                ▼
            Kafka Topic: content-events
                │
                ▼
        Notification Service (consumer)
                │
                └── 3. Create Notification in MongoDB
```

This replaces the monolith's `io.emit(...)` calls that were directly inside content controllers.

---

## 5. Shared Database Strategy

All services connect to the **same MongoDB instance** (same connection string, same `socialMedia` database). This is a deliberate pragmatic choice for this project scope:

**Why shared database?**
- The `User` schema is referenced by virtually every collection via `ObjectId` refs and `populate()` calls.
- True database-per-service would require either data duplication with eventual consistency, or synchronous inter-service API calls for every populate, both of which add significant complexity disproportionate to this project's needs.
- The services maintain **logical separation** — each service only accesses the collections it owns, plus read-only access to `users` for populating references.

**Collection Ownership**:

| Collection | Owner (Read/Write) | Read-Only Access |
|---|---|---|
| `users` | Auth Service (credentials), User Service (profile/graph) | Content, Messaging, Notification (populate only) |
| `posts` | Content Service | Notification (populate only) |
| `loops` | Content Service | Notification (populate only) |
| `stories` | Content Service | — |
| `conversations` | Messaging Service | — |
| `messages` | Messaging Service | — |
| `notifications` | Notification Service | — |

---

## 6. Authentication Strategy in Microservices

**JWT cookie is the single authentication mechanism** across all services:

1. **Auth Service** issues the JWT cookie on signup/signin.
2. **API Gateway** passes the cookie through transparently (does NOT verify it).
3. Each downstream service that requires authentication runs its own copy of the `isAuth` middleware, which:
   - Reads `req.cookies.token`
   - Verifies it using the shared `JWT_SECRET` environment variable
   - Attaches `req.userId` to the request

**Why each service verifies independently?**
- No single point of failure — if the Auth Service is down, already-authenticated users can still use other services.
- No inter-service call overhead per request.
- The JWT is self-contained; verification only requires the shared secret.

**Shared Secret**: All services that use `isAuth` receive the same `JWT_SECRET` via their environment variables.

---

## 7. Infrastructure Components

### 7.1. MongoDB

- **Version**: 7.x (via Docker `mongo:7` image)
- **Port**: 27017 (internal Docker network only)
- **Database**: `socialMedia`
- **Usage**: Primary persistent data store for all collections
- **Rationale**: Preserving the existing database technology; no reason to change it

### 7.2. Redis

- **Version**: 7.x (via Docker `redis:7-alpine` image)
- **Port**: 6379 (internal Docker network only)
- **Usage**:
  1. **Application caching**: User profiles, post feeds, loop feeds with TTLs
  2. **Online presence**: Replace in-memory `userSocketMap` with Redis hash

### 7.3. Apache Kafka

- **Version**: Latest Confluent or Bitnami Kafka image with KRaft mode (no separate Zookeeper)
- **Port**: 9092 (internal Docker network only)
- **Topics**:
  - `content-events` — POST_CREATED, POST_LIKED, POST_COMMENTED, POST_DELETED, LOOP_CREATED, LOOP_LIKED, LOOP_COMMENTED, STORY_CREATED
  - `user-events` — USER_FOLLOWED
  - `message-events` — MESSAGE_SENT
- **Consumer Groups**:
  - `notification-service-group` — Notification Service consumes from `content-events` and `user-events`

---

## 8. Docker Compose Service Map

```yaml
# docker-compose.yml service names and ports
services:
  mongodb:        # Port 27017 (internal)
  redis:          # Port 6379 (internal)
  kafka:          # Port 9092 (internal)
  api-gateway:    # Port 8000 (exposed to host)
  auth-service:   # Port 3001 (internal)
  user-service:   # Port 3002 (internal)
  content-service:    # Port 3003 (internal)
  messaging-service:  # Port 3004 (internal, WS proxied via gateway)
  notification-service: # Port 3005 (internal)
```

**Exposed to Host**:
- `api-gateway:8000` — the only port the frontend connects to
- `frontend:5173` — Vite dev server (optionally run outside Docker)

**Internal Only** (Docker network):
- All microservices and infrastructure components communicate via Docker service names (e.g., `mongodb`, `redis`, `kafka`, `auth-service`).

---

## 9. Redis Strategy Summary

| Use Case | Key Pattern | TTL | Invalidation |
|---|---|---|---|
| User profile cache | `cache:user:profile:{userName}` | 5 minutes | On profile edit |
| All posts feed | `cache:posts:all` | 2 minutes | On post create/delete |
| All loops feed | `cache:loops:all` | 2 minutes | On loop create |
| Online presence | `online:users` (Redis Hash) | Session-based | On connect/disconnect |

**Failure Handling**: If Redis is unavailable:
- Cache misses fall through to MongoDB (no data loss)
- Online presence degrades gracefully (users shown as offline)
- Real-time broadcasts may be delayed but core actions still succeed

---

## 10. Kafka Event Schema Summary

All events use a consistent envelope:

```json
{
  "eventType": "POST_LIKED",
  "timestamp": "2026-09-11T16:00:00.000Z",
  "data": {
    // Event-specific payload
  }
}
```

| Event Type | Topic | Producer | Consumer | Payload |
|---|---|---|---|---|
| `POST_LIKED` | `content-events` | Content Service | Notification Service | `{ postId, postOwnerId, userId }` |
| `POST_COMMENTED` | `content-events` | Content Service | Notification Service | `{ postId, postOwnerId, userId, message }` |
| `LOOP_LIKED` | `content-events` | Content Service | Notification Service | `{ loopId, loopOwnerId, userId }` |
| `LOOP_COMMENTED` | `content-events` | Content Service | Notification Service | `{ loopId, loopOwnerId, userId, message }` |
| `POST_CREATED` | `content-events` | Content Service | (Future: Feed Service) | `{ postId, authorId }` |
| `POST_DELETED` | `content-events` | Content Service | (Future: Cleanup) | `{ postId, authorId }` |
| `LOOP_CREATED` | `content-events` | Content Service | (Future: Feed Service) | `{ loopId, authorId }` |
| `STORY_CREATED` | `content-events` | Content Service | (Future: Feed Service) | `{ storyId, authorId }` |
| `USER_FOLLOWED` | `user-events` | User Service | Notification Service | `{ followerId, followedUserId }` |
| `MESSAGE_SENT` | `message-events` | Messaging Service | (Future: Notification) | `{ messageId, senderId, receiverId }` |

---

## 11. Frontend Impact Assessment

**Goal: Zero frontend rewrites wherever possible.**

| Frontend Concern | Impact | Action Required |
|---|---|---|
| `serverUrl` base URL | None | Still points to `:8000` (API Gateway) |
| All `/api/*` HTTP calls | None | Gateway proxies to same paths on downstream services |
| Cookie-based auth | None | Gateway forwards cookies transparently |
| Socket.io connection | Minimal | Gateway proxies WebSocket upgrades to Messaging Service |
| Notification paths | None | Gateway routes legacy paths to Notification Service |
| Real-time events (`likedPost`, etc.) | None | Not currently implemented; users see updates on page reload |

**The only potential frontend change**: If the Socket.io connection path needs a namespace or explicit path configuration due to the proxy layer. This will be verified during implementation and adjusted if needed.

---

## 12. Migration Sequence

The services will be extracted in dependency order:

```
Step 1:  Docker Compose infrastructure (MongoDB, Redis, Kafka)
Step 2:  Auth Service (no dependencies on other services)
Step 3:  User Service (depends on shared User model)
Step 4:  Content Service (depends on User model for populates)
Step 5:  API Gateway (routes to Auth, User, Content)
Step 6:  Messaging Service (Socket.io hub, depends on Redis for presence)
Step 7:  Notification Service (Kafka consumer)
Step 8:  Kafka event wiring (Content/User → Kafka → Notification)
Step 9:  Redis caching integration
Step 11: Failure handling and testing
Step 12: Documentation finalization
```

Each step will be verified independently before proceeding.

---

## 13. Summary of Architectural Decisions

| Decision | Rationale |
|---|---|
| **6 services (not more)** | Posts, Loops, Stories share identical patterns — splitting them adds operational cost without architectural benefit |
| **Shared MongoDB** | True DB-per-service would require complex sync/duplication for deeply interlinked User references; logical separation is sufficient for this project |
| **Each service verifies JWT independently** | Eliminates single point of failure and inter-service auth call overhead |
| **Kafka for business events only** | Not every HTTP call goes through Kafka — only meaningful events that trigger cross-service side effects |
| **Kafka for all cross-service events** | Guarantees delivery unlike fire-and-forget alternatives; handles notification generation and any future cross-service side effects |
| **Redis for presence** | Replaces in-memory `userSocketMap`; enables horizontal scaling of Messaging Service |
| **API Gateway does NOT verify auth** | Keep the gateway thin; auth verification stays in each service with the shared secret |
| **Frontend unchanged** | Gateway preserves all URL paths, cookie handling, and WebSocket behavior |

---

*Phase 1 complete. This document serves as the blueprint for all subsequent implementation phases.*
