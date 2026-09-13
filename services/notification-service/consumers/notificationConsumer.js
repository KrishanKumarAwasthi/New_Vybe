import Notification from "../models/notification.model.js"
import { connectConsumer } from "../utils/kafka/consumer.js"

export const startNotificationConsumer = async () => {
    // We subscribe to content-events and user-events
    await connectConsumer(["content-events", "user-events"], async (payload, topic) => {
        const { eventId, eventType, timestamp, ...data } = payload

        // 1. Idempotency Check: if this exact eventId has been processed, skip
        if (eventId) {
            const existing = await Notification.findOne({ eventId })
            if (existing) {
                console.log(`[Notification Service] Skipping duplicate eventId: ${eventId}`)
                return
            }
        }

        try {
            switch (eventType) {
                case "USER_FOLLOWED": {
                    const { followerId, followedUserId } = data
                    await Notification.create({
                        eventId,
                        sender: followerId,
                        receiver: followedUserId,
                        type: "follow",
                        message: "started following you"
                    })
                    break
                }
                case "POST_LIKED": {
                    const { postId, postOwnerId, userId } = data
                    if (userId === postOwnerId) return // don't notify self
                    await Notification.create({
                        eventId,
                        sender: userId,
                        receiver: postOwnerId,
                        type: "like",
                        message: "liked your post",
                        post: postId
                    })
                    break
                }
                case "POST_COMMENTED": {
                    const { postId, postOwnerId, userId, message } = data
                    if (userId === postOwnerId) return
                    await Notification.create({
                        eventId,
                        sender: userId,
                        receiver: postOwnerId,
                        type: "comment",
                        message: `commented on your post: ${message.substring(0, 20)}...`,
                        post: postId
                    })
                    break
                }
                case "LOOP_LIKED": {
                    const { loopId, loopOwnerId, userId } = data
                    if (userId === loopOwnerId) return
                    await Notification.create({
                        eventId,
                        sender: userId,
                        receiver: loopOwnerId,
                        type: "like",
                        message: "liked your loop",
                        loop: loopId
                    })
                    break
                }
                case "LOOP_COMMENTED": {
                    const { loopId, loopOwnerId, userId, message } = data
                    if (userId === loopOwnerId) return
                    await Notification.create({
                        eventId,
                        sender: userId,
                        receiver: loopOwnerId,
                        type: "comment",
                        message: `commented on your loop: ${message.substring(0, 20)}...`,
                        loop: loopId
                    })
                    break
                }
                default:
                    console.warn(`[Notification Service] Unknown eventType: ${eventType}`)
            }
        } catch (error) {
            if (error.code === 11000) {
                // MongoDB unique constraint violation on eventId (race condition handling)
                console.log(`[Notification Service] Duplicate eventId ignored via MongoDB unique index: ${eventId}`)
            } else {
                console.error(`[Notification Service] Failed to process event ${eventType}:`, error)
            }
        }
    })
}
