import uploadOnCloudinary from "../config/cloudinary.js";
import Loop from "../models/loop.model.js";
import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../utils/kafka/producer.js";
import User from "../models/user.model.js";

export const uploadLoop = async (req, res) => {
    try {
        const { caption } = req.body
        let media;
        if (req.file) {
            media = await uploadOnCloudinary(req.file.path)
        } else {
            return res.status(400).json({ message: "media is required" })
        }
        const loop = await Loop.create({
            caption, media, author: req.userId
        })
        const user = await User.findById(req.userId)
        if (user) {
            user.loops.push(loop._id)
            await user.save()
        }
        const populatedLoop = await Loop.findById(loop._id).populate("author", "name userName profileImage")
        return res.status(201).json(populatedLoop)
    } catch (error) {
        return res.status(500).json({ message: `uploadloop error ${error}` })
    }
}

export const like = async (req, res) => {
    try {
        const loopId = req.params.loopId
        const loop = await Loop.findById(loopId)
        if (!loop) {
            return res.status(400).json({ message: "loop not found" })
        }

        const alreadyLiked = loop.likes.some(id => id.toString() === req.userId.toString())

        if (alreadyLiked) {
            loop.likes = loop.likes.filter(id => id.toString() !== req.userId.toString())
        } else {
            loop.likes.push(req.userId)
            if (loop.author.toString() !== req.userId.toString()) {
                const eventId = uuidv4();
                publishEvent("content-events", "LOOP_LIKED", {
                    eventId,
                    loopId: loop._id,
                    loopOwnerId: loop.author,
                    userId: req.userId
                });
                // Note: Real-time notification emission will be restored via Redis Pub/Sub in later phase
            }
        }
        await loop.save()
        await loop.populate("author", "name userName profileImage")
        // Note: Real-time broadcast 'likedLoop' will be restored via Redis Pub/Sub in later phase
        return res.status(200).json(loop)
    } catch (error) {
        return res.status(500).json({ message: `like loop error ${error}` })
    }
}

export const comment = async (req, res) => {
    try {
        const { message } = req.body
        const loopId = req.params.loopId
        const loop = await Loop.findById(loopId)
        if (!loop) {
            return res.status(400).json({ message: "loop not found" })
        }
        loop.comments.push({
            author: req.userId,
            message
        })
        if (loop.author.toString() !== req.userId.toString()) {
            const eventId = uuidv4();
            publishEvent("content-events", "LOOP_COMMENTED", {
                eventId,
                loopId: loop._id,
                loopOwnerId: loop.author,
                userId: req.userId,
                message
            });
            // Note: Real-time notification emission will be restored via Redis Pub/Sub in later phase
        }
        await loop.save()
        await loop.populate("author", "name userName profileImage")
        await loop.populate("comments.author")
        // Note: Real-time broadcast 'commentedLoop' will be restored via Redis Pub/Sub in later phase
        return res.status(200).json(loop)
    } catch (error) {
        return res.status(500).json({ message: `comment loop error ${error}` })
    }
}

export const getAllLoops = async (req, res) => {
    try {
        const loops = await Loop.find({}).populate("author", "name userName profileImage")
            .populate("comments.author")
        return res.status(200).json(loops)
    } catch (error) {
        return res.status(500).json({ message: `get all loop error ${error}` })
    }
}
