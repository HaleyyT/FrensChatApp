import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: String,
  messageId: { type: mongoose.Schema.Types.ObjectId, required: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ publishedAt: 1, createdAt: 1 });
schema.index({ publishedAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model("ModerationOutbox", schema);
