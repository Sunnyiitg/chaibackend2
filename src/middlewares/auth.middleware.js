// ye sirf verify krega ki user hai ya nahi hai
// qki jab user ko login kraya toh acces and refresh token de diya
// yahi true login hai
// mera starategy hai ki mai request k andr ek nya object add krdunga

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import {User} from "../models/user.models.js"

// req.user, req.sunny bhi krskte but doesn't make sense
// middleware me next bhi add krna pdta h
export const verifyJWT = asyncHandler(async(req,_,next) => {
    // req.cookies se saare cookies milenge 
    try {
        const token = req.cookies?.accessToken || 
        req.header("Authorization")?.replace("Bearer ","");
    
        if(!token) {
            throw new ApiError(401,"Unautorized request");
        }
        // have token => check if token is right or not and its data
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id).select(
            "-password -refreshToken")
        if(!user) {
            throw new ApiError(401,"Invalid access token");
        }
        // request k andr nya object daal denge
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid access token");
    }
})