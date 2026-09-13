import http from "http"
import express from "express"
import { Server } from "socket.io"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"

dotenv.config()

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
})

const userSocketMap = {}

export const getSocketId = (receiverId) => {
    return userSocketMap[receiverId]
}

io.use((socket, next) => {
    try {
        const cookieHeader = socket.handshake.headers.cookie
        if (!cookieHeader) {
            return next(new Error("Authentication error: No cookies"))
        }

        const cookies = cookieHeader.split(';').reduce((res, item) => {
            const data = item.trim().split('=')
            return { ...res, [data[0]]: data[1] }
        }, {})

        const token = cookies.token
        if (!token) {
            return next(new Error("Authentication error: No token"))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        socket.userId = decoded.userId
        next()
    } catch (error) {
        next(new Error("Authentication error: Invalid token"))
    }
})

io.on("connection", (socket) => {
    const userId = socket.userId
    if (userId !== undefined && userId !== "undefined") {
        userSocketMap[userId] = socket.id
        console.log(`[Messaging Service] user connected: ${userId} (socket ${socket.id})`)
    }

    io.emit('getOnlineUsers', Object.keys(userSocketMap))

    socket.on('disconnect', () => {
        if (userId !== undefined && userId !== "undefined") {
            delete userSocketMap[userId]
            console.log(`[Messaging Service] user disconnected: ${userId}`)
        }
        io.emit('getOnlineUsers', Object.keys(userSocketMap))
    })
})

export { app, io, server }
