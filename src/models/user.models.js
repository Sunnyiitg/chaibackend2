import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"; 
const userSchema = new Schema(
    {
        userName : {
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
            index : true,
        },
        email : {
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
        },
        fullName : {
            type : String,
            required : true,
            trim : true,
            index : true,
        },
        avatar : {
            type : String, //cloudinary URL
            required : true,
        },
        coverImage : {
            type : String, //cloudinary URL
        },
        watchhistory : [
            {
                type : Schema.Types.ObjectId,
                ref : "Video",
            }
        ],
        password : {
            type : String, // database me encrypt password rkhte h
            required : [true,'Password is required'],
        },
        refreshToken : {
            type : String
        }
    },
    {
        timestamps : true,
    }
);
userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();
    this.password = bcrypt.hash(this.password,10);
    next();
})
userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password,this.password);
    // user written password and encrypted wala
    // it returns true and false
}
userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email : this.email,
            username : this.userName,
            fullName : this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function() {
    // refresh token me info kum hoti hai, qki bar bar refresh hoti h
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn : process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
export const User = mongoose.model("User",userSchema);