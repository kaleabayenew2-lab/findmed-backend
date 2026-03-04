const cloudinary = require('cloudinary').v2;

// The SDK will automatically parse CLOUDINARY_URL if provided, but we also
// accept the separate env vars for clarity. The URL has the format:
// cloudinary://key:secret@cloudname
if (process.env.CLOUDINARY_URL) {
  // nothing to do; cloudinary.v2 will read it automatically
} else if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

module.exports = cloudinary;
