import uploadOnCloudinary from "../config/cloudinary.js"
import { v4 as uuidv4 } from "uuid";
import { publishEvent } from "../utils/kafka/producer.js";
import User from "../models/user.model.js"
// Import models to ensure they are registered with Mongoose for populate()
import "../models/post.model.js"
import "../models/loop.model.js"
import "../models/story.model.js"
import { redisClient } from "../config/redis.js"

export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId
        const user = await User.findById(userId).populate("posts loops posts.author posts.comments story following")
        if (!user) {
            return res.status(400).json({ message: "user not found" })
        }

        return res.status(200).json(user)
    } catch (error) {
        return res.status(500).json({ message: `get current user error ${error}` })
    }
}

export const suggestedUsers = async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.userId }
        }).select("-password")
        return res.status(200).json(users)
    } catch (error) {
        return res.status(500).json({ message: `get suggested user error ${error}` })
    }
}

export const editProfile = async (req, res) => {
    try {
        const { name, userName, bio, profession, gender } = req.body
        const user = await User.findById(req.userId).select("-password")
        if (!user) {
            return res.status(400).json({ message: "user not found" })
        }

        const sameUserWithUserName = await User.findOne({ userName }).select("-password")

        if (sameUserWithUserName && sameUserWithUserName._id.toString() !== req.userId.toString()) {
            return res.status(400).json({ message: "userName already exist" })
        }

        let profileImage;
        if (req.file) {
            profileImage = await uploadOnCloudinary(req.file.path)
        }

        user.name = name
        user.userName = userName
        if (profileImage) {
            user.profileImage = profileImage
        }
        user.bio = bio
        user.profession = profession
        user.gender = gender

        await user.save()

        // Cache Invalidation
        try {
            await redisClient.del(`user:profile:${user.userName}`);
        } catch (redisError) {
            console.error("[User Service] Redis invalidation failed:", redisError.message);
        }

        return res.status(200).json(user)

    } catch (error) {
        return res.status(500).json({ message: `edit profile error ${error}` })
    }
}

export const getProfile = async (req, res) => {
    try {
        const userName = req.params.userName;
        const cacheKey = `user:profile:${userName}`;

        // Try hitting cache first
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.status(200).json(JSON.parse(cachedData));
            }
        } catch (redisError) {
            console.error("[User Service] Redis get failed:", redisError.message);
        }

        // Cache miss or Redis failed
        const user = await User.findOne({ userName }).select("-password").populate("posts loops followers following")
        if (!user) {
            return res.status(400).json({ message: "user not found" })
        }

        // Set cache with 5 minutes TTL (300 seconds)
        try {
            await redisClient.setex(cacheKey, 300, JSON.stringify(user));
        } catch (redisError) {
            console.error("[User Service] Redis set failed:", redisError.message);
        }

        return res.status(200).json(user)
    } catch (error) {
        return res.status(500).json({ message: `get profile error ${error}` })
    }
}

export const follow = async (req, res) => {
    try {
        const currentUserId = req.userId
        const targetUserId = req.params.targetUserId

        if (!targetUserId) {
            return res.status(400).json({ message: "target user is not found" })
        }

        if (currentUserId === targetUserId) {
            return res.status(400).json({ message: "you can not follow yourself." })
        }

        const currentUser = await User.findById(currentUserId)
        const targetUser = await User.findById(targetUserId)

        if (!currentUser || !targetUser) {
            return res.status(404).json({ message: "user not found" })
        }

        const isFollowing = currentUser.following.includes(targetUserId)

        if (isFollowing) {
            currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId)
            targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId)
            await currentUser.save()
            await targetUser.save()
            
            // Cache Invalidation
            try {
                await redisClient.del(`user:profile:${currentUser.userName}`);
                await redisClient.del(`user:profile:${targetUser.userName}`);
            } catch (redisError) {
                console.error("[User Service] Redis invalidation failed:", redisError.message);
            }

            return res.status(200).json({
                following: false,
                message: "unfollow successfully"
            })
        } else {
            currentUser.following.push(targetUserId)
            targetUser.followers.push(currentUserId)
            if (currentUser._id.toString() !== targetUser._id.toString()) {
                const eventId = uuidv4();
                publishEvent("user-events", "USER_FOLLOWED", {
                    eventId,
                    followerId: currentUser._id,
                    followedUserId: targetUser._id
                });
            }
            await currentUser.save()
            await targetUser.save()

            // Cache Invalidation
            try {
                await redisClient.del(`user:profile:${currentUser.userName}`);
                await redisClient.del(`user:profile:${targetUser.userName}`);
            } catch (redisError) {
                console.error("[User Service] Redis invalidation failed:", redisError.message);
            }

            return res.status(200).json({
                following: true,
                message: "follow successfully"
            })
        }

    } catch (error) {
        return res.status(500).json({ message: `follow error ${error}` })
    }
}

export const followingList = async (req, res) => {
    try {
        const result = await User.findById(req.userId)
        return res.status(200).json(result?.following)
    } catch (error) {
        return res.status(500).json({ message: `following error ${error}` })
    }
}

export const search = async (req, res) => {
    try {
        const keyWord = req.query.keyWord

        if (!keyWord) {
            return res.status(400).json({ message: "keyword is required" })
        }

        const users = await User.find({
            $or: [
                { userName: { $regex: keyWord, $options: "i" } },
                { name: { $regex: keyWord, $options: "i" } }
            ]
        }).select("-password")

        return res.status(200).json(users)

    } catch (error) {
        return res.status(500).json({ message: `search error ${error}` })
    }
}
