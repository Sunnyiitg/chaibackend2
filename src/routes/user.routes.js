import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controller.js";
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

export default router;