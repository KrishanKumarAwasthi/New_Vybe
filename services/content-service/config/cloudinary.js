import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"

const configCloudinary = () => {
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        configCloudinary();
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return response.secure_url;
    } catch (error) {
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        console.log("Cloudinary upload error:", error);
        return null;
    }
}

export const deleteFromCloudinary = async (mediaUrl, resourceType) => {
    try {
        configCloudinary();
        const urlObj = new URL(mediaUrl);
        const pathParts = urlObj.pathname.split('/');
        const uploadIndex = pathParts.findIndex(p => p === 'upload');
        let fullPublicId = '';
        if (uploadIndex !== -1 && pathParts.length > uploadIndex + 1) {
            let startIndex = uploadIndex + 1;
            if (pathParts[startIndex].match(/^v\d+$/)) {
                startIndex++;
            }
            const publicPath = pathParts.slice(startIndex).join('/');
            fullPublicId = publicPath.split('.')[0];
        }
        if (fullPublicId) {
            await cloudinary.uploader.destroy(fullPublicId, { resource_type: resourceType === 'video' ? 'video' : 'image' });
        }
    } catch (error) {
        console.log("Delete from cloudinary error:", error);
    }
}

export default uploadOnCloudinary;
