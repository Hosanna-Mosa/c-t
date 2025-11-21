import { v2 as cloudinary } from 'cloudinary';

export const configureCloudinary = () => {
  console.log('☁️ Configuring Cloudinary...');
  
  const config = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dnsypzkpk",
    api_key: process.env.CLOUDINARY_API_KEY || "612924528715927",
    api_secret: process.env.CLOUDINARY_API_SECRET || "rOUlGOkHPx1sSsczHPkuTpI6YSM",
  };
  
  // Check if all required environment variables are present
  const missingVars = [];
  if (!config.cloud_name) missingVars.push('CLOUDINARY_CLOUD_NAME');
  if (!config.api_key) missingVars.push('CLOUDINARY_API_KEY');
  if (!config.api_secret) missingVars.push('CLOUDINARY_API_SECRET');
  
  if (missingVars.length > 0) {
    console.error('❌ Missing Cloudinary environment variables:', missingVars);
    throw new Error(`Missing Cloudinary environment variables: ${missingVars.join(', ')}`);
  }
  
  cloudinary.config(config);
  console.log('✅ Cloudinary configured successfully with cloud name:', config.cloud_name);
  return cloudinary;
};

export const uploadImage = async (filePath, folder = 'customtees/products') => {
  try {
    console.log('☁️ Cloudinary upload starting for file:', filePath);
    
    // Check if Cloudinary is configured
    // if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    //   throw new Error('Cloudinary configuration missing. Please check environment variables.');
    // }
    
    const res = await cloudinary.uploader.upload(filePath, { 
      folder,
      resource_type: 'auto'
    });
    
    console.log('✅ Cloudinary upload successful:', {
      url: res.secure_url,
      public_id: res.public_id,
      format: res.format,
      size: res.bytes
    });
    
    return { url: res.secure_url, public_id: res.public_id };
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', {
      message: error.message,
      error: error.error,
      http_code: error.http_code,
      filePath: filePath
    });
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

export const uploadFile = async (filePath, {
  folder = 'customtees/files',
  resourceType = 'raw',
  useFilename = true,
  uniqueFilename = false,
} = {}) => {
  try {
    console.log('☁️ Cloudinary file upload starting:', { filePath, folder, resourceType });
    const res = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
      use_filename: useFilename,
      unique_filename: uniqueFilename,
      overwrite: true,
    });
    console.log('✅ Cloudinary file upload successful:', {
      url: res.secure_url,
      public_id: res.public_id,
      resource_type: res.resource_type,
      size: res.bytes,
    });
    return { url: res.secure_url, public_id: res.public_id };
  } catch (error) {
    console.error('❌ Cloudinary file upload failed:', {
      message: error.message,
      http_code: error.http_code,
      filePath,
    });
    throw new Error(`Cloudinary file upload failed: ${error.message}`);
  }
};

export const uploadDataUrl = async (dataUrl, folder = 'customtees/previews') => {
  try {
    const res = await cloudinary.uploader.upload(dataUrl, {
      folder,
      resource_type: 'image',
      overwrite: true,
    });
    return { url: res.secure_url, public_id: res.public_id };
  } catch (error) {
    console.error('❌ Cloudinary upload (data URL) failed:', error?.message || error);
    throw new Error(`Cloudinary data URL upload failed: ${error.message}`);
  }
};

export const destroyImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    // ignore not found
  }
};


