import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Design from '../models/Design.js';
import CasualProduct from '../models/CasualProduct.js';
import DTFProduct from '../models/DTFProduct.js';
import { sendDeliveryNotificationEmail } from '../services/email.service.js';

export const listUsers = async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  res.json({ success: true, data: users });
};

export const getStats = async (req, res) => {
  try {
    const [users, products, casualProducts, dtfProducts, ordersCount] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      CasualProduct.countDocuments(),
      DTFProduct.countDocuments(),
      Order.countDocuments(),
    ]);

    const totalProducts = products + casualProducts + dtfProducts;

    // Total Revenue (Only from delivered orders)
    const revenueAgg = await Order.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total / 100 : 0;

    // Revenue Over Time (Last 7 Months)
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 6);
    sevenMonthsAgo.setDate(1); // Start of the month

    const revenueOverTime = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenMonthsAgo },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' },
            monthName: { $dateToString: { format: "%b", date: "$createdAt" } }
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format revenue data for chart
    const revenueData = revenueOverTime.map(item => ({
      name: item._id.monthName,
      revenue: item.revenue / 100,
      orders: item.orders
    }));

    // Category Distribution (based on productModel in orders)
    const categoryAgg = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productModel',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryData = categoryAgg.map(item => {
      let name = 'Unknown';
      if (item._id === 'Product') {
        name = 'Design Products';
      } else if (item._id === 'CasualProduct') {
        name = 'Normal Products';
      } else if (item._id === 'DTFProduct') {
        name = 'DTF Products';
      }
      return {
        name,
        value: item.count
      };
    });

    // Recent Orders
    const recentOrders = await Order.find()
      .select('user items total status createdAt')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    const formattedRecentOrders = recentOrders.map(order => ({
      id: order._id,
      user: order.user ? { name: order.user.name, email: order.user.email } : { name: 'Unknown', email: '' },
      product: order.items[0]?.productName || 'Unknown Product', // Just show first product name
      amount: order.total / 100,
      status: order.status,
      date: order.createdAt
    }));

    res.json({
      success: true,
      data: {
        users,
        products: totalProducts,
        orders: ordersCount,
        revenue: totalRevenue,
        revenueData,
        categoryData,
        recentOrders: formattedRecentOrders
      }
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
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
    
    const order = await Order.findById(id).populate('user');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // If status is changing to 'delivered', update stock and sold count
    if (status === 'delivered' && order.status !== 'delivered') {
      console.log(`[AdminController] Status changing to delivered for Order ID: ${id}`);
      try {
        for (const item of order.items) {
          let Model;
          if (item.productModel === 'CasualProduct') {
            Model = CasualProduct;
          } else if (item.productModel === 'DTFProduct') {
            Model = DTFProduct;
          } else {
            Model = Product;
          }

          if (Model) {
            await Model.findByIdAndUpdate(item.product, {
              $inc: {
                stock: -item.quantity,
                soldCount: item.quantity
              }
            });
          }
        }
        order.deliveredAt = new Date();

        // Send delivery email
        if (order.user?.email) {
          console.log(`[AdminController] Sending delivery email to: ${order.user.email}, Tracking: ${order.trackingNumber || 'N/A'}`);
          const emailResult = await sendDeliveryNotificationEmail({
            email: order.user.email,
            name: order.user.name,
            trackingNumber: order.trackingNumber || 'N/A',
            orderId: order._id.toString(),
          });
          console.log(`[AdminController] Delivery email result:`, emailResult);
          order.deliveryEmailSentAt = new Date();
        } else {
          console.log(`[AdminController] No user email found for order ${id}`);
        }

      } catch (error) {
        console.error('[AdminController] Error updating stock/sold count or sending email:', error);
      }
    }

    order.status = status || order.status;
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};


