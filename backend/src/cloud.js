// Cloud file storage. Uses Cloudinary when CLOUDINARY_URL is set, otherwise
// falls back to returning the original data URL (stored in Postgres as before).
const USE_CLOUD = !!process.env.CLOUDINARY_URL;
let cloudinary = null;
if (USE_CLOUD) {
  cloudinary = require('cloudinary').v2; // reads CLOUDINARY_URL from env automatically
}

// Upload a base64 data URL (e.g. "data:application/pdf;base64,....").
// Returns { url, stored } where stored is 'cloudinary' or 'inline'.
async function uploadDataUrl(dataUrl, fileName) {
  if (!dataUrl) return { url: null, stored: 'none' };
  if (!USE_CLOUD) return { url: dataUrl, stored: 'inline' };
  const res = await cloudinary.uploader.upload(dataUrl, {
    folder: 'gspro',
    resource_type: 'auto',
    use_filename: true,
    filename_override: fileName || undefined,
    unique_filename: true,
  });
  return { url: res.secure_url, stored: 'cloudinary' };
}

module.exports = { uploadDataUrl, USE_CLOUD };
