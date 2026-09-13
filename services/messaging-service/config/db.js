import mongoose from "mongoose";

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("[Messaging Service] MongoDB connected")
    } catch (error) {
        console.log("[Messaging Service] MongoDB connection error:", error)
        throw error
    }
}

export default connectDb
