import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async() => {
    try {
        const connectionInstance = await mongoose.connect
        (`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MongoDB connected !! HOST: ${connectionInstance}`);
        console.log(`\n MongoDB connected !! HOST: ${connectionInstance.connection.host}`);

    } catch (err) {
        console.log("error while connecting DB",error);
        process.exit(1);
    }
};

export default connectDB;