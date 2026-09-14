import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from "cookie-parser"
import { createProxyMiddleware } from "http-proxy-middleware"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import axios from "axios"

dotenv.config()

const app = express()
const port = process.env.PORT || 8000

// ─── Trust Proxy (required behind Render/Vercel reverse proxy) ───
app.set("trust proxy", 1)

// ─── Security & Rate Limiting ─────────────────────────────
app.use(helmet()) // Security headers

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // limit each IP to 2000 requests per windowMs
    message: { message: "Too many requests from this IP, please try again later." }
})
app.use(globalLimiter)

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs for auth
    message: { message: "Too many authentication requests from this IP, please try again later." }
})

// ─── CORS ────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map(s => s.trim())

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error(`CORS not allowed for origin: ${origin}`))
        }
    },
    credentials: true
}))
app.use(cookieParser())

// ─── Health Check ────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ service: "api-gateway", status: "healthy", timestamp: new Date().toISOString() })
})

// ─── Service URLs ────────────────────────────────────────
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001"
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3002"
const CONTENT_SERVICE_URL = process.env.CONTENT_SERVICE_URL || "http://localhost:3003"
const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || "http://localhost:3004"
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3005"

app.get("/health/all", async (req, res) => {
    const services = {
        auth: AUTH_SERVICE_URL,
        user: USER_SERVICE_URL,
        content: CONTENT_SERVICE_URL,
        messaging: MESSAGING_SERVICE_URL,
        notification: NOTIFICATION_SERVICE_URL
    }

    const results = {}
    let allHealthy = true

    for (const [name, url] of Object.entries(services)) {
        try {
            await axios.get(`${url}/health`, { timeout: 3000 })
            results[name] = "up"
        } catch (error) {
            results[name] = "down"
            allHealthy = false
        }
    }

    res.status(allHealthy ? 200 : 503).json({
        service: "api-gateway",
        status: allHealthy ? "healthy" : "degraded",
        downstream: results,
        timestamp: new Date().toISOString()
    })
})

// ─── Proxy Options Factory ──────────────────────────────
const createProxy = (target, pathFilter, pathRewrite) => {
    const options = {
        target,
        changeOrigin: true,
        proxyTimeout: 60000, // 60 seconds timeout for downstream (allows file uploads)
        timeout: 60000, // 60 seconds timeout for incoming requests
        // Forward cookies and headers
        cookieDomainRewrite: "",
        on: {
            proxyReq: (proxyReq, req) => {
                // Forward the cookie header
                if (req.headers.cookie) {
                    proxyReq.setHeader("cookie", req.headers.cookie)
                }
            },
            proxyRes: (proxyRes, req, res) => {
                // Forward set-cookie headers from downstream
                const setCookieHeaders = proxyRes.headers["set-cookie"]
                if (setCookieHeaders) {
                    res.setHeader("set-cookie", setCookieHeaders)
                }
            },
            error: (err, req, res) => {
                console.error(`Proxy error for ${req.url}:`, err.message)
                if (!res.headersSent) {
                    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
                        res.status(504).json({ message: "Gateway Timeout", error: err.message })
                    } else {
                        res.status(502).json({ message: "Bad Gateway", error: err.message })
                    }
                }
            }
        }
    }
    if (pathFilter) {
        options.pathFilter = pathFilter
    }
    if (pathRewrite) {
        options.pathRewrite = pathRewrite
    }
    return createProxyMiddleware(options)
}

// ─── Route Proxies ──────────────────────────────────────

// Notification Service overrides (must come before general User Service)
app.use(createProxy(NOTIFICATION_SERVICE_URL, "/api/user/getAllNotifications", {
    "^/api/user/getAllNotifications": "/api/notifications/getAll"
}))
app.use(createProxy(NOTIFICATION_SERVICE_URL, "/api/user/markAsRead", {
    "^/api/user/markAsRead": "/api/notifications/markAsRead"
}))

// Standard Services
app.use("/api/auth", authLimiter)
app.use(createProxy(AUTH_SERVICE_URL, "/api/auth"))
app.use(createProxy(USER_SERVICE_URL, "/api/user"))
app.use(createProxy(CONTENT_SERVICE_URL, "/api/post"))
app.use(createProxy(CONTENT_SERVICE_URL, "/api/loop"))
app.use(createProxy(CONTENT_SERVICE_URL, "/api/story"))
app.use(createProxy(MESSAGING_SERVICE_URL, "/api/message"))
app.use(createProxy(NOTIFICATION_SERVICE_URL, "/api/notifications"))

// ─── Socket.io WebSocket Proxy ──────────────────────────
const wsProxy = createProxyMiddleware({
    target: MESSAGING_SERVICE_URL,
    changeOrigin: true,
    ws: true,
    on: {
        error: (err, req, res) => {
            console.error("WebSocket proxy error:", err.message)
        }
    }
})
app.use("/socket.io", wsProxy)

// ─── Fallback ───────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ message: "Route not found on gateway" })
})

// ─── Start ──────────────────────────────────────────────
const server = app.listen(port, () => {
    console.log(`[API Gateway] running on port ${port}`)
    console.log(`  → Auth Service:         ${AUTH_SERVICE_URL}`)
    console.log(`  → User Service:         ${USER_SERVICE_URL}`)
    console.log(`  → Content Service:      ${CONTENT_SERVICE_URL}`)
    console.log(`  → Messaging Service:    ${MESSAGING_SERVICE_URL}`)
    console.log(`  → Notification Service: ${NOTIFICATION_SERVICE_URL}`)
})

server.on('upgrade', wsProxy.upgrade)
