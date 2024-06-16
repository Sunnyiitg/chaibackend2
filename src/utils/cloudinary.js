import {v2 as cloudinary} from "cloudinary";
import fs from "fs";
// fs is file system
// in node we get file system
// it helps in CRUD file
// unlink(path) => file delete krne k baad unlink krna pdta h
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto"
        })
        // file has been uploaded successfully
        console.log('File Uploaded Successfully on cloudinary');
        console.log(response.url); //gives public url
        fs.unlinkSync(localFilePath); 
        return response;
    } catch (error) {
        //remove the locally saved temporay file as the upload operation failed 
        fs.unlinkSync(localFilePath); 
        return null;
    }
}
export {uploadOnCloudinary};