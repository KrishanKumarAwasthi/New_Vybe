import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import notificationRouter from "./routes/notification.routes.js"

dotenv.config()

const app = express()
const port = process.env.PORT || 3005

app.use(express.json())
app.use(cookieParser())

// ─── Health Check ────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ service: "notification-service", status: "healthy", timestamp: new Date().toISOString() })
})

// ─── Routes ──────────────────────────────────────────────
app.use("/api/notifications", notificationRouter)

// ─── Kafka Consumer ───────────────────────────────────────────────
import { startNotificationConsumer } from "./consumers/notificationConsumer.js"
startNotificationConsumer()

// ─── Start ──────────────────────────────────────────────
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("[Notification Service] MongoDB connected")
        app.listen(port, () => {
            console.log(`[Notification Service] running on port ${port}`)
        })
    } catch (error) {
        console.error("[Notification Service] startup failed:", error)
        process.exit(1)
    }
}

startServer()
