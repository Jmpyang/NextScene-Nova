const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Configure Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const isAvatar = file.fieldname === 'avatar';
        const folder = isAvatar ? 'nextscene-nova/avatars' : 'nextscene-nova/scripts';

        return {
            folder: folder,
            resource_type: 'auto',
            public_id: file.fieldname + '-' + Date.now()
        };
    }
});

// File filter - allow images for avatars, text/pdf/md for scripts
const fileFilter = (req, file, cb) => {
    const isAvatar = file.fieldname === 'avatar';

    if (isAvatar) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed for avatars.'), false);
        }
    } else {
        const allowedMimes = ['text/plain', 'application/pdf', 'text/markdown'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only .txt, .pdf, and .md files are allowed.'), false);
        }
    }
};

// Create multer upload instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});

module.exports = upload;
