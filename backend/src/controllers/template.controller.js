import fs from 'fs';
import Template from '../models/Template.js';
import { uploadImage, destroyImage } from '../services/cloudinary.service.js';

const removeTempFile = (path) => {
  if (!path) return;
  fs.unlink(path, () => {});
};

export const listTemplates = async (_req, res) => {
  const templates = await Template.find().sort({ createdAt: -1 });
  res.json({ success: true, data: templates });
};

export const createTemplate = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: 'Template image is required' });
  }

  try {
    const uploaded = await uploadImage(req.file.path, 'customtees/templates');

    const name =
      (req.body.name && req.body.name.trim()) ||
      (req.file.originalname
        ? req.file.originalname.replace(/\.[^/.]+$/, '')
        : 'Template');

    const template = await Template.create({
      name,
      image: uploaded,
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('❌ Template create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create template' });
  } finally {
    removeTempFile(req.file?.path);
  }
};

export const updateTemplate = async (req, res) => {
  const { id } = req.params;
  const template = await Template.findById(id);

  if (!template) {
    return res
      .status(404)
      .json({ success: false, message: 'Template not found' });
  }

  let newImage = null;

  try {
    if (req.file) {
      newImage = await uploadImage(req.file.path, 'customtees/templates');
    }

    if (req.body.name) {
      template.name = req.body.name.trim();
    }

    if (newImage) {
      const oldPublicId = template.image?.public_id;
      template.image = newImage;
      if (oldPublicId) {
        await destroyImage(oldPublicId);
      }
    }

    await template.save();

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('❌ Template update error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update template' });
  } finally {
    removeTempFile(req.file?.path);
  }
};

export const deleteTemplate = async (req, res) => {
  const { id } = req.params;
  const template = await Template.findById(id);

  if (!template) {
    return res
      .status(404)
      .json({ success: false, message: 'Template not found' });
  }

  try {
    if (template.image?.public_id) {
      await destroyImage(template.image.public_id);
    }

    await template.deleteOne();

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('❌ Template delete error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete template' });
  }
};


