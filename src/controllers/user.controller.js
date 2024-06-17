import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from '../utils/ApiError.js';
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);
        if(!user){
            throw new ApiError(500,"error while generating token in try");
        }
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        // refresh token ko database me save krke rkhte hai, taki
        // baar baar user se password naa dalwana pde
        // need to add value in User
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        // mtlb validation mtt lagao, bss save krdo
        return {accessToken,refreshToken};
    } catch (error) {
        throw new ApiError(500,"error while generating tokens");
    }
}

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
    const existedUser = await User.findOne({
        $or: [{userName}, {email}]
    })
    if(existedUser) {
        throw new ApiError(409,"User exists with same username or email");
    }
    // avatar and coverimage check
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    // classic way to check
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage)
    && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

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

const loginUser = asyncHandler(async(req,res) => {
    // get data from req.body()
    // as of now don't know email or username send 
    const {email,userName,password} = req.body;
    // validate data, username or email based login
    if(!userName && !email){
        throw new ApiError(400,"username or email is required");
    }
    // find the user
    // ya toh email ya username se dhundna hai
    // or find krega user ya toh email ya username se
    const user= await User.findOne({
        $or: [{email}, {userName}]
    })
    if(!user){
        throw new ApiError(400,"User Doesn't Exist");
    }
    // if found, password match
    // User se method access nahi krna hai
    // jo methods maine bnaya hai wo mere user me available h
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid) {
        throw new ApiError(401,"Wrong Password");
    }
    // if matched, access and refres token generate 
    // ye kayi baar hoga isliye alg method bna dete hai upr
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id);
    const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken");
    // send these tokens to secure cookies
    // need to design options/object for cookie
    const options = {
        httpOnly : true,
        secure : true
    }
    // cookie ko koi bhi modify kr skta hai frontend me by default
    // prr httpOnly: true ans secure : true krne se ye cookie
    // sirf server se modify ho skti hai
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser, accessToken, refreshToken
            },
            "User Logged In Successfully"
        )
    )
    // send response
})

const logoutUser = asyncHandler(async(req,res) => {
    // jab logout krunga toh cookie htana hoga
    // refresh token ko bhi reset krna pdega
    // middleware use kr skte hai in cheejo k liye
    // ab mai req.user use krskta  qki middle ware se add kra tha
    await User.findByIdAndUpdate(req.user._id,{
        // jisko update krna hai, set operator use krna pdta h
        $set : {
            refreshToken : undefined
        }
        },
        {
            new : true
            // isse jo return me response milega usme new updated value milegi
        }
    )
    const options = {
        httpOnly : true,
        secure : true
    }
    // cookie clear krni h 
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User Logged Out"));
})

// end point
const refreshAccessToken = asyncHandler(async(req,res) => {
    // mere pass h refresh access token,
    //  refresstoken bhejna hi pdega
    // can access through cookie
    const incomingRefreshToken = req.cookies.refreshToken 
                                || req.body.refreshToken;
    if(!incomingRefreshToken) {
        throw new ApiError(401,"Unauthorized request");
    }
    try {
        // verify token
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
        // refresh token me sirf ID dali thi
        const user = await User.findById(decodedToken?._id);
        if(!user) {
            throw new ApiError(401,"invalid refresh token");
        }
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used");
        }
        const options = {
            httpOnly : true,
            secure : true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken,
                },
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || 
            "invalid refresh token , catch"
        )
    }
})
export {registerUser, loginUser,logoutUser, refreshAccessToken};