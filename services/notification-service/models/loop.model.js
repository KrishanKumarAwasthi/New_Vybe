import mongoose from "mongoose";

const loopSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    media: {
        type: String,
        required: true
    },
    caption: {
        type: String
    }
}, { timestamps: true })

const Loop = mongoose.models.Loop || mongoose.model("Loop", loopSchema)
export default Loop
