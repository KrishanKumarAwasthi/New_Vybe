/**
 * Kafka event type constants — shared across all services.
 * 
 * Import in producers:
 *   import { EVENTS, TOPICS } from "../shared/events.js"
 * 
 * Each service copies or symlinks this file as needed.
 */

// ─── Topics ─────────────────────────────────────────────
export const TOPICS = {
    CONTENT_EVENTS: "content-events",
    USER_EVENTS: "user-events",
    MESSAGE_EVENTS: "message-events",
}

// ─── Event Types ────────────────────────────────────────
export const EVENTS = {
    // Content Service → Notification Service
    POST_CREATED: "POST_CREATED",
    POST_LIKED: "POST_LIKED",
    POST_COMMENTED: "POST_COMMENTED",
    POST_DELETED: "POST_DELETED",
    LOOP_CREATED: "LOOP_CREATED",
    LOOP_LIKED: "LOOP_LIKED",
    LOOP_COMMENTED: "LOOP_COMMENTED",
    STORY_CREATED: "STORY_CREATED",

    // User Service → Notification Service
    USER_FOLLOWED: "USER_FOLLOWED",

    // Messaging Service → (future use)
    MESSAGE_SENT: "MESSAGE_SENT",
}
