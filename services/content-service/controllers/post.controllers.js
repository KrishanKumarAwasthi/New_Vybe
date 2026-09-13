import uploadOnCloudinary, { deleteFromCloudinary } from "../config/cloudinary.js";
import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../utils/kafka/producer.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { redisClient } from "../config/redis.js";

export const uploadPost = async (req, res) => {
    try {
        const { caption, mediaType } = req.body
        let media;
        if (req.file) {
            media = await uploadOnCloudinary(req.file.path)
        } else {
            return res.status(400).json({ message: "media is required" })
        }
        const post = await Post.create({
            caption, media, mediaType, author: req.userId
        })
        const user = await User.findById(req.userId)
        if (user) {
            user.posts.push(post._id)
            await user.save()
        }
        const populatedPost = await Post.findById(post._id).populate("author", "name userName profileImage")
        
        // Cache Invalidation
        try {
            await redisClient.del("posts:feed");
        } catch (redisError) {
            console.error("[Content Service] Redis invalidation failed:", redisError.message);
        }

        return res.status(201).json(populatedPost)
    } catch (error) {
        return res.status(500).json({ message: `uploadPost error ${error}` })
    }
}

export const getAllPosts = async (req, res) => {
    try {
        const cacheKey = "posts:feed";

        // Try hitting cache first
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(JSON.parse(cachedData));
            }
        } catch (redisError) {
            console.error("[Content Service] Redis get failed:", redisError.message);
        }

        // Cache miss or Redis failed
        const posts = await Post.find({})
            .populate("author", "name userName profileImage")
            .populate("comments.author", "name userName profileImage").sort({ createdAt: -1 })

        // Set cache with 2 minutes TTL (120 seconds)
        try {
            await redisClient.setex(cacheKey, 120, JSON.stringify(posts));
        } catch (redisError) {
            console.error("[Content Service] Redis set failed:", redisError.message);
        }

        return res.status(200).json(posts)
    } catch (error) {
        return res.status(500).json({ message: `getallpost error ${error}` })
    }
}

export const like = async (req, res) => {
    try {
        const postId = req.params.postId
        const post = await Post.findById(postId)
        if (!post) {
            return res.status(400).json({ message: "post not found" })
        }

        const alreadyLiked = post.likes.some(id => id.toString() === req.userId.toString())

        if (alreadyLiked) {
            post.likes = post.likes.filter(id => id.toString() !== req.userId.toString())
        } else {
            post.likes.push(req.userId)
            if (post.author.toString() !== req.userId.toString()) {
                const eventId = uuidv4();
                publishEvent("content-events", "POST_LIKED", {
                    eventId,
                    postId: post._id,
                    postOwnerId: post.author,
                    userId: req.userId
                });
                // Note: Real-time notification emission will be restored via Redis Pub/Sub in later phase
            }
        }

        await post.save()
        await post.populate("author", "name userName profileImage")
        // Note: Real-time broadcast 'likedPost' will be restored via Redis Pub/Sub in later phase
        
        // Cache Invalidation
        try {
            await redisClient.del("posts:feed");
        } catch (redisError) {
            console.error("[Content Service] Redis invalidation failed:", redisError.message);
        }

        return res.status(200).json(post)
    } catch (error) {
        return res.status(500).json({ message: `likepost error ${error}` })
    }
}

export const comment = async (req, res) => {
    try {
        const { message } = req.body
        const postId = req.params.postId
        const post = await Post.findById(postId)
        if (!post) {
            return res.status(400).json({ message: "post not found" })
        }
        post.comments.push({
            author: req.userId,
            message
        })
        if (post.author.toString() !== req.userId.toString()) {
            const eventId = uuidv4();
            publishEvent("content-events", "POST_COMMENTED", {
                eventId,
                postId: post._id,
                postOwnerId: post.author,
                userId: req.userId,
                message
            });
            // Note: Real-time notification emission will be restored via Redis Pub/Sub in later phase
        }
        await post.save()
        await post.populate("author", "name userName profileImage")
        await post.populate("comments.author")
        // Note: Real-time broadcast 'commentedPost' will be restored via Redis Pub/Sub in later phase
        
        // Cache Invalidation
        try {
            await redisClient.del("posts:feed");
        } catch (redisError) {
            console.error("[Content Service] Redis invalidation failed:", redisError.message);
        }

        return res.status(200).json(post)
    } catch (error) {
        return res.status(500).json({ message: `comment post error ${error}` })
    }
}

export const saved = async (req, res) => {
    try {
        const postId = req.params.postId
        const user = await User.findById(req.userId)
        if (!user) {
            return res.status(400).json({ message: "user not found" })
        }

        const alreadySaved = user.saved.some(id => id.toString() === postId.toString())

        if (alreadySaved) {
            user.saved = user.saved.filter(id => id.toString() !== postId.toString())
        } else {
            user.saved.push(postId)
        }
        await user.save()
        await user.populate("saved")
        return res.status(200).json(user)
    } catch (error) {
        return res.status(500).json({ message: `saved  error ${error}` })
    }
}

export const deletePost = async (req, res) => {
    try {
        const postId = req.params.postId
        const post = await Post.findById(postId)
        if (!post) {
            return res.status(404).json({ message: "post not found" })
        }

        if (post.author.toString() !== req.userId.toString()) {
            return res.status(403).json({ message: "unauthorized to delete this post" })
        }

        // Delete media from cloudinary
        if (post.media) {
            await deleteFromCloudinary(post.media, post.mediaType)
        }

        // Delete the post
        await Post.findByIdAndDelete(postId)

        // Remove from user's posts
        await User.findByIdAndUpdate(req.userId, {
            $pull: { posts: postId }
        })

        // Remove from any user's saved array
        await User.updateMany(
            { saved: postId },
            { $pull: { saved: postId } }
        )

        // Cache Invalidation
        try {
            await redisClient.del("posts:feed");
        } catch (redisError) {
            console.error("[Content Service] Redis invalidation failed:", redisError.message);
        }

        return res.status(200).json({ message: "post deleted successfully", postId })
    } catch (error) {
        return res.status(500).json({ message: `delete post error ${error}` })
    }
}
