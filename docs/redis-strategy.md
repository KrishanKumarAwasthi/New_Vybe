# Redis Strategy (Phase 6)

## 1. Why Redis is Being Used
Redis is used as a read-through cache to reduce the load on MongoDB for frequently accessed, read-heavy endpoints. It operates strictly as a caching layer and is not used for sessions, messaging, or persistent state.

## 2. Cached Endpoints
Only the following two read-heavy endpoints are cached:
- **Content Service**: `GET /api/post/getAll` (The global feed)
- **User Service**: `GET /api/user/getProfile/:userName` (User profiles)

## 3. Cache Keys
- **Global Post Feed**: `posts:feed`
- **User Profile**: `user:profile:<userName>`

## 4. TTL (Time To Live)
- **Post Feed**: 2 minutes (120 seconds).
- **User Profile**: 5 minutes (300 seconds).

## 5. Cache Hit/Miss Flow
1. **Request Received**: The service checks Redis using the defined cache key.
2. **Cache HIT**: If data exists, it is parsed from JSON and returned immediately. MongoDB is not queried.
3. **Cache MISS**: If data is missing (expired or not yet cached), the service queries MongoDB, serializes the response to JSON, stores it in Redis with the TTL, and returns the response.

## 6. Cache Invalidation Strategy
Caches are proactively invalidated to prevent stale data when relevant mutations occur. We use a simple `DEL` command rather than complex consistency frameworks.

**Post Feed (`posts:feed`) is invalidated when:**
- A new post is uploaded (`/api/post/upload`)
- A post is deleted (`/api/post/delete/:postId`)
- A post is liked (`/api/post/like/:postId`) - because the feed includes like arrays.
- A post is commented on (`/api/post/comment/:postId`) - because the feed includes comments.

**User Profile (`user:profile:<userName>`) is invalidated when:**
- The user edits their profile (`/api/user/editProfile`).
- The user follows or unfollows someone (`/api/user/follow/:targetUserId`) - invalidates both the follower's and the followed user's profile caches to reflect updated follower/following counts.

## 7. Redis Failure Fallback
Redis is not a single point of failure. 
- All Redis client operations (`get`, `setex`, `del`) are wrapped in `try/catch` blocks.
- If Redis is unavailable or fails to respond, the error is logged and the application gracefully falls back to querying MongoDB.
- Mutative operations will still successfully write to MongoDB even if the subsequent cache invalidation in Redis fails.

## 8. Post Feed Scope
The existing `GET /api/post/getAll` endpoint returns all posts globally (sorted by newest), regardless of which user is authenticated. Therefore, a single global cache key (`posts:feed`) is used. If the endpoint is later updated to serve personalized feeds (e.g., only posts from followed users), the cache key will need to be scoped per user (e.g., `posts:feed:<userId>`).

## 9. Differentiation from Kafka
In this architecture:
- **Redis** is strictly for synchronous data caching to optimize read performance.
- **Kafka** (implemented in Phase 5) is strictly for asynchronous event-driven business flows (e.g., generating notifications without blocking the HTTP response). Redis does NOT replace Kafka, nor does it handle background tasks or messaging.
