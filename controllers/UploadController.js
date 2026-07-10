const CloudinaryService = require('../services/CloudinaryService');
const { db } = require('../firebase-admin');
const fs = require('fs');

class UploadController {
    async uploadProfilePhoto(req, res) {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            const uid = req.user.uid;

            const result = await CloudinaryService.uploadImage(req.file.path, 'profile-images');
            const url = result.secure_url;

            await db.collection('users').doc(uid).update({
                photoUrl: url
            });

            // Clean up
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            res.json({ secure_url: url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async uploadCompanyLogo(req, res) {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const result = await CloudinaryService.uploadImage(req.file.path, 'company-logos');

            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            res.json({ secure_url: result.secure_url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async uploadResume(req, res) {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            const uid = req.user.uid;

            const result = await CloudinaryService.uploadResume(req.file.path);
            const url = result.secure_url;

            await db.collection('users').doc(uid).update({
                resumeUrl: url
            });

            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            res.json({ secure_url: url });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UploadController();
