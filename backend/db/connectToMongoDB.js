import mongoese from 'mongoose';

const connectToMongoDB = async () => {
    try {
        await mongoese.connect(process.env.MONGO_URI); 
        console.log("Connected to mongoDB");
    } catch(error) {
        console.error('Error connecting to MongoDB:', error.message);
    }
};

export default connectToMongoDB;