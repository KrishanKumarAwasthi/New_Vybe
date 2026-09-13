import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import messageRouter from "./routes/message.routes.js"
import { app, io, server } from "./socket.js"

dotenv.config()

const port = process.env.PORT || 3004

app.use(express.json())
app.use(cookieParser())

// ─── Health Check ────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ service: "messaging-service", status: "healthy", timestamp: new Date().toISOString() })
})

// ─── Routes ──────────────────────────────────────────────
app.use("/api/message", messageRouter)

// ─── Start ──────────────────────────────────────────────
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("[Messaging Service] MongoDB connected")
        server.listen(port, () => {
            console.log(`[Messaging Service] running on port ${port}`)
        })
    } catch (error) {
        console.error("[Messaging Service] startup failed:", error)
        process.exit(1)
    }
}

startServer()

export { app, io, server }
