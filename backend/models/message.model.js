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
    }
    //createdAt, updatedAt
    //mongoose shows the time messages sent
}, {timestamps: true});

//creates model message with messageSchema
const Message = mongoose.model("Message", messageSchema);

