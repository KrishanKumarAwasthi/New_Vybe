# Kafka Events Documentation

This document describes the asynchronous events published to Kafka in Phase 5. Kafka is used for meaningful business events, specifically shifting the synchronous Notification creation out of the critical path of API requests.

## Event Idempotency

All Kafka events contain a unique `eventId` (a UUIDv4 generated at the time of the action). The Notification Service consumer uses this `eventId` to ensure exactly-once processing (idempotency) by storing it in a unique index in MongoDB.
- If Kafka delivers the same event twice, the consumer catches the Duplicate Key error (Code 11000) and safely ignores it.
- If a user performs an action (e.g., likes a post), un-does it, and performs it again, a brand new `eventId` is generated, and the consumer processes it normally.

## Failure Behavior & Trade-offs

If the Kafka publisher fails (e.g., Kafka is down):
- The error is caught and logged by the producer utility.
- The HTTP request does **not** fail. The primary database action (e.g., saving the Like to MongoDB) succeeds and the user receives a `200 OK` response.
- **Trade-off**: In Phase 5, if Kafka is down, a notification will be permanently missed. We chose to prioritize the core application behavior (letting users like and comment without errors) over guaranteeing notification delivery. Over-engineering an outbox pattern or retry queue is out of scope for Phase 5.

---

## Implemented Events

### 1. `POST_LIKED`
- **Producer**: Content Service
- **Topic**: `content-events`
- **Consumer**: Notification Service
- **Purpose**: Triggers when a user likes a post.
- **Payload Structure**:
  ```json
  {
    "eventId": "uuid-string",
    "eventType": "POST_LIKED",
    "postId": "ObjectId-string",
    "postOwnerId": "ObjectId-string",
    "userId": "ObjectId-string",
    "timestamp": "ISO-8601-string"
  }
  ```
- **Consumer Action**: Creates a Notification of type `like` pointing to the Post, from `userId` to `postOwnerId`.

### 2. `POST_COMMENTED`
- **Producer**: Content Service
- **Topic**: `content-events`
- **Consumer**: Notification Service
- **Purpose**: Triggers when a user comments on a post.
- **Payload Structure**:
  ```json
  {
    "eventId": "uuid-string",
    "eventType": "POST_COMMENTED",
    "postId": "ObjectId-string",
    "postOwnerId": "ObjectId-string",
    "userId": "ObjectId-string",
    "message": "string",
    "timestamp": "ISO-8601-string"
  }
  ```
- **Consumer Action**: Creates a Notification of type `comment` with a preview of the message.

### 3. `LOOP_LIKED`
- **Producer**: Content Service
- **Topic**: `content-events`
- **Consumer**: Notification Service
- **Purpose**: Triggers when a user likes a loop.
- **Payload Structure**:
  ```json
  {
    "eventId": "uuid-string",
    "eventType": "LOOP_LIKED",
    "loopId": "ObjectId-string",
    "loopOwnerId": "ObjectId-string",
    "userId": "ObjectId-string",
    "timestamp": "ISO-8601-string"
  }
  ```
- **Consumer Action**: Creates a Notification of type `like` pointing to the Loop.

### 4. `LOOP_COMMENTED`
- **Producer**: Content Service
- **Topic**: `content-events`
- **Consumer**: Notification Service
- **Purpose**: Triggers when a user comments on a loop.
- **Payload Structure**:
  ```json
  {
    "eventId": "uuid-string",
    "eventType": "LOOP_COMMENTED",
    "loopId": "ObjectId-string",
    "loopOwnerId": "ObjectId-string",
    "userId": "ObjectId-string",
    "message": "string",
    "timestamp": "ISO-8601-string"
  }
  ```
- **Consumer Action**: Creates a Notification of type `comment` with a preview of the message.

### 5. `USER_FOLLOWED`
- **Producer**: User Service
- **Topic**: `user-events`
- **Consumer**: Notification Service
- **Purpose**: Triggers when a user follows another user.
- **Payload Structure**:
  ```json
  {
    "eventId": "uuid-string",
    "eventType": "USER_FOLLOWED",
    "followerId": "ObjectId-string",
    "followedUserId": "ObjectId-string",
    "timestamp": "ISO-8601-string"
  }
  ```
- **Consumer Action**: Creates a Notification of type `follow` from the follower to the followed user.
