import Redis from "ioredis";

export const redisClient = new Redis(process.env.REDIS_URL || "redis://redis:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
});

redisClient.on("error", (err) => {
    console.error("[Content Service] Redis Client Error:", err.message);
});

export const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log("[Content Service] Redis connected");
    } catch (error) {
        console.error("[Content Service] Failed to connect to Redis:", error.message);
    }
};
