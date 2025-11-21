// Use node-fetch for compatibility (Node.js < 18)
// For Node.js 18+, you can use built-in fetch by removing this import
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { uploadFile } from './cloudinary.service.js';

// UPS Configuration from environment variables
// NOTE: Never hardcode credentials in production! Use environment variables only.
const UPS_CLIENT_ID = process.env.UPS_CLIENT_ID;
const UPS_CLIENT_SECRET = process.env.UPS_CLIENT_SECRET;
const UPS_ACCESS_TOKEN = process.env.UPS_ACCESS_TOKEN; // Optional: if you have a token already
const UPS_SHIPPER_NUMBER = process.env.UPS_SHIPPER_NUMBER || '1C384J';
const UPS_USE_SANDBOX = process.env.UPS_USE_SANDBOX !== 'false'; // Default to sandbox (true)

// UPS API URLs
const TOKEN_URL = UPS_USE_SANDBOX 
  ? 'https://wwwcie.ups.com/security/v1/oauth/token'
  : 'https://onlinetools.ups.com/security/v1/oauth/token';

const RATING_URL = UPS_USE_SANDBOX
  ? 'https://wwwcie.ups.com/api/rating/v2205/rate'
  : 'https://onlinetools.ups.com/api/rating/v2205/rate';

// UPS Time in Transit API endpoint
// Correct endpoint: /api/shipments/v1/transittimes
const TIME_IN_TRANSIT_URL = UPS_USE_SANDBOX
  ? 'https://wwwcie.ups.com/api/shipments/v1/transittimes'
  : 'https://onlinetools.ups.com/api/shipments/v1/transittimes';

const SHIPMENT_URL = UPS_USE_SANDBOX
  ? 'https://wwwcie.ups.com/api/shipments/v1/ship'
  : 'https://onlinetools.ups.com/api/shipments/v1/ship';

// Default origin address (can be configured via env vars)
const DEFAULT_ORIGIN = {
  name: process.env.UPS_ORIGIN_NAME || 'Custom Tees Store',
  addressLine: process.env.UPS_ORIGIN_ADDRESS || '30  mall drive west',
  city: process.env.UPS_ORIGIN_CITY || 'Jersey City',
  stateProvinceCode: process.env.UPS_ORIGIN_STATE || 'NJ',
  postalCode: process.env.UPS_ORIGIN_POSTAL || '07310',
  countryCode: process.env.UPS_ORIGIN_COUNTRY || 'US',
};

/**
 * Check if a JWT token is expired
 */
const isTokenExpired = (token) => {
  try {
    if (!token) return true;
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const exp = payload.exp;
    
    if (!exp) return true;
    
    // Check if token expires in less than 5 minutes (buffer time)
    const now = Math.floor(Date.now() / 1000);
    return exp < (now + 300); // 5 minute buffer
  } catch (error) {
    console.warn('[UPS] Error checking token expiration:', error.message);
    return true; // If we can't parse, assume expired
  }
};

/**
 * Get human-readable service name from UPS service code
 */
const getServiceName = (code) => {
  const services = {
    '01': 'UPS Next Day Air',
    '02': 'UPS 2nd Day Air',
    '03': 'UPS Ground',
    '12': 'UPS 3 Day Select',
    '13': 'UPS Next Day Air Saver',
    '14': 'UPS Next Day Air Early AM',
    '59': 'UPS 2nd Day Air AM',
    '65': 'UPS Saver',
  };
  return services[code] || `UPS Service ${code}`;
};

/**
 * Map UPS service level (from Time in Transit API) to service code (for Rating API)
 */
const mapServiceLevelToCode = (serviceLevel) => {
  const mapping = {
    '1DM': '14', // UPS Next Day Air Early AM
    '1DA': '01', // UPS Next Day Air
    '1DP': '13', // UPS Next Day Air Saver
    '2DM': '59', // UPS 2nd Day Air AM
    '2DA': '02', // UPS 2nd Day Air
    '3DS': '12', // UPS 3 Day Select
    'GND': '03', // UPS Ground
  };
  return mapping[serviceLevel] || serviceLevel; // Return as-is if not found
};

/**
 * Generate OAuth token from UPS
 */
export const generateUPSToken = async () => {
  // Check if we have a valid (non-expired) access token
  if (UPS_ACCESS_TOKEN && !isTokenExpired(UPS_ACCESS_TOKEN)) {
    console.log('[UPS] Using existing access token');
    return UPS_ACCESS_TOKEN;
  }

  // If token is expired or missing, generate a new one
  if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET) {
    throw new Error('UPS_CLIENT_ID and UPS_CLIENT_SECRET are required. Please set them in your .env file.');
  }

  console.log('[UPS] Generating new access token...');
  const authHeader = 'Basic ' + Buffer.from(`${UPS_CLIENT_ID}:${UPS_CLIENT_SECRET}`).toString('base64');

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authHeader,
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      const errorMsg = data.error_description || data.error || 'Failed to generate UPS access token';
      console.error('[UPS] Token generation failed:', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('[UPS] Successfully generated new access token');
    return data.access_token;
  } catch (error) {
    console.error('[UPS] Token generation error:', error);
    throw new Error(`Failed to generate UPS token: ${error.message}`);
  }
};

/**
 * Get Time in Transit information using UPS Time in Transit API
 * @param {Object} params - Transit parameters
 * @param {Object} params.destination - Destination address
 * @param {Object} params.origin - Origin address (uses default if not provided)
 * @param {string} params.shipDate - Ship date in YYYYMMDD format (default: today)
 * @param {number} params.weight - Package weight in pounds (default: 1)
 * @param {string} params.serviceCode - UPS service code (default: '03' for Ground)
 * @returns {Promise<Object>} Time in transit information for all available services
 */
export const getTimeInTransit = async ({
  destination,
  origin = null,
  shipDate = null,
  weight = 1,
  serviceCode = '03',
}) => {
  try {
    // Get access token
    const accessToken = await generateUPSToken();

    // Use provided origin or default
    const shipFrom = origin || DEFAULT_ORIGIN;

    // Default to today's date if not provided
    if (!shipDate) {
      const today = new Date();
      shipDate = today.toISOString().split('T')[0].replace(/-/g, '');
    }

    // Prepare request body for Time in Transit API
    // Note: The Time in Transit API uses a flat request structure
    // Format shipDate as YYYY-MM-DD (not YYYYMMDD)
    const shipDateFormatted = shipDate.length === 8 
      ? `${shipDate.substring(0, 4)}-${shipDate.substring(4, 6)}-${shipDate.substring(6, 8)}`
      : shipDate;
    
    const requestBody = {
      originCountryCode: shipFrom.countryCode || 'US',
      originStateProvince: shipFrom.stateProvinceCode,
      originCityName: shipFrom.city,
      originPostalCode: shipFrom.postalCode,
      destinationCountryCode: destination.countryCode || destination.country || 'US',
      destinationStateProvince: destination.stateProvinceCode || destination.state,
      destinationCityName: destination.city,
      destinationPostalCode: destination.postalCode,
      weight: String(weight),
      weightUnitOfMeasure: 'LBS',
      shipmentContentsValue: '100', // Default value, can be made configurable
      shipmentContentsCurrencyCode: 'USD',
      billType: serviceCode, // UPS service code
      shipDate: shipDateFormatted,
    };

    // Call UPS Time in Transit API
    console.log('[UPS] Time in Transit request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(TIME_IN_TRANSIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        transId: Date.now().toString(),
        transactionSrc: 'CustomTeesApp',
      },
      body: JSON.stringify(requestBody),
    });

    // Check response status and content type before parsing
    const contentType = response.headers.get('content-type');
    const responseText = await response.text();
    
    console.log('[UPS] Time in Transit response status:', response.status);
    console.log('[UPS] Time in Transit response content-type:', contentType);
    console.log('[UPS] Time in Transit raw response (first 1000 chars):', responseText.substring(0, 1000));

    // Handle empty or non-JSON responses
    if (!responseText || responseText.trim().length === 0) {
      console.error('[UPS] Time in Transit API returned empty response');
      throw new Error('UPS Time in Transit API returned empty response');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[UPS] Failed to parse Time in Transit response as JSON:', parseError.message);
      console.error('[UPS] Full response text:', responseText);
      throw new Error(`UPS Time in Transit API returned invalid JSON: ${parseError.message}`);
    }

    if (!response.ok) {
      const errorMessage = data.response?.errors?.[0]?.message || 
                          data.response?.errors?.[0]?.code || 
                          data.message ||
                          `Failed to get time in transit (Status: ${response.status})`;
      console.error('[UPS] Time in Transit API error:', {
        status: response.status,
        error: errorMessage,
        fullResponse: data
      });
      throw new Error(errorMessage);
    }

    // Extract transit information
    // The response format may vary, so we'll handle multiple possible structures
    console.log('[UPS] Time in Transit response structure:', JSON.stringify(data, null, 2));
    
    // Try to find transit data in various possible response structures
    let transitInfo = [];
    
    // Check for emsResponse structure (Time in Transit API format)
    if (data.emsResponse && data.emsResponse.services) {
      const services = data.emsResponse.services || [];
      transitInfo = services.map((service) => {
        const serviceLevel = service.serviceLevel;
        const serviceCode = mapServiceLevelToCode(serviceLevel);
        return {
          serviceCode: serviceCode,
          serviceLevel: serviceLevel, // Keep original service level for reference
          serviceName: service.serviceLevelDescription || getServiceName(serviceCode),
          businessDaysInTransit: service.businessTransitDays,
          deliveryDate: service.deliveryDate,
          deliveryTime: service.deliveryTime || service.commitTime,
          isGuaranteed: service.guaranteeIndicator === '1' || service.guaranteeIndicator === 1,
        };
      });
      console.log('[UPS] Parsed', transitInfo.length, 'services from emsResponse');
    }
    // Check for array of services directly
    else if (Array.isArray(data)) {
      transitInfo = data.map((service) => ({
        serviceCode: service.serviceCode || service.code,
        serviceName: getServiceName(service.serviceCode || service.code),
        businessDaysInTransit: service.businessDaysInTransit || service.transitDays,
        deliveryDate: service.deliveryDate || service.estimatedDeliveryDate,
        deliveryTime: service.deliveryTime || service.estimatedDeliveryTime,
        isGuaranteed: service.isGuaranteed || false,
      }));
    }
    // Check for nested response structure
    else if (data.TimeInTransitResponse) {
      const transitResponse = data.TimeInTransitResponse;
      const serviceSummaries = transitResponse.ServiceSummary || transitResponse.services || [];
      transitInfo = serviceSummaries.map((service) => ({
        serviceCode: service.Service?.Code || service.serviceCode || service.code,
        serviceName: getServiceName(service.Service?.Code || service.serviceCode || service.code),
        businessDaysInTransit: service.Guaranteed?.Delivery?.BusinessDaysInTransit ||
                              service.EstimatedArrival?.BusinessDaysInTransit ||
                              service.ScheduledDelivery?.BusinessDaysInTransit ||
                              service.businessDaysInTransit ||
                              service.transitDays,
        deliveryDate: service.Guaranteed?.Delivery?.Date || 
                     service.EstimatedArrival?.Date ||
                     service.ScheduledDelivery?.Date ||
                     service.deliveryDate ||
                     service.estimatedDeliveryDate,
        deliveryTime: service.Guaranteed?.Delivery?.Time || 
                     service.EstimatedArrival?.Time ||
                     service.ScheduledDelivery?.Time ||
                     service.deliveryTime ||
                     service.estimatedDeliveryTime,
        isGuaranteed: !!service.Guaranteed || service.isGuaranteed || false,
      }));
    }
    // Check for flat response structure
    else if (data.services || data.serviceSummaries) {
      const services = data.services || data.serviceSummaries || [];
      transitInfo = services.map((service) => ({
        serviceCode: service.serviceCode || service.code,
        serviceName: getServiceName(service.serviceCode || service.code),
        businessDaysInTransit: service.businessDaysInTransit || service.transitDays,
        deliveryDate: service.deliveryDate || service.estimatedDeliveryDate,
        deliveryTime: service.deliveryTime || service.estimatedDeliveryTime,
        isGuaranteed: service.isGuaranteed || false,
      }));
    }
    else {
      console.warn('[UPS] Unknown Time in Transit response structure');
      console.warn('[UPS] Available keys in response:', Object.keys(data));
      throw new Error('Unknown Time in Transit API response structure');
    }

    return {
      success: true,
      shipDate: shipDate,
      services: transitInfo,
      // Get default service (Ground) if available
      defaultService: transitInfo.find(s => s.serviceCode === '03') || transitInfo[0] || null,
    };
  } catch (error) {
    // Log detailed error information for debugging
    console.error('[UPS] Time in Transit error:', error.message);
    console.error('[UPS] Time in Transit error stack:', error.stack);
    
    // If it's a JSON parse error or empty response, provide more context
    if (error.message.includes('JSON') || error.message.includes('empty')) {
      console.error('[UPS] Time in Transit API may not be available or endpoint may be incorrect');
      console.error('[UPS] This is a non-critical error - shipping rates will still be calculated');
    }
    
    // Re-throw to allow caller to handle gracefully
    throw error;
  }
};

/**
 * Calculate shipping rate using UPS Rating API
 * @param {Object} params - Shipping parameters
 * @param {Object} params.destination - Destination address
 * @param {Object} params.destination.addressLine - Street address
 * @param {string} params.destination.city - City
 * @param {string} params.destination.stateProvinceCode - State code (e.g., 'CA')
 * @param {string} params.destination.postalCode - ZIP/Postal code
 * @param {string} params.destination.countryCode - Country code (default: 'US')
 * @param {number} params.weight - Package weight in pounds (default: 1)
 * @param {string} params.serviceCode - UPS service code (default: '03' for Ground)
 * @param {Object} params.origin - Optional origin address (uses default if not provided)
 * @returns {Promise<Object>} Shipping rate information
 */
export const calculateShippingRate = async ({
  destination,
  weight = 1,
  serviceCode = '03', // UPS Ground
  origin = null,
}) => {
  try {
    // Get access token
    const accessToken = await generateUPSToken();

    // Use provided origin or default
    const shipFrom = origin || DEFAULT_ORIGIN;

    // Prepare request body
    const requestBody = {
      RateRequest: {
        Request: {
          TransactionReference: {
            CustomerContext: 'CustomTees Shipping Rate',
          },
        },
        Shipment: {
          Shipper: {
            Name: shipFrom.name,
            ShipperNumber: UPS_SHIPPER_NUMBER,
            Address: {
              AddressLine: shipFrom.addressLine,
              City: shipFrom.city,
              StateProvinceCode: shipFrom.stateProvinceCode,
              PostalCode: shipFrom.postalCode,
              CountryCode: shipFrom.countryCode,
            },
          },
          ShipTo: {
            Name: destination.name || 'Customer',
            Address: {
              AddressLine: destination.addressLine || destination.line1 || '',
              City: destination.city,
              StateProvinceCode: destination.stateProvinceCode || destination.state,
              PostalCode: destination.postalCode || destination.postalCode,
              CountryCode: destination.countryCode || destination.country || 'US',
            },
          },
          ShipFrom: {
            Name: shipFrom.name,
            Address: {
              AddressLine: shipFrom.addressLine,
              City: shipFrom.city,
              StateProvinceCode: shipFrom.stateProvinceCode,
              PostalCode: shipFrom.postalCode,
              CountryCode: shipFrom.countryCode,
            },
          },
          Service: {
            Code: serviceCode,
          },
          Package: [
            {
              PackagingType: { Code: '02' }, // Customer Supplied Package
              PackageWeight: {
                UnitOfMeasurement: { Code: 'LBS' },
                Weight: String(weight),
              },
            },
          ],
        },
      },
    };

    // Call UPS Rating API
    const response = await fetch(RATING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        transId: Date.now().toString(),
        transactionSrc: 'CustomTeesApp',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle authentication errors specifically
      if (response.status === 401 || data.response?.errors?.[0]?.code === '250003') {
        console.error('[UPS] Authentication failed. Token may be expired. Attempting to regenerate...');
        // Try to regenerate token and retry once (if not already using a fresh token)
        if (UPS_ACCESS_TOKEN && isTokenExpired(UPS_ACCESS_TOKEN)) {
          // Force token regeneration by clearing it
          const newToken = await generateUPSToken();
          // Note: This would require refactoring to retry, but for now just throw
          throw new Error('Authentication failed. Please check your UPS credentials in .env file.');
        }
      }
      
      const errorMessage = data.response?.errors?.[0]?.message || data.response?.errors?.[0]?.code || 'Failed to calculate shipping rate';
      console.error('[UPS] Rate API error:', {
        status: response.status,
        error: errorMessage,
        fullResponse: data
      });
      throw new Error(errorMessage);
    }

    // Extract rate information
    const ratedShipment = data.RateResponse?.RatedShipment;
    if (!ratedShipment) {
      throw new Error('No rate information returned from UPS');
    }

    // Convert cost from cents to dollars (UPS returns in cents)
    const totalCharges = ratedShipment.TotalCharges?.MonetaryValue || '0';
    const currency = ratedShipment.TotalCharges?.CurrencyCode || 'USD';
    const costInCents = Math.round(parseFloat(totalCharges) * 100); // Convert to cents

    // Log available transit data from Rating API for debugging
    console.log('[UPS] Rating API transit data available:', {
      hasGuaranteedDelivery: !!ratedShipment.GuaranteedDelivery,
      hasScheduledDelivery: !!ratedShipment.ScheduledDelivery,
      hasEstimatedDelivery: !!ratedShipment.EstimatedDelivery,
      guaranteedDelivery: ratedShipment.GuaranteedDelivery,
      scheduledDelivery: ratedShipment.ScheduledDelivery,
      estimatedDelivery: ratedShipment.EstimatedDelivery,
    });

    // Try to get Time in Transit information for the selected service
    let transitInfo = null;
    try {
      console.log('[UPS] Fetching Time in Transit for service:', serviceCode);
      const transitData = await getTimeInTransit({
        destination,
        origin: shipFrom,
        weight,
        serviceCode,
      });
      
      console.log('[UPS] Time in Transit response:', JSON.stringify(transitData, null, 2));
      
      // Find transit info for the requested service code
      const serviceTransit = transitData.services.find(s => s.serviceCode === serviceCode);
      if (serviceTransit) {
        console.log('[UPS] Found transit info for service:', serviceCode, serviceTransit);
        transitInfo = {
          businessDaysInTransit: serviceTransit.businessDaysInTransit,
          deliveryDate: serviceTransit.deliveryDate,
          deliveryTime: serviceTransit.deliveryTime,
          isGuaranteed: serviceTransit.isGuaranteed,
        };
      } else {
        console.warn('[UPS] No transit info found for service code:', serviceCode);
        console.log('[UPS] Available services:', transitData.services.map(s => s.serviceCode));
      }
    } catch (transitError) {
      // If Time in Transit fails, still return rate info but log the error
      console.warn('[UPS] Time in Transit lookup failed, using rate API data only:', transitError.message);
      
      // Only log full error details if it's not a 404 (endpoint not found)
      if (!transitError.message.includes('404') && !transitError.message.includes('not found')) {
        console.error('[UPS] Time in Transit error details:', transitError);
      }
      
      // Fallback to rate API transit data if available
      // Check multiple possible locations for transit data in Rating API response
      const guaranteedDelivery = ratedShipment.GuaranteedDelivery;
      const scheduledDelivery = ratedShipment.ScheduledDelivery;
      const estimatedDelivery = ratedShipment.EstimatedDelivery;
      
      if (guaranteedDelivery || scheduledDelivery || estimatedDelivery) {
        console.log('[UPS] Using fallback transit data from Rating API');
        transitInfo = {
          businessDaysInTransit: guaranteedDelivery?.BusinessDaysInTransit ||
                                 scheduledDelivery?.BusinessDaysInTransit ||
                                 estimatedDelivery?.BusinessDaysInTransit,
          deliveryDate: guaranteedDelivery?.DeliveryDate ||
                       scheduledDelivery?.DeliveryDate ||
                       estimatedDelivery?.DeliveryDate,
          deliveryTime: guaranteedDelivery?.DeliveryTime ||
                       scheduledDelivery?.DeliveryTime ||
                       estimatedDelivery?.DeliveryTime,
          isGuaranteed: !!guaranteedDelivery,
        };
      } else {
        console.log('[UPS] No transit data available from Rating API either');
      }
    }

    const rateResponse = {
      success: true,
      cost: costInCents, // Return in cents to match order pricing
      currency,
      serviceCode: ratedShipment.Service?.Code,
      serviceName: getServiceName(serviceCode),
      transitDays: transitInfo?.businessDaysInTransit || ratedShipment.GuaranteedDelivery?.BusinessDaysInTransit,
      estimatedDelivery: transitInfo?.deliveryDate || ratedShipment.GuaranteedDelivery?.DeliveryDate,
      deliveryTime: transitInfo?.deliveryTime,
      isGuaranteed: transitInfo?.isGuaranteed || !!ratedShipment.GuaranteedDelivery,
      transitInfo: transitInfo, // Full transit info object
    };
    
    console.log('[UPS] Final rate response with transit info:', JSON.stringify({
      ...rateResponse,
      cost: rateResponse.cost / 100 + ' USD', // Convert to dollars for logging
    }, null, 2));
    
    return rateResponse;
  } catch (error) {
    console.error('[UPS] Rate calculation error:', error);
    throw error;
  }
};

/**
 * Get all available shipping options with rates and transit information
 * 
 * NOTE: This function makes 3 API calls total:
 * - 1 call to getTimeInTransit (returns transit info for all services)
 * - 2 calls to calculateShippingRate (one for Ground '03', one for 3 Day Select '12')
 * 
 * This is optimized for minimal API usage while providing 2 shipping options:
 * - UPS Ground (cheapest, slower)
 * - UPS 3 Day Select (balanced price/speed)
 * 
 * @param {Object} params - Shipping parameters
 * @param {Object} params.destination - Destination address
 * @param {number} params.weight - Package weight in pounds (default: 1)
 * @param {Object} params.origin - Optional origin address (uses default if not provided)
 * @param {Array<string>} params.serviceCodes - Optional: specific service codes to fetch (default: ['03', '12'])
 * @returns {Promise<Array>} Array of shipping options with rates and transit info
 */
export const getAllShippingOptions = async ({
  destination,
  weight = 1,
  origin = null,
  serviceCodes: requestedServiceCodes = null,
}) => {
  try {
    console.log('[UPS] Fetching all shipping options for destination:', destination.postalCode);
    
    // First, get transit information for all available services (1 API call)
    let transitData = null;
    try {
      transitData = await getTimeInTransit({
        destination,
        origin,
        weight,
      });
      console.log('[UPS] Got transit data for', transitData.services?.length || 0, 'services');
    } catch (transitError) {
      console.warn('[UPS] Failed to get transit data, will calculate rates only:', transitError.message);
    }

    // Get list of service codes to calculate rates for
    // Optimized to only 2 services: Ground (cheapest) and 3 Day Select (balanced)
    // This reduces API calls to minimum: 1 transit call + 2 rate calls = 3 total
    const defaultServiceCodes = ['03', '12']; // Ground, 3 Day Select
    
    // If specific service codes were requested, use those; otherwise use default 2
    let serviceCodes;
    if (requestedServiceCodes && requestedServiceCodes.length > 0) {
      serviceCodes = requestedServiceCodes.slice(0, 10); // Limit to max 10 to prevent too many API calls
      console.log('[UPS] Using requested service codes:', serviceCodes);
    } else {
      // Always use the 2 default services (Ground and 3 Day Select)
      serviceCodes = defaultServiceCodes;
      console.log('[UPS] Using default service codes:', serviceCodes);
    }
    
    console.log('[UPS] Will make', serviceCodes.length, 'API calls for rate calculations (total: 1 transit +', serviceCodes.length, 'rates)');

    console.log('[UPS] Calculating rates for', serviceCodes.length, 'services');

    // Calculate rates for each service code
    const ratePromises = serviceCodes.map(async (serviceCode) => {
      try {
        const rate = await calculateShippingRate({
          destination,
          weight,
          serviceCode,
          origin,
        });

        // Find matching transit info if available
        const transitInfo = transitData?.services?.find(
          s => s.serviceCode === serviceCode
        );

        return {
          serviceCode: rate.serviceCode,
          serviceName: rate.serviceName,
          cost: rate.cost, // in cents
          currency: rate.currency,
          transitDays: transitInfo?.businessDaysInTransit || rate.transitDays,
          estimatedDelivery: transitInfo?.deliveryDate || rate.estimatedDelivery,
          deliveryTime: transitInfo?.deliveryTime || rate.deliveryTime,
          isGuaranteed: transitInfo?.isGuaranteed || rate.isGuaranteed,
          transitInfo: transitInfo || rate.transitInfo,
        };
      } catch (error) {
        console.warn(`[UPS] Failed to get rate for service ${serviceCode}:`, error.message);
        // Return null for failed services, we'll filter them out
        return null;
      }
    });

    // Wait for all rate calculations
    const rates = await Promise.all(ratePromises);
    
    // Filter out failed services and sort by transit days (fastest first), then by cost
    const options = rates
      .filter(rate => rate !== null)
      .sort((a, b) => {
        // First sort by transit days (if available)
        const daysA = a.transitDays || 999;
        const daysB = b.transitDays || 999;
        if (daysA !== daysB) {
          return daysA - daysB;
        }
        // If same transit days, sort by cost (cheapest first)
        return a.cost - b.cost;
      });

    console.log('[UPS] Returning', options.length, 'shipping options');
    
    return {
      success: true,
      options,
    };
  } catch (error) {
    console.error('[UPS] Error getting all shipping options:', error);
    throw error;
  }
};
// Public helper to reuse the token generator
export const getUpsToken = generateUPSToken;

// ======================================================================
// UPS Shipment (Label Generation)
// ======================================================================

const LABELS_DIR = path.join(process.cwd(), 'uploads', 'labels');

const ensureLabelsDir = async () => {
  await fs.promises.mkdir(LABELS_DIR, { recursive: true });
  return LABELS_DIR;
};

const convertImageToPdf = (imageBuffer, targetPath) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [4 * 72, 6 * 72], margin: 18 });
      const writeStream = fs.createWriteStream(targetPath);
      doc.pipe(writeStream);
      doc.image(imageBuffer, {
        fit: [doc.page.width - 36, doc.page.height - 36],
        align: 'center',
        valign: 'center',
      });
      doc.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });

const normalizeMeasurement = (value, fallback) => {
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) {
    return num.toFixed(2);
  }
  return Number(fallback || 1).toFixed(2);
};

const buildShipmentPayload = (order, packageInfo) => {
  const shippingAddress = order?.shippingAddress || {};
  if (!shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.postalCode) {
    throw new Error('Order is missing shipping address details');
  }

  const length = normalizeMeasurement(packageInfo.length, 10);
  const width = normalizeMeasurement(packageInfo.width, 10);
  const height = normalizeMeasurement(packageInfo.height, 4);
  const weight = normalizeMeasurement(packageInfo.weight, 1);

  const serviceCode = order?.shippingMethod || '03'; // UPS Ground fallback
  const packagingCode = packageInfo.packagingType || '02'; // 02 = Customer Supplied Package
  const packagingDescription = packageInfo.packagingDescription || 'Customer Supplied Package';

  return {
    ShipmentRequest: {
      Request: {
        TransactionReference: {
          CustomerContext: `Order ${order._id}`,
        },
      },
      Shipment: {
        Description: `Custom Tees Order ${order._id}`,
        Shipper: {
          Name: DEFAULT_ORIGIN.name,
          ShipperNumber: UPS_SHIPPER_NUMBER,
          Address: {
            AddressLine: DEFAULT_ORIGIN.addressLine,
            City: DEFAULT_ORIGIN.city,
            StateProvinceCode: DEFAULT_ORIGIN.stateProvinceCode,
            PostalCode: DEFAULT_ORIGIN.postalCode,
            CountryCode: DEFAULT_ORIGIN.countryCode,
          },
        },
        ShipTo: {
          Name: shippingAddress.fullName || order?.user?.name || 'Customer',
          Address: {
            AddressLine: shippingAddress.line1,
            City: shippingAddress.city,
            StateProvinceCode: shippingAddress.state,
            PostalCode: shippingAddress.postalCode,
            CountryCode: shippingAddress.country || 'US',
          },
        },
        ShipFrom: {
          Name: DEFAULT_ORIGIN.name,
          Address: {
            AddressLine: DEFAULT_ORIGIN.addressLine,
            City: DEFAULT_ORIGIN.city,
            StateProvinceCode: DEFAULT_ORIGIN.stateProvinceCode,
            PostalCode: DEFAULT_ORIGIN.postalCode,
            CountryCode: DEFAULT_ORIGIN.countryCode,
          },
        },
        PaymentInformation: {
          ShipmentCharge: [
            {
              Type: '01',
              BillShipper: {
                AccountNumber: UPS_SHIPPER_NUMBER,
              },
            },
          ],
        },
        Service: {
          Code: serviceCode,
        },
        Package: [
          {
            Packaging: {
              Code: packagingCode,
              Description: packagingDescription,
            },
            ReferenceNumber: {
              Value: order._id.toString(),
            },
            Dimensions: {
              UnitOfMeasurement: { Code: 'IN' },
              Length: length,
              Width: width,
              Height: height,
            },
            PackageWeight: {
              UnitOfMeasurement: { Code: 'LBS' },
              Weight: weight,
            },
          },
        ],
      },
      LabelSpecification: {
        LabelImageFormat: { Code: 'PNG' },
        LabelStockSize: { Height: '6', Width: '4' },
      },
    },
  };
};

const parseUpsShipmentResponse = (responseBody) => {
  const shipmentResults = responseBody?.ShipmentResponse?.ShipmentResults;
  if (!shipmentResults) {
    throw new Error('UPS response missing ShipmentResults');
  }

  const packageResultsRaw = shipmentResults.PackageResults;
  const packageResults = Array.isArray(packageResultsRaw) ? packageResultsRaw[0] : packageResultsRaw;
  const trackingNumber =
    packageResults?.TrackingNumber || shipmentResults?.ShipmentIdentificationNumber || null;
  const labelImage =
    packageResults?.ShippingLabel?.GraphicImage || shipmentResults?.ControlLogReceipt?.GraphicImage;

  if (!trackingNumber || !labelImage) {
    throw new Error('UPS response missing tracking number or label image');
  }

  return { trackingNumber, labelImage, raw: responseBody };
};

export const createUpsShipment = async (order, packageInfo = {}) => {
  if (!order) {
    throw new Error('Order is required to create a shipment');
  }

  const payload = buildShipmentPayload(order, packageInfo);
  const accessToken = await getUpsToken();

  console.log('[UPS][Shipment] Request payload', JSON.stringify(payload, null, 2));
  const response = await fetch(SHIPMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      transId: Date.now().toString(),
      transactionSrc: 'CustomTeesAdmin',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  console.log('[UPS][Shipment] Raw response', response.status, responseText.substring(0, 1000));
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`UPS shipment API returned invalid JSON: ${error.message}`);
  }

  if (!response.ok) {
    const apiError =
      data?.response?.errors?.[0]?.message ||
      data?.Fault?.detail?.Errors?.ErrorDetail?.PrimaryErrorCode?.Description ||
      data?.Fault?.detail?.Errors?.ErrorDetail?.PrimaryErrorCode?.Code ||
      data?.message ||
      `UPS shipment API failed with status ${response.status}`;
    throw new Error(apiError);
  }

  const { trackingNumber, labelImage, raw } = parseUpsShipmentResponse(data);
  console.log('[UPS][Shipment] Parsed response', {
    trackingNumber,
    hasLabelImage: Boolean(labelImage),
  });

  await ensureLabelsDir();
  const orderId = order._id.toString();
  const labelFileName = `${orderId}.pdf`;
  const labelAbsolutePath = path.join(LABELS_DIR, labelFileName);

  const labelBuffer = Buffer.from(labelImage, 'base64');
  await convertImageToPdf(labelBuffer, labelAbsolutePath);
  const uploadedLabel = await uploadFile(labelAbsolutePath, {
    folder: 'customtees/labels',
    resourceType: 'raw',
    useFilename: true,
    uniqueFilename: false,
  });

  return {
    trackingNumber,
    labelUrl: uploadedLabel.url,
    labelPublicId: uploadedLabel.public_id,
    labelAbsolutePath,
    rawResponse: raw,
  };
};
