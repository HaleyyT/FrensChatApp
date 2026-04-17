import mongoose from "mongoose";

const connectToMongoDB = async () => {
    // Fail fast when required config is missing instead of starting a half-configured server.
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not set");
    }

    try {
        await mongoose.connect(process.env.MONGO_URI); 
        console.log("Connected to mongoDB");
        console.log("Mongo host:", mongoose.connection.host);
        console.log("Mongo db:", mongoose.connection.name);
    } catch(error) {
        console.error('Error connecting to MongoDB:', error.message);
        // Re-throw so server startup can stop cleanly when the DB is unavailable.
        throw error;
    }
};

export default connectToMongoDB;
