import Setting from '../models/Setting.js';
import { uploadImage } from '../services/cloudinary.service.js';

export const getSettings = async (req, res) => {
  try {
    let doc = await Setting.findOne({});
    if (!doc) {
      doc = await Setting.create({});
    }
    const data = doc.toObject();
    if (Array.isArray(data.newsItems)) {
      data.newsItems = data.newsItems
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            return (item.title || item.description || '').trim();
          }
          return '';
        })
        .filter((item) => item.length);
    } else {
      data.newsItems = [];
    }
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    let doc = await Setting.findOne({});
    if (!doc) {
      doc = await Setting.create({});
    }

    const updates = {};
    // Accept files with names: homeBackground, homePoster, designBackground
    const map = {
      homeBackground: 'homeBackground',
      homePoster: 'homePoster',
      designBackground: 'designBackground',
    };

    if (req.files) {
      for (const key of Object.keys(map)) {
        const files = req.files[key];
        if (files && files.length) {
          const uploaded = await uploadImage(files[0].path);
          updates[map[key]] = uploaded;
        }
      }
    }

    if (typeof req.body.newsItems !== 'undefined') {
      try {
        const parsed =
          typeof req.body.newsItems === 'string' && req.body.newsItems.length
            ? JSON.parse(req.body.newsItems)
            : [];
        if (!Array.isArray(parsed)) {
          throw new Error('newsItems must be an array');
        }

        updates.newsItems = parsed
          .map((item) => (typeof item === 'string' ? item : ''))
          .map((item) => item.trim())
          .filter((item) => item.length);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || 'Invalid newsItems payload' });
      }
    }

    Object.assign(doc, updates);
    await doc.save();

    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to update settings' });
  }
};


