import mongoose from "mongoose";

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("[Notification Service] MongoDB connected")
    } catch (error) {
        console.log("[Notification Service] MongoDB connection error:", error)
        throw error
    }
}

export default connectDb
