import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { getAllNotifications, markAsRead } from "../controllers/notification.controllers.js"

const notificationRouter = express.Router()

// Matches /api/notifications/getAll (from API gateway rewrite of /api/user/getAllNotifications)
notificationRouter.get("/getAll", isAuth, getAllNotifications)

// Direct or legacy convenience routes
notificationRouter.get("/getAllNotifications", isAuth, getAllNotifications)
notificationRouter.get("/", isAuth, getAllNotifications)

// Matches /api/notifications/markAsRead (from API gateway rewrite or direct)
notificationRouter.post("/markAsRead", isAuth, markAsRead)

export default notificationRouter
