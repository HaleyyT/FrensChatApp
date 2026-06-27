import mongoose from "mongoose";
import { loadConfig } from "../utils/config.js";

const connectToMongoDB = async () => {
    const { MONGO_URI } = loadConfig();

    try {
        await mongoose.connect(MONGO_URI); 
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
