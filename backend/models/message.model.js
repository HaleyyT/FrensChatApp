import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    senderId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiverId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    message:{
        type: String,
        required: true
    },
    deliveredAt:{
        type: Date,
        default: null
    },
    readAt:{
        type: Date,
        default: null
    }
    //createdAt, updatedAt
    //mongoose shows the time messages sent
}, {timestamps: true});

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, readAt: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, createdAt: -1 });

//creates model message with messageSchema
const Message = mongoose.model("Message", messageSchema);

export default Message;
