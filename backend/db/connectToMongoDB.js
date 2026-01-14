import mongoese from 'mongoose';

const connectToMongoDB = async () => {
    try {
        await mongoese.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        }). then(() =>
            console.log('MongoDB connection established successfully')
        );
        console.log('Connected to MongoDB successfully');
    } catch(error) {
        console.error('Error connecting to MongoDB:', error);
    };
}