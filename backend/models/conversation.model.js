import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
    {
        conversationKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
            sparse: true,
        },
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],
        message: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Message",
                default: [],
            },
        ],
    },
    {timestamps: true}
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
