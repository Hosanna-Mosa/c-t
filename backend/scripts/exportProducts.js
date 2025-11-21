import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Product from '../src/models/Product.js';

dotenv.config();

const summarizeVariant = (variant) => {
  const summarizeImages = (images = []) =>
    images.map((img) => ({
      url: img.url,
      public_id: img.public_id,
    }));

  return {
    color: variant.color,
    colorCode: variant.colorCode,
    totalImages: variant.images?.length || 0,
    frontImages: summarizeImages(variant.frontImages),
    backImages: summarizeImages(variant.backImages),
  };
};

const run = async () => {
  await connectDB();

  try {
    const products = await Product.find({})
      .select('name slug variants')
      .sort({ name: 1 })
      .lean();

    const payload = products.map((product) => ({
      name: product.name,
      slug: product.slug,
      variants: (product.variants || []).map(summarizeVariant),
    }));

    console.log(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Failed to export products:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();




