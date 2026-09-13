import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
import mongoose from "mongoose"
import authRouter from "./routes/auth.routes.js"

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

app.use(express.json())
app.use(cookieParser())

// ─── Health Check ────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ service: "auth-service", status: "healthy", timestamp: new Date().toISOString() })
})

// ─── Routes ──────────────────────────────────────────────
app.use("/api/auth", authRouter)

// ─── Start ──────────────────────────────────────────────
const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("[Auth Service] MongoDB connected")
        app.listen(port, () => {
            console.log(`[Auth Service] running on port ${port}`)
        })
    } catch (error) {
        console.error("[Auth Service] startup failed:", error)
        process.exit(1)
    }
}

startServer()
