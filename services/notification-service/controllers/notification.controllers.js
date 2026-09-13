import Notification from "../models/notification.model.js"
// Import models so Mongoose registers them for populate()
import "../models/user.model.js"
import "../models/post.model.js"
import "../models/loop.model.js"

export const getAllNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            receiver: req.userId
        }).populate("sender receiver post loop").sort({ createdAt: -1 })
        return res.status(200).json(notifications)
    } catch (error) {
        return res.status(500).json({ message: `get notification error ${error}` })
    }
}

export const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.body

        if (Array.isArray(notificationId)) {
            // bulk mark-as-read
            await Notification.updateMany(
                { _id: { $in: notificationId }, receiver: req.userId },
                { $set: { isRead: true } }
            )
        } else {
            // mark single notification as read
            await Notification.findOneAndUpdate(
                { _id: notificationId, receiver: req.userId },
                { $set: { isRead: true } }
            )
        }
        return res.status(200).json({ message: "marked as read" })

    } catch (error) {
        return res.status(500).json({ message: `read notification error ${error}` })
    }
}
