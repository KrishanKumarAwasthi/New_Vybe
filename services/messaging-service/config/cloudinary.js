import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"

const configCloudinary = () => {
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const uploadOnCloudinary = async (file) => {
    try {
        configCloudinary();
        const result = await cloudinary.uploader.upload(file, {
            resource_type: 'auto',
        });
        fs.unlinkSync(file);
        return result.secure_url;
    } catch (error) {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
        console.log("Cloudinary upload error:", error);
    }
}

export default uploadOnCloudinary;
