const cloudinary = require('../config/cloudinary');
const Script = require('../models/Script');

/**
 * Cloudinary Sync Service
 * Synchronizes uploaded scripts from Cloudinary and updates the website
 */
class CloudinaryService {
  /**
   * Fetch all scripts from Cloudinary folder
   */
  static async fetchAllScriptsFromCloudinary(folder = 'nextscene/scripts') {
    try {
      const resources = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        resource_type: 'raw'
      });

      return resources.resources;
    } catch (error) {
      console.error('Error fetching scripts from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Sync Cloudinary resources with database
   * Updates Scripts collection with latest files from Cloudinary
   */
  static async syncScriptsFromCloudinary() {
    try {
      const cloudinaryScripts = await this.fetchAllScriptsFromCloudinary();
      const results = {
        synced: 0,
        created: 0,
        updated: 0,
        errors: []
      };

      for (const resource of cloudinaryScripts) {
        try {
          const fileNameMatch = resource.public_id.match(/([^/]+)$/);
          const fileName = fileNameMatch ? fileNameMatch[1] : resource.public_id;

          // Check if script already exists in database
          const existingScript = await Script.findOne({
            fileUrl: resource.secure_url
          });

          if (existingScript) {
            // Update existing script
            existingScript.fileUrl = resource.secure_url;
            existingScript.updatedAt = new Date();
            await existingScript.save();
            results.updated++;
          } else {
            // Create new script entry if admin decides to import
            // For now, we just register the file in Cloudinary
            results.synced++;
          }
        } catch (itemError) {
          results.errors.push({
            file: resource.public_id,
            error: itemError.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error syncing scripts from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Get script file URL from Cloudinary
   */
  static getScriptUrl(publicId) {
    return cloudinary.url(publicId, {
      type: 'upload',
      resource_type: 'raw'
    });
  }

  /**
   * Get preview/thumbnail for script
   */
  static getScriptPreview(publicId) {
    return cloudinary.url(publicId, {
      type: 'upload',
      width: 300,
      crop: 'fit'
    });
  }

  /**
   * Delete script from Cloudinary
   */
  static async deleteScriptFromCloudinary(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw'
      });
      return result;
    } catch (error) {
      console.error('Error deleting script from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Upload script to Cloudinary
   */
  static async uploadScript(filePath, userId, scriptTitle, options = {}) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `nextscene/scripts/${userId}`,
        resource_type: 'raw',
        public_id: scriptTitle.replace(/[^a-zA-Z0-9]/g, '_'),
        ...options
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        size: result.bytes,
        uploadedAt: new Date()
      };
    } catch (error) {
      console.error('Error uploading script to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * List scripts for a user
   */
  static async listUserScripts(userId) {
    try {
      const folder = `nextscene/scripts/${userId}`;
      const resources = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        resource_type: 'raw'
      });

      return resources.resources.map(resource => ({
        publicId: resource.public_id,
        fileName: resource.public_id.split('/').pop(),
        url: resource.secure_url,
        size: resource.bytes,
        uploadedAt: new Date(resource.created_at)
      }));
    } catch (error) {
      console.error('Error listing user scripts:', error);
      throw error;
    }
  }

  /**
   * Perform periodic sync between Cloudinary and database
   * Can be scheduled with cron jobs
   */
  static async performPeriodicSync() {
    try {
      console.log('Starting periodic Cloudinary sync...');

      const allScripts = await Script.find({ fileUrl: { $exists: true, $ne: '' } });

      for (const script of allScripts) {
        try {
          // Verify file still exists on Cloudinary
          const metadata = await cloudinary.api.resource(script.fileUrl, {
            resource_type: 'raw'
          });

          if (metadata && metadata.secure_url) {
            // File exists, update if URL changed
            if (script.fileUrl !== metadata.secure_url) {
              script.fileUrl = metadata.secure_url;
              await script.save();
            }
          }
        } catch (error) {
          console.warn(`Could not verify file for script ${script._id}:`, error.message);
          // Mark as missing or handle accordingly
        }
      }

      console.log('Periodic sync completed');
      return { success: true, scriptsChecked: allScripts.length };
    } catch (error) {
      console.error('Error during periodic sync:', error);
      throw error;
    }
  }

  /**
   * Get detailed file info from Cloudinary
   */
  static async getFileInfo(publicId) {
    try {
      const resource = await cloudinary.api.resource(publicId, {
        resource_type: 'raw'
      });
      return resource;
    } catch (error) {
      console.error('Error getting file info from Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Enable script for reading/viewing
   * Creates a signed URL with access controls
   */
  static generateSignedScriptUrl(publicId, expiresIn = 3600) {
    return cloudinary.utils.private_download_url(publicId, 'txt', {
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      attachment: false
    });
  }

  /**
   * Create a shareable link for script
   */
  static async createShareableLink(publicId, maxDownloads = 1) {
    try {
      const result = await cloudinary.uploader.create_upload_preset({
        unsigned: true,
        folder: 'nextscene/shared',
        resource_type: 'raw'
      });

      return {
        uploadPreset: result.name,
        publicId: publicId
      };
    } catch (error) {
      console.error('Error creating shareable link:', error);
      throw error;
    }
  }

  /**
   * Batch operations on scripts
   */
  static async batchDeleteScripts(publicIds) {
    try {
      const results = [];
      for (const publicId of publicIds) {
        try {
          const result = await this.deleteScriptFromCloudinary(publicId);
          results.push({ publicId, success: true, result });
        } catch (error) {
          results.push({ publicId, success: false, error: error.message });
        }
      }
      return results;
    } catch (error) {
      console.error('Error in batch delete:', error);
      throw error;
    }
  }
}

module.exports = CloudinaryService;
