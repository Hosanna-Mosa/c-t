import { calculateShippingRate, getTimeInTransit, getAllShippingOptions } from '../services/ups.service.js';

/**
 * Calculate shipping cost for a given destination
 */
export const getShippingRate = async (req, res) => {
  try {
    const { destination, weight, serviceCode } = req.body;

    // Validate required fields
    if (!destination) {
      return res.status(400).json({
        success: false,
        message: 'Destination address is required',
      });
    }

    if (!destination.city || !destination.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'City and postal code are required',
      });
    }

    // Calculate shipping rate
    const rate = await calculateShippingRate({
      destination,
      weight: weight || 1, // Default to 1 lb if not provided
      serviceCode: serviceCode || '03', // Default to UPS Ground
    });

    res.json({
      success: true,
      data: rate,
    });
  } catch (error) {
    console.error('[Shipping] Rate calculation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to calculate shipping rate',
    });
  }
};

/**
 * Get Time in Transit information for all available services
 */
export const getTransitTime = async (req, res) => {
  try {
    const { destination, shipDate } = req.body;

    // Validate required fields
    if (!destination) {
      return res.status(400).json({
        success: false,
        message: 'Destination address is required',
      });
    }

    if (!destination.city || !destination.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'City and postal code are required',
      });
    }

    // Get time in transit for all services
    const transitData = await getTimeInTransit({
      destination,
      shipDate: shipDate || null, // Optional ship date (YYYYMMDD format)
    });

    res.json({
      success: true,
      data: transitData,
    });
  } catch (error) {
    console.error('[Shipping] Time in Transit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get time in transit',
    });
  }
};

/**
 * Get all available shipping options with rates and transit information
 */
export const getAllShippingOptionsController = async (req, res) => {
  try {
    const { destination, weight } = req.body;

    // Validate required fields
    if (!destination) {
      return res.status(400).json({
        success: false,
        message: 'Destination address is required',
      });
    }

    if (!destination.city || !destination.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'City and postal code are required',
      });
    }

    // Get all shipping options
    const result = await getAllShippingOptions({
      destination,
      weight: weight || 1,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Shipping] Get all options error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get shipping options',
    });
  }
};




