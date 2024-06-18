import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js";
import {upload} from '../middlewares/multer.middleware.js';
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        // accepting two files, avatar and coverImage
        {
            name : "avatar",
            maxCount : 1
        },
        {
            name : "coverImage",
            maxCount : 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser); 

// secured routes
router.route("/logout").post(verifyJWT,logoutUser);
// bss verifyJWT likhne se ye middle ware add hogya
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT,changeCurrentPassword);
router.route("/current-user").get(verifyJWT,getCurrentUser);
router.route("/update-account").patch(verifyJWT,updateAccountDetails);
// .patch, qki post me saari details update hojyengi
router.route("/avatar-update").patch(verifyJWT,upload.single("avatar"),updateUserAvatar);
router.route("/cover-image-update").patch(verifyJWT,upload.single("/coverImage"),updateUserCoverImage);
// from params
router.route("/channel/:username").get(verifyJWT,getUserChannelProfile);
router.route("/watch-history").get(verifyJWT,getWatchHistory);

export default router;