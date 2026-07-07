const cloudinary = require('../config/cloudinary');

class CloudinaryService {
    async uploadImage(file, folder) {
        try {
            const result = await cloudinary.uploader.upload(file, {
                folder: `rapidjob/${folder}`,
                resource_type: 'auto'
            });
            return result;
        } catch (error) {
            throw error;
        }
    }

    async uploadResume(file) {
        try {
            const result = await cloudinary.uploader.upload(file, {
                folder: 'rapidjob/resumes',
                resource_type: 'raw',
                format: 'pdf'
            });
            return result;
        } catch (error) {
            throw error;
        }
    }

    async deleteFile(publicId) {
        try {
            return await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new CloudinaryService();
