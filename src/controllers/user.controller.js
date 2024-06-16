import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from '../utils/ApiError.js';
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async(req,res) => {
    // get user data from frontend
    // form ya json se aarha hai data toh req.body me mil jyega
    const {fullName, email, userName, password} = req.body;
    console.log(fullName,email,userName,password);
    // validation
    // if(fullName === ""){
    //     throw new ApiError(400,"Full Name is Required")
    // };
    if(
        [fullName, email, userName, password].some((element) =>
        element?.trim() === "")
    ) {
        throw new ApiError(400, "Some Data Missing");
    }
    // check if user already exist
    const existedUser = User.findOne({
        $or: [{userName}, {email}]
    })
    if(existedUser) {
        throw new ApiError(409,"User exists with same username or email");
    }
    // avatar and coverimage check
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    // these local path may or may not exist so check these
    if(!avatarLocalPath) {
        throw new ApiError(400,"Avatar File is Necessary");
    }
    // upload them to cloudinary and verify
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar) {
        throw new ApiError(400, "failure in avatar uploading");
    }
    // create user object (mongoDB me object dete h)
    // create entry in DB
    const userData = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        // since no verification for coverImage
        email,
        password,
        userName : userName.toLowerCase()
    });
    // mongoDB me jo bhi bnta hai wo as itis response me aata h
    // check for user created or not
    // remove password and refresh token field from response
    const createdUser = await User.findById(userData._id)
                        .select(
                            // kya kya nahi chahiye likhte hai - sign k sath
                            "-password -refreshToken"
                        );
    if(!createdUser) {
        throw new ApiError(500,"something went wrong while registering user");
    }
    // return response using ApiResponse
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User Registered Successfully")
    );
});

export {registerUser};