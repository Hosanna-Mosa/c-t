import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Design from '../models/Design.js';

export const listUsers = async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json({ success: true, data: users });
};

export const getStats = async (req, res) => {
  const [users, products] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(),
  ]);
  // Placeholder orders count until orders model is added
  const orders = 0;
  res.json({ success: true, data: { users, products, orders } });
};

export const listOrders = async (_req, res) => {
  const orders = await Order.find().populate('user', 'name email').populate('items.product').sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
};

export const listDesigns = async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Limit to 50 designs per page
    const skip = (page - 1) * limit;
    
    // Use lean() to reduce memory usage and add allowDiskUse option
    const designs = await Design.find()
      .populate('user', 'name email')
      .populate('productId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() to reduce memory usage
    
    // Get total count for pagination
    const totalDesigns = await Design.countDocuments();
    
    console.log('Admin designs query result:', designs.length, 'designs found (page', page, 'of', Math.ceil(totalDesigns / limit), ')');
    designs.forEach(design => {
    });
    
    res.json({ 
      success: true, 
      data: designs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDesigns / limit),
        totalDesigns,
        hasNextPage: page < Math.ceil(totalDesigns / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching designs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch designs' });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.status = status || order.status;
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};


