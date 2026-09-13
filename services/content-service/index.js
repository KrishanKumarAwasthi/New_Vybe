import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import postRouter from "./routes/post.routes.js"
import loopRouter from "./routes/loop.routes.js"
import storyRouter from "./routes/story.routes.js"
import { connectProducer } from "./utils/kafka/producer.js"
import { connectRedis } from "./config/redis.js"

dotenv.config()

const app = express()
const port = process.env.PORT || 3003

app.use(express.json())
app.use(cookieParser())

// ─── Health Check ────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ service: "content-service", status: "healthy", timestamp: new Date().toISOString() })
})

// ─── Routes ──────────────────────────────────────────────
app.use("/api/post", postRouter)
app.use("/api/loop", loopRouter)
app.use("/api/story", storyRouter)

// ─── Start ──────────────────────────────────────────────
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("[Content Service] MongoDB connected")
        await connectProducer()
        await connectRedis()
        app.listen(port, () => {
            console.log(`[Content Service] running on port ${port}`)
        })
    } catch (error) {
        console.error("[Content Service] startup failed:", error)
        process.exit(1)
    }
}

startServer()
