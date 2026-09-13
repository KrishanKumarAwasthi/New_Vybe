import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import userRouter from "./routes/user.routes.js"
import { connectProducer } from "./utils/kafka/producer.js"
import { connectRedis } from "./config/redis.js"

dotenv.config()

const app = express()
const port = process.env.PORT || 3002

app.use(express.json())
app.use(cookieParser())

// ─── Health Check ────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ service: "user-service", status: "healthy", timestamp: new Date().toISOString() })
})

// ─── Routes ──────────────────────────────────────────────
app.use("/api/user", userRouter)

// ─── Start ──────────────────────────────────────────────
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("[User Service] MongoDB connected")
        await connectProducer()
        await connectRedis()
        app.listen(port, () => {
            console.log(`[User Service] running on port ${port}`)
        })
    } catch (error) {
        console.error("[User Service] startup failed:", error)
        process.exit(1)
    }
}

startServer()
