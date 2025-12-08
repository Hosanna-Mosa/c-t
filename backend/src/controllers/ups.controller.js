import { exchangeAuthCode } from '../services/ups.service.js';

export const handleUpsCallback = async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is required' });
    }

    console.log('[UPS Controller] Received callback with code:', code);

    // Exchange code for token
    const tokenData = await exchangeAuthCode(code);

    // In a real app, you would save this token to the database associated with the user/admin
    // For now, we'll just return success and maybe log it
    console.log('[UPS Controller] Token exchange successful. Access Token:', tokenData.access_token);
    
    // You might want to store the refresh token if provided
    if (tokenData.refresh_token) {
        console.log('[UPS Controller] Refresh Token:', tokenData.refresh_token);
    }

    return res.json({
      success: true,
      message: 'UPS integration successful',
      // Do not return the token to the frontend unless necessary
    });
  } catch (error) {
    console.error('[UPS Controller] Callback error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete UPS integration',
    });
  }
};
