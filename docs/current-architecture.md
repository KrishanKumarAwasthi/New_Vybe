# Vybe — Current Monolith Architecture & Analysis (Phase 0)

## 1. Executive Summary

Vybe is a full-stack social media web application currently structured as a classic **Express/Node.js monolithic backend** paired with a **React 19 single-page application (SPA)**. The platform provides key social networking capabilities:
- User authentication and OTP-based password recovery via email
- User profiles, follow/unfollow dynamics, and user discovery
- Media sharing via Posts (images/videos) and Loops (short-form video reels)
- 24-hour ephemeral Stories with viewer tracking
- Interactive engagements (likes, comments, bookmarks)
- Real-time one-on-one instant messaging and online presence tracking via Socket.io
- Activity notifications (likes, comments, new followers)

This document provides a comprehensive technical audit of the existing codebase to establish the baseline for decomposing the monolith into a production-grade microservices architecture.

---

## 2. Technology Stack & Dependencies

### Frontend (`/frontend`)
- **Core**: React 19 (`19.1.0`), Vite (`7.0.0`), React Router DOM (`7.6.3`)
- **State Management**: Redux Toolkit (`@reduxjs/toolkit` `2.8.2`), `react-redux` (`9.2.0`)
- **Styling**: Tailwind CSS (`4.1.11`), `@tailwindcss/vite`, React Icons (`5.5.0`)
- **HTTP Client**: Axios (`1.10.0`) configured with `{ withCredentials: true }`
- **Real-Time Client**: `socket.io-client` (`4.8.1`)
- **Environment**: Single client configuration pointing to `serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:8000"`

### Backend (`/backend`)
- **Runtime & Framework**: Node.js (ES Modules, `"type": "module"`), Express (`5.1.0`)
- **Database & ODM**: MongoDB via Mongoose (`8.16.1`)
- **Real-Time Engine**: Socket.io (`4.8.1`) directly bound to Express HTTP server
- **Authentication & Security**: `jsonwebtoken` (`9.0.2`), `bcryptjs` (`3.0.2`), `cookie-parser` (`1.4.7`), `cors` (`2.8.5`)
- **Media Storage**: Cloudinary SDK (`2.7.0`), Multer (`2.0.1`) disk storage (`./public`)
- **Mailing**: Nodemailer (`7.0.4`) with Gmail transport for OTP delivery

---

## 3. Current Architecture Diagram

```
                                 ┌──────────────────────────────────────────────┐
                                 │                 Frontend                     │
                                 │       React 19 SPA (Port 5173)               │
                                 │   Redux Store / Axios / socket.io-client     │
                                 └──────────────┬───────────────────────────────┘
                                                │
                                                │ HTTP requests (with cookie) &
                                                │ WebSocket handshake
                                                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Backend Monolith (Port 8000)                                 │
│                                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                               Express HTTP Server (index.js)                         │   │
│   │   CORS, Cookie Parser, JSON Body Parser, Static Public Directory                     │   │
│   └───────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬───┘   │
│           │              │              │              │              │              │       │
│           ▼              ▼              ▼              ▼              ▼              ▼       │
│      /api/auth       /api/user      /api/post      /api/loop      /api/story    /api/message │
│      Auth Router    User Router    Post Router    Loop Router    Story Router   Msg Router   │
│           │              │              │              │              │              │       │
│           ▼              ▼              ▼              ▼              ▼              ▼       │
│      Auth Ctrl      User Ctrl      Post Ctrl      Loop Ctrl      Story Ctrl     Msg Ctrl     │
│           │              │              │              │              │              │       │
│           └──────────────┼──────────────┼──────────────┼──────────────┴──────────────┘       │
│                          │              │              │                                     │
│                          ▼              ▼              ▼                                     │
│                     ┌───────────────────────────────────────┐                                │
│                     │       In-Memory Socket.io Hub         │                                │
│                     │             (socket.js)               │                                │
│                     │    userSocketMap = { userId: sock }   │                                │
│                     └───────────────────┬───────────────────┘                                │
│                                         │                                                    │
└─────────────────────────────────────────┼────────────────────────────────────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌────────────────────────┐                     ┌────────────────────────┐
     │        MongoDB         │                     │       Cloudinary       │
     │  Collections:          │                     │  Media Asset Storage   │
     │  - users               │                     │  (Images & Videos)     │
     │  - posts               │                     └────────────────────────┘
     │  - loops               │
     │  - stories             │
     │  - conversations       │
     │  - messages            │
     │  - notifications       │
     └────────────────────────┘
```

---

## 4. Detailed Component & Module Breakdown

### 4.1. Authentication Flow
- **Mechanism**: JWT stored in an HTTP-only cookie named `token`.
- **Token Properties**: Encodes `{ userId }`, signed with `JWT_SECRET`, lifespan set to 10 years (`"10y"`).
- **Cookie Security**:
  ```javascript
  const cookieOptions = {
    httpOnly: true,
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
  }
  ```
- **Endpoints**:
  - `POST /api/auth/signup`: Validates uniqueness of `email` and `userName`, enforces minimum 6-character password, hashes with bcrypt (salt rounds 10), saves user, issues JWT cookie, returns user document.
  - `POST /api/auth/signin`: Verifies `userName` and `password`, issues JWT cookie, returns user document.
  - `GET /api/auth/signout`: Invokes `res.clearCookie("token")`, returns confirmation.
  - `POST /api/auth/sendOtp`: Generates 4-digit numeric OTP, saves `resetOtp`, `otpExpires` (now + 5 mins), `isOtpVerified: false` to user record, sends email via Nodemailer.
  - `POST /api/auth/verifyOtp`: Validates email, matching OTP, and expiry window; sets `isOtpVerified = true` and clears OTP.
  - `POST /api/auth/resetPassword`: Validates that `isOtpVerified` is true, re-hashes new password, updates user, resets verification flag.
- **Middleware (`middlewares/isAuth.js`)**:
  - Reads `req.cookies.token`.
  - Decodes with `jwt.verify(token, process.env.JWT_SECRET)`.
  - Attaches `req.userId = verifyToken.userId` to request context and invokes `next()`.

### 4.2. User Management & Social Graph (`routes/user.routes.js`, `controllers/user.controllers.js`)
- **Endpoints**:
  - `GET /api/user/current`: Retrieves authenticated user with populated `posts`, `loops`, `story`, `following`.
  - `GET /api/user/suggested`: Retrieves all users excluding current user (`_id: { $ne: req.userId }`), excluding password field.
  - `GET /api/user/getProfile/:userName`: Retrieves profile by username with populated `posts`, `loops`, `followers`, `following`.
  - `POST /api/user/editProfile`: Multipart form update for `name`, `userName`, `bio`, `profession`, `gender`, and optional `profileImage` via Cloudinary.
  - `GET /api/user/follow/:targetUserId`: Toggles follow/unfollow:
    - If already following: removes `targetUserId` from `currentUser.following` and `currentUserId` from `targetUser.followers`.
    - If not following: adds mutual references, creates a `Notification` document, looks up target socket ID in `userSocketMap`, and emits real-time event `"newNotification"`.
  - `GET /api/user/followingList`: Returns array of following IDs for the current user.
  - `GET /api/user/search?keyWord=...`: Regex search against `userName` and `name` with case-insensitivity.
  - `GET /api/user/getAllNotifications`: Retrieves notifications where `receiver == req.userId`, populated with sender, receiver, post, and loop.
  - `POST /api/user/markAsRead`: Marks single or array of notifications as read (`isRead: true`).

### 4.3. Content: Posts (`routes/post.routes.js`, `controllers/post.controllers.js`)
- **Endpoints**:
  - `POST /api/post/upload`: Receives multipart file `media`, `caption`, `mediaType` (`"image" | "video"`). Uploads to Cloudinary, creates `Post`, appends `post._id` to `user.posts`, returns populated post.
  - `GET /api/post/getAll`: Fetches all posts sorted by `createdAt: -1`, populating `author` and `comments.author`.
  - `GET /api/post/like/:postId`: Toggles like:
    - If already liked: pulls `req.userId` from `post.likes`.
    - If new like: pushes `req.userId`. If liker is not author, creates `Notification` and emits `"newNotification"` to author socket.
    - Emits broadcast event `"likedPost"` containing `{ postId, likes }` to all connected clients.
  - `POST /api/post/comment/:postId`: Pushes `{ author: req.userId, message }` into `post.comments`. If commenter is not author, creates `Notification` and emits `"newNotification"`. Emits broadcast event `"commentedPost"` to all connected clients.
  - `GET /api/post/saved/:postId`: Toggles post ID in `user.saved` array.
  - `DELETE /api/post/delete/:postId`: Verifies author ownership, deletes media asset from Cloudinary via `deleteFromCloudinary`, deletes post document, removes ID from `user.posts` and all `user.saved` arrays.

### 4.4. Content: Loops (`routes/loop.routes.js`, `controllers/loop.controllers.js`)
- **Endpoints**:
  - `POST /api/loop/upload`: Uploads video loop to Cloudinary, creates `Loop`, appends ID to `user.loops`.
  - `GET /api/loop/getAll`: Fetches all loops populated with `author` and `comments.author`.
  - `GET /api/loop/like/:loopId`: Toggles like, creates notification, emits `"newNotification"` to author, broadcasts `"likedLoop"` to all clients.
  - `POST /api/loop/comment/:loopId`: Adds comment, creates notification, emits `"newNotification"` to author, broadcasts `"commentedLoop"` to all clients.

### 4.5. Content: Stories (`routes/story.routes.js`, `controllers/story.controllers.js`)
- **Endpoints**:
  - `POST /api/story/upload`: Checks if user already has an active story; if so, deletes the old story. Uploads new story to Cloudinary, saves `Story` record (with 24h TTL index `expires: 86400`), assigns `user.story = story._id`.
  - `GET /api/story/getByUserName/:userName`: Finds user's active story populated with `author` and `viewers`.
  - `GET /api/story/getAll`: Finds stories posted by all users in current user's `following` array.
  - `GET /api/story/view/:storyId`: Records current user in story's `viewers` array if not already present.

### 4.6. Messaging & Real-Time Chat (`routes/message.routes.js`, `controllers/message.controllers.js`)
- **Endpoints**:
  - `POST /api/message/send/:receiverId`: Accepts text `message` and optional multipart `image`. Creates `Message` document. Finds or creates `Conversation` containing `[senderId, receiverId]` and appends message ID. Emits real-time event `"newMessage"` directly to receiver's socket ID via `getSocketId(receiverId)`.
  - `GET /api/message/getAll/:receiverId`: Retrieves conversation between sender and receiver with populated `messages`.
  - `GET /api/message/prevChats`: Finds all conversations involving `currentUserId`, extracts distinct participants, and returns previous chat user cards.

### 4.7. Real-Time Engine (`socket.js`)
- An in-memory JavaScript object `userSocketMap = {}` stores `{ [userId]: socket.id }`.
- On connection (`io.on("connection")`):
  - Reads `userId` from `socket.handshake.query.userId`.
  - Records mapping: `userSocketMap[userId] = socket.id`.
  - Emits `"getOnlineUsers"` with `Object.keys(userSocketMap)` to all clients.
- On disconnect (`socket.on("disconnect")`):
  - Deletes mapping `delete userSocketMap[userId]`.
  - Re-emits `"getOnlineUsers"` to all clients.
- Exported helper `getSocketId(receiverId)` allows controllers to target specific recipients.

---

## 5. Complete API Route Inventory

| Route | Method | Middleware | Controller Action | Target Collection |
|---|---|---|---|---|
| `/api/auth/signup` | POST | None | `signUp` | `User` |
| `/api/auth/signin` | POST | None | `signIn` | `User` |
| `/api/auth/signout` | GET | None | `signOut` | None (clears cookie) |
| `/api/auth/sendOtp` | POST | None | `sendOtp` | `User` |
| `/api/auth/verifyOtp` | POST | None | `verifyOtp` | `User` |
| `/api/auth/resetPassword` | POST | None | `resetPassword` | `User` |
| `/api/user/current` | GET | `isAuth` | `getCurrentUser` | `User` (populates posts, loops, story, following) |
| `/api/user/suggested` | GET | `isAuth` | `suggestedUsers` | `User` |
| `/api/user/getProfile/:userName` | GET | `isAuth` | `getProfile` | `User` (populates posts, loops, followers, following) |
| `/api/user/follow/:targetUserId` | GET | `isAuth` | `follow` | `User`, `Notification` |
| `/api/user/followingList` | GET | `isAuth` | `followingList` | `User` |
| `/api/user/search` | GET | `isAuth` | `search` | `User` |
| `/api/user/editProfile` | POST | `isAuth`, `upload.single("profileImage")` | `editProfile` | `User` |
| `/api/user/getAllNotifications` | GET | `isAuth` | `getAllNotifications` | `Notification` |
| `/api/user/markAsRead` | POST | `isAuth` | `markAsRead` | `Notification` |
| `/api/post/upload` | POST | `isAuth`, `upload.single("media")` | `uploadPost` | `Post`, `User` |
| `/api/post/getAll` | GET | `isAuth` | `getAllPosts` | `Post` |
| `/api/post/like/:postId` | GET | `isAuth` | `like` | `Post`, `Notification` |
| `/api/post/comment/:postId` | POST | `isAuth` | `comment` | `Post`, `Notification` |
| `/api/post/saved/:postId` | GET | `isAuth` | `saved` | `User` |
| `/api/post/delete/:postId` | DELETE | `isAuth` | `deletePost` | `Post`, `User` |
| `/api/loop/upload` | POST | `isAuth`, `upload.single("media")` | `uploadLoop` | `Loop`, `User` |
| `/api/loop/getAll` | GET | `isAuth` | `getAllLoops` | `Loop` |
| `/api/loop/like/:loopId` | GET | `isAuth` | `like` | `Loop`, `Notification` |
| `/api/loop/comment/:loopId` | POST | `isAuth` | `comment` | `Loop`, `Notification` |
| `/api/story/upload` | POST | `isAuth`, `upload.single("media")` | `uploadStory` | `Story`, `User` |
| `/api/story/getByUserName/:userName` | GET | `isAuth` | `getStoryByUserName` | `Story`, `User` |
| `/api/story/getAll` | GET | `isAuth` | `getAllStories` | `Story`, `User` |
| `/api/story/view/:storyId` | GET | `isAuth` | `viewStory` | `Story` |
| `/api/message/send/:receiverId` | POST | `isAuth`, `upload.single("image")` | `sendMessage` | `Message`, `Conversation` |
| `/api/message/getAll/:receiverId` | GET | `isAuth` | `getAllMessages` | `Conversation`, `Message` |
| `/api/message/prevChats` | GET | `isAuth` | `getPrevUserChats` | `Conversation`, `User` |

---

## 6. Monolithic Couplings & Architectural Flaws

During code inspection, several tight couplings and architectural bottlenecks were identified:

### 6.1. In-Process Memory Socket State (`userSocketMap`)
- The active socket map is stored in process heap: `const userSocketMap = {}`.
- **Limitation**: The system cannot scale horizontally. If multiple instances of the backend were run behind a round-robin load balancer, a client connected to Instance A could not receive notifications or messages triggered by an action on Instance B.
- **Microservices Impact**: Independent services (e.g. Content Service or User Service) cannot access `socket.js` running in another service to emit `"newNotification"` or `"likedPost"`.

### 6.2. Synchronous Inline Notification Creation
- When a user likes a post, comments, or follows someone, the controller synchronously creates a `Notification` document inside the primary HTTP request lifecycle.
- If the Notification insert fails or encounters latency, the user's primary action is slowed or degraded.
- **Solution in Target Architecture**: The primary action should emit an asynchronous event via Kafka (e.g., `POST_LIKED`, `USER_FOLLOWED`), allowing the Notification Service to consume and persist it independently.

### 6.3. Relational Cross-Document Array Mutation
- The `User` document maintains arrays: `posts: [ObjectId]`, `saved: [ObjectId]`, `loops: [ObjectId]`, `story: ObjectId`.
- Whenever a post or loop is created or deleted, both `Post`/`Loop` and `User` collections are updated in separate queries without distributed transactions.
- In `getCurrentUser`, Mongoose deeply populates `posts loops posts.author posts.comments story following`, loading massive object graphs on every page load.
- **Solution in Target Architecture**: Let the Content Service own posts, loops, and saved items, querying by `authorId` rather than maintaining redundant array references on the user record.

### 6.4. Mixed Route Responsibilities
- Notification fetching and read status management (`/api/user/getAllNotifications` and `/api/user/markAsRead`) are placed inside `user.routes.js` and `user.controllers.js`.
- These are distinct from user identity and profile management and naturally belong to a dedicated Notification Service.

---

## 7. Natural Domain Boundaries & Service Extraction Plan

Based on actual dependencies, database models, and communication patterns, the monolith cleanly divides into the following **6 services**:

```
                                  ┌───────────────────────────┐
                                  │        API Gateway        │
                                  │   (Reverse Proxy / Auth)  │
                                  └─────────────┬─────────────┘
                                                │
         ┌───────────────────┬──────────────────┼──────────────────┬──────────────────┐
         ▼                   ▼                  ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│   Auth Service  │ │  User Service   │ │ Content Service │ │Messaging Service│ │Notification Svc  │
│                 │ │                 │ │ (Post/Loop/Sty) │ │   (Socket.io)   │ │  (Event-Driven)  │
│ - Signup/Signin │ │ - Profiles      │ │ - Posts         │ │ - 1-on-1 Chats  │ │ - In-app alerts  │
│ - OTP Flow      │ │ - Social Graph  │ │ - Loops         │ │ - Real-Time WS  │ │ - Unread counts  │
│ - JWT Tokens    │ │ - Search        │ │ - Stories       │ │ - Conversations │ │ - Read states    │
│                 │ │ - Discovery     │ │ - Engagements   │ │ - Online Status │ │                  │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘ └──────────────────┘
```

### 1. API Gateway
- Ingress point for all client traffic (`http://localhost:8000`).
- Routes requests to corresponding microservices based on URL path prefixes:
  - `/api/auth/*` -> Auth Service
  - `/api/user/*` -> User Service
  - `/api/post/*`, `/api/loop/*`, `/api/story/*` -> Content Service
  - `/api/message/*` -> Messaging Service
  - `/api/notifications/*` (and legacy `/api/user/*notifications*`) -> Notification Service
  - `/socket.io/*` -> Messaging Service (WebSocket upgrade handling)
- Preserves cookies (`token`), handles CORS uniformly, and centralizes rate limiting/logging.

### 2. Auth Service
- **Domain**: Identity validation, registration, session issuance, credential recovery.
- **Database Ownership**: User credentials (`email`, `userName`, `password`, `resetOtp`, `otpExpires`, `isOtpVerified`).
- **Dependencies**: Nodemailer (Gmail), `bcryptjs`, `jsonwebtoken`.

### 3. User Service
- **Domain**: User public profiles, biography, avatar, search, and social graph (followers/following).
- **Database Ownership**: Public user metadata (`name`, `userName`, `profileImage`, `bio`, `profession`, `gender`, `followers`, `following`).
- **Integration**: Emits `USER_FOLLOWED` / `USER_UNFOLLOWED` events to Kafka.

### 4. Content Service
- **Domain**: All creative user media (Posts, Loops, Stories) and interactions (likes, comments, saved items).
- **Rationale for Unifying Posts, Loops, and Stories**:
  - They share identical schemas, Cloudinary media pipelines, like/comment mechanics, and author references.
  - Splitting them into 3 distinct microservices would create unjustified operational overhead with near-identical logic.
- **Database Ownership**: `posts`, `loops`, `stories` collections.
- **Integration**: Emits `POST_CREATED`, `POST_LIKED`, `POST_COMMENTED`, `LOOP_LIKED`, `LOOP_COMMENTED`, `STORY_CREATED` events to Kafka.

### 5. Messaging Service (with Real-Time Engine)
- **Domain**: 1-on-1 direct messaging, conversation histories, image messaging, and live socket connections.
- **Database Ownership**: `conversations`, `messages` collections.
- **Real-Time Responsibilities**:
  - Hosts the Socket.io WebSocket server.
  - Maintains online user presence backed by Redis (replacing the local in-memory object).
  - Emits `"newMessage"` to recipient sockets.
  - Subscribes to notification and content broadcasts from Redis or Kafka to relay to clients.

### 6. Notification Service
- **Domain**: Persisting and serving user notifications.
- **Database Ownership**: `notifications` collection.
- **Integration**:
  - Consumes events from Kafka (`POST_LIKED`, `COMMENT_CREATED`, `USER_FOLLOWED`, etc.).
  - Writes notification records to MongoDB.
  - Publishes real-time notification alerts to Messaging Service/Redis to notify connected users.

---

## 8. Migration Safety & Preservation Strategy

1. **Zero Frontend Rewrites**:
   - The API Gateway will preserve exact URL paths, headers, and cookie behaviors so that the React SPA continues working without rewriting component logic.
2. **Backward-Compatible Endpoints**:
   - Routes like `/api/user/getAllNotifications` and `/api/user/markAsRead` will be routed through the gateway to the Notification Service transparently.
3. **Graceful Fallbacks**:
   - If Redis is unavailable, the application can fall back to MongoDB.
   - If Kafka is momentarily unavailable, critical path user operations (e.g. creating a post or liking) should succeed even if notification generation is queued or deferred.

---

*Inspection completed as part of Phase 0. Baseline documented for architecture proposal in Phase 1.*
