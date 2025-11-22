import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Google Drive OAuth 2.0 Configuration from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Google Drive folder ID where labels will be stored (optional, can be 'root' for root folder)
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';

/**
 * Get OAuth2 client with refresh token
 */
const getOAuth2Client = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required. Please set them in your .env file.');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  if (!GOOGLE_REFRESH_TOKEN) {
    throw new Error('GOOGLE_REFRESH_TOKEN is required. Please set it in your .env file.');
  }

  // Set the refresh token
  oauth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
};

/**
 * Get authenticated Google Drive client
 * The googleapis library automatically refreshes the access token when needed
 */
export const getDriveClient = () => {
  const oauth2Client = getOAuth2Client();
  
  // Set up automatic token refresh
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // Store the new refresh token if provided (usually only on first authorization)
      console.log('🔄 [Google Drive] New refresh token received');
    }
    if (tokens.access_token) {
      console.log('🔄 [Google Drive] Access token refreshed');
    }
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
};

/**
 * Upload a file to Google Drive
 * @param {string} filePath - Local file path to upload
 * @param {string} fileName - Name for the file in Google Drive
 * @param {string} folderId - Optional folder ID (defaults to GOOGLE_DRIVE_FOLDER_ID or 'root')
 * @returns {Promise<{fileId: string, webViewLink: string, downloadUrl: string}>}
 */
export const uploadFileToDrive = async (filePath, fileName = null, folderId = null) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const drive = getDriveClient();
    const targetFolderId = folderId || GOOGLE_DRIVE_FOLDER_ID;
    const fileMetadata = {
      name: fileName || path.basename(filePath),
      parents: targetFolderId !== 'root' ? [targetFolderId] : undefined,
    };

    const fileStream = fs.createReadStream(filePath);
    const media = {
      mimeType: 'application/pdf',
      body: fileStream,
    };

    console.log('📤 [Google Drive] Uploading file:', {
      filePath,
      fileName: fileMetadata.name,
      folderId: targetFolderId,
    });

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    console.log('✅ [Google Drive] File uploaded successfully:', {
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
    });

    // Generate download URL
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${response.data.id}`;

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
      downloadUrl: downloadUrl,
      name: response.data.name,
    };
  } catch (error) {
    console.error('❌ [Google Drive] Upload failed:', {
      message: error.message,
      filePath,
    });
    throw new Error(`Google Drive upload failed: ${error.message}`);
  }
};

/**
 * Download a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @param {string} downloadPath - Local path where file should be saved
 * @returns {Promise<string>} Path to the downloaded file
 */
export const downloadFileFromDrive = async (fileId, downloadPath = null) => {
  try {
    const drive = getDriveClient();

    console.log('📥 [Google Drive] Downloading file:', { fileId });

    // Get file metadata first
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType',
    });

    const fileName = fileMetadata.data.name || `file_${fileId}.pdf`;
    const targetPath = downloadPath || path.join(process.cwd(), 'uploads', 'labels', fileName);

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Download the file
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
      },
      { responseType: 'stream' }
    );

    // Write to file
    const writeStream = fs.createWriteStream(targetPath);
    response.data.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      response.data.on('error', reject);
    });

    console.log('✅ [Google Drive] File downloaded successfully:', {
      fileId,
      downloadPath: targetPath,
    });

    return targetPath;
  } catch (error) {
    console.error('❌ [Google Drive] Download failed:', {
      message: error.message,
      fileId,
    });
    throw new Error(`Google Drive download failed: ${error.message}`);
  }
};

/**
 * Get file download URL from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<string>} Download URL
 */
export const getFileDownloadUrl = async (fileId) => {
  try {
    const drive = getDriveClient();

    // Get file metadata
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, webViewLink, webContentLink',
    });

    // Generate download URL
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    return {
      fileId: fileMetadata.data.id,
      downloadUrl: downloadUrl,
      webViewLink: fileMetadata.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      name: fileMetadata.data.name,
    };
  } catch (error) {
    console.error('❌ [Google Drive] Get download URL failed:', {
      message: error.message,
      fileId,
    });
    throw new Error(`Google Drive get download URL failed: ${error.message}`);
  }
};

/**
 * Delete a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<void>}
 */
export const deleteFileFromDrive = async (fileId) => {
  try {
    const drive = getDriveClient();

    console.log('🗑️ [Google Drive] Deleting file:', { fileId });

    await drive.files.delete({
      fileId: fileId,
    });

    console.log('✅ [Google Drive] File deleted successfully:', { fileId });
  } catch (error) {
    console.error('❌ [Google Drive] Delete failed:', {
      message: error.message,
      fileId,
    });
    throw new Error(`Google Drive delete failed: ${error.message}`);
  }
};

