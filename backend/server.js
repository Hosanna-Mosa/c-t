import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './src/config/db.js';
import { createIndexes } from './src/config/indexes.js';
import { configureCloudinary } from './src/services/cloudinary.service.js';
import authRoutes from './src/routes/auth.routes.js';
import productRoutes from './src/routes/product.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import orderRoutes from './src/routes/order.routes.js';
import settingRoutes from './src/routes/setting.routes.js';
import couponRoutes from './src/routes/coupon.routes.js';
import templateRoutes from './src/routes/template.routes.js';
import casualProductRoutes from './src/routes/casualProduct.routes.js';
import dtfProductRoutes from './src/routes/dtfProduct.routes.js';
import shippingRoutes from './src/routes/shipping.routes.js';
import shipmentRoutes from './src/routes/shipment.routes.js';
import paymentRoutes from './src/routes/payment.routes.js';
import { notFound, errorHandler } from './src/middlewares/error.middleware.js';
import trackingRoutes from './src/routes/tracking.routes.js';
import { startTrackingSyncJob } from './src/services/tracking.service.js';

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB
connectDB();
// Create indexes for better performance
createIndexes();

// Cloudinary
configureCloudinary();

// Middlewares
app.use(cors({
    origin: [
        "https://customtees-admin.onrender.com",
        "https://c-t-front-gltq.onrender.com",
        "http://localhost:8080",
        "http://localhost:8081",
    ],
    credentials: true,
}));
// Increase body size limits to allow base64 preview images
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/casual-products', casualProductRoutes);
app.use('/api/dtf-products', dtfProductRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/shipment', shipmentRoutes);
app.use('/api/tracking', trackingRoutes);


app.get('/api/health', (req, res) => res.json({ success: true, message: 'OK' }));

// Errors
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
    startTrackingSyncJob();
});


