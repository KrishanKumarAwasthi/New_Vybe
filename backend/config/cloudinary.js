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
        fs.unlinkSync(file);
        console.log(error);
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