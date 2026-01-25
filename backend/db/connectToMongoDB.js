import mongoose from "mongoose";

const connectToMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI); 
        console.log("Connected to mongoDB");
        console.log("Mongo host:", mongoose.connection.host);
        console.log("Mongo db:", mongoose.connection.name);
    } catch(error) {
        console.error('Error connecting to MongoDB:', error.message);
    }
};

export default connectToMongoDB;