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
            refreshToken : 1
            // this removes the field from document
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

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword} = req.body;
    // agar password change kar pa rha hai mtlb logged in hai
    // middleware laga hai toh req.user kr skte hai
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword); 
    // returns true/false
    if(!isPasswordCorrect) {
        throw new ApiError(400,"Invalid Old Password");
    }
    // need to set new password
    user.password = newPassword; 
    //save krne prr pre hook chl jyega
    await user.save({validateBeforeSave : false});
    return res
        .status(200)
        .json(new ApiResponse(200,{},"Password Change Done"));
})

const getCurrentUser = asyncHandler(async(req,res) => {
    // because of middle ware req.user
    return res
            .status(200)
            .json(new ApiResponse(200,req.user,"user fetched"));
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName, email} = req.body;
    if(!fullName && !email) {
        throw new ApiError(400,"All field are missing");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName : fullName,
                email : email,
            }
        },
        {new : true} // update hone k baad wala return
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200,user,"Account Updated"));
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    // req.files mila multr middleware k through
    // yha prr sirf ek file chahiye
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath) {
        throw new ApiError(400,"avatar file is missing");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url) {
        throw new ApiError(400,"Error while uploading on cloudinary");
    }
    // update avatar field, req.user because of auth middleware
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                avatar: avatar.url,
            }
        },
        {new : true}
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200,user,"Avatar updated")
        )
})

const updateUserCoverImage = asyncHandler(async(req,res) => {
    // req.files mila multr middleware k through
    // yha prr sirf ek file chahiye
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath) {
        throw new ApiError(400,"cover image file is missing");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage.url) {
        throw new ApiError(400,"Error while uploading on cloudinary");
    }
    // update cover field, req.user because of auth middleware
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                coverImage: coverImage.url,
            }
        },
        {new : true}
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200,user,"Cover updated")
        )
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    // usually channel pe url se jata h => params
    const {userName} = req.params;
    if(!userName?.trim()) {
        throw new ApiError(400,"username is missing");
    }
    // return is array in aggregate
    const channel = await User.aggregate([
        {
            $match: {
                userName : userName?.toLowerCase()
            }
        },
        {
            $lookup : {
                from: "subscriptions",
                // DB me Subscription -> subscriptions
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup : {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount : {
                    $size: "$subscribers", //field
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if : {$in: [req.user?._id,"$subscribers.subscriber"]},
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            // selected cheeje deta h, 1 means yes
            $project : {
                fullName: 1,
                userName: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);
    console.log(channel);
    if(!channel?.length) {
        throw new ApiError("channel does not exist");
    }
    return res
            .status(200)
            .json(new ApiResponse(200,channel[0],"User Channel fetched"));
})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
        {
            $match : {
                _id: new mongoose.Types.ObjectId(req.user._id),
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    // ab videos k andr hu
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        userName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // sara data owner k field me hai as array
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(200,user[0].watchHistory,"Watch History Fetched");
})

export {
          registerUser, 
          loginUser,
          logoutUser, 
          refreshAccessToken, 
          changeCurrentPassword,
          getCurrentUser,
          updateAccountDetails,
          updateUserAvatar,
          updateUserCoverImage,
          getUserChannelProfile,
          getWatchHistory,
        };