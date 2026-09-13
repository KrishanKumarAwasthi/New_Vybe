import Redis from "ioredis";

export const redisClient = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy(times) {
        // Prevent infinite retries if Redis goes down, max 3 seconds delay
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
});

redisClient.on("error", (err) => {
    console.error("[User Service] Redis Client Error:", err.message);
});

export const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log("[User Service] Redis connected");
    } catch (error) {
        console.error("[User Service] Failed to connect to Redis:", error.message);
        // Do not crash the app, just log it. The app will fallback to MongoDB.
    }
};
