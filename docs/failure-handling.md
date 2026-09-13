# Vybe Phase 8: Failure Handling & Resilience

This document outlines the system resilience and expected failure handling behavior across the Vybe microservices architecture. The system is designed to degrade gracefully without employing overly complex "enterprise-grade" solutions (like service meshes or distributed circuit breakers).

## Core Resilience Principles
1. **Isolation of Failures**: A failure in one microservice or infrastructure component must not unnecessarily crash other healthy components.
2. **Graceful Degradation**: If non-critical infrastructure (e.g., Redis or Kafka) goes offline, operations should fall back to primary sources (MongoDB) or gracefully skip the non-critical step.
3. **No Indefinite Hanging**: Requests must time out quickly and return an appropriate 5xx HTTP response to the client.

---

## Infrastructure Failure Handling

### 1. API Gateway Failures
The API Gateway acts as a reverse proxy for all microservices.
- **Upstream Service Down**: If a downstream service (e.g., `user-service`) goes offline, the gateway relies on `http-proxy-middleware`'s built-in `proxyTimeout: 10000` (10 seconds). Any connection refusals or timeouts are automatically caught by the global error handler (`on.error`), returning a standard `502 Bad Gateway` or `504 Gateway Timeout` response.
- **Gateway Health**: The `/health/all` endpoint performs liveliness checks across all services. If a service is down, it returns a `503 Service Unavailable` with degraded statuses attached, ensuring monitoring tools know the exact state of the system without hanging.

### 2. Redis Cache Failures
Redis is explicitly used strictly as a cache layer and not a source of truth.
- **Driver Resilience**: `ioredis` is configured with `enableOfflineQueue: false` and a maximum retry delay of 3 seconds. This ensures that offline cache operations fail-fast rather than queuing indefinitely and consuming memory.
- **Fallback Mechanism**: All Redis cache checks (e.g., in `getProfile` or `getAllPosts`) are wrapped in `try...catch` blocks. If `redisClient.get()` or `redisClient.setex()` throws an error due to disconnection, the error is logged, and the query falls back seamlessly to MongoDB.

### 3. Apache Kafka Failures
Kafka is used asynchronously for notifications and analytics.
- **Producer Failures**: The Kafka producer wrapper (`publishEvent`) utilizes a fire-and-forget mechanism wrapped in a `try...catch` block. If Kafka is unavailable, the `kafkajs` producer throws an error which is caught and logged. The parent business operation (e.g., Liking a post) continues successfully and returns a `200 OK` response to the client.
- **Consumer Resilience**: The Notification Service wraps its entire payload processing `switch` block in a `try...catch`. If a malformed payload is ingested, the consumer will log the error and move on, preventing unhandled exceptions from crashing the consumer loop.
- **Event Idempotency**: Before generating a notification, the consumer checks MongoDB for the uniqueness of the `eventId`. If duplicate events are received due to Kafka network retries or misconfigurations, they are safely ignored.

### 4. MongoDB Failures
MongoDB is the primary source of truth.
- **Connection Loss**: Mongoose automatically buffers commands briefly during connection loss. If the timeout expires or the database is completely offline, Mongoose throws a `MongooseServerSelectionError`.
- **API Response**: Since all controller actions are wrapped in `try...catch`, this database exception is caught and the client receives a structured `500 Internal Server Error`, preventing hanging requests.

### 5. Socket.io & Real-time Failures
Socket.io is managed internally by the Messaging Service.
- **Message Integrity**: The `sendMessage` controller explicitly persists the message to MongoDB **before** attempting to emit via Socket.io. If Socket.io emission fails, or the recipient is offline, the message is safely stored in the database. When the user reconnects, they fetch the missing messages via standard REST endpoints.
- **Disconnection Handling**: The `userSocketMap` cleanly removes socket IDs on the `disconnect` event, preventing memory leaks and stalled broadcasts.

---

## Testing & Verification
A test harness script was utilized during Phase 8 to verify the above behavior via Docker container manipulation (`docker stop <container>`). 
- Validated that proxy layer returns `502` when upstream is killed.
- Validated that `getProfile` correctly falls back to MongoDB when the Redis container is killed.
- Validated that Follow actions return 200 when Kafka container is killed.
- Validated Idempotency by manually pumping duplicate events via `kafkajs`.
