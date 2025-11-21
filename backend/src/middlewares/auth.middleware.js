import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization ||
      req.headers['x-admin-token'] ||
      req.headers['x-access-token'] ||
      '';

    let token = null;
    if (Array.isArray(authHeader)) {
      token = authHeader[0];
    } else if (typeof authHeader === 'string' && authHeader.length) {
      token = authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : authHeader;
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};

export const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};


