# UPS Shipping Integration Setup

## Overview
UPS shipping cost calculation has been integrated into the checkout process. The system automatically calculates shipping rates when a user selects a shipping address.

## Backend Setup

### 1. Environment Variables
**IMPORTANT:** Never hardcode UPS credentials in your code! Always use environment variables.

Add the following environment variables to your `.env` file in the `backend` directory:

```env
# UPS API Credentials (REQUIRED)
# Option 1: Use Client ID and Secret (recommended - tokens auto-generate)
UPS_CLIENT_ID=your_client_id_here
UPS_CLIENT_SECRET=your_client_secret_here

# Option 2: Use pre-generated access token (optional, but tokens expire)
# UPS_ACCESS_TOKEN=your_access_token_here

# UPS Account Number
UPS_SHIPPER_NUMBER=your_shipper_number

# Origin Address (where packages ship from)
UPS_ORIGIN_NAME=Custom Tees Store
UPS_ORIGIN_ADDRESS=123 Main St
UPS_ORIGIN_CITY=Los Angeles
UPS_ORIGIN_STATE=CA
UPS_ORIGIN_POSTAL=90001
UPS_ORIGIN_COUNTRY=US

# Use sandbox (true) or production (false)
UPS_USE_SANDBOX=true
```

**Note:** 
- If you provide both `UPS_CLIENT_ID` and `UPS_CLIENT_SECRET`, the system will automatically generate access tokens as needed
- Access tokens expire after a certain time, so using client credentials is recommended
- The system automatically checks token expiration and regenerates tokens when needed

### 2. Install Dependencies
If `node-fetch` is not already installed, run:
```bash
cd backend
npm install node-fetch
```

### 3. Files Created/Modified

**New Files:**
- `backend/src/services/ups.service.js` - UPS API integration service (Rating + Time in Transit)
- `backend/src/controllers/shipping.controller.js` - Shipping rate and transit time controllers
- `backend/src/routes/shipping.routes.js` - Shipping routes

**Modified Files:**
- `backend/server.js` - Added shipping routes
- `backend/src/models/Order.js` - Added `shippingCost` field
- `backend/src/controllers/order.controller.js` - Updated to include shipping cost in order total

## Frontend Setup

### Files Modified
- `frontend/src/lib/api.ts` - Added `getShippingRate` function
- `frontend/src/pages/Checkout.tsx` - Integrated UPS shipping calculation

### Features
- Automatically calculates shipping cost when address is selected
- Shows "Calculating..." while fetching rate
- Displays shipping cost in order summary
- **Shows transit time and estimated delivery date** (from Time in Transit API)
- **Displays guaranteed delivery indicator** for eligible services
- Includes shipping cost in total calculation
- Gracefully handles errors (doesn't block checkout)
- **Automatically recalculates** when address is edited

## How It Works

1. **User selects shipping address** → Frontend triggers shipping rate calculation
2. **Frontend calls** `/api/shipping/rate` with destination address
3. **Backend service**:
   - Uses UPS access token (or generates one from client credentials)
   - Calls UPS Rating API with origin/destination addresses to get shipping cost
   - **Automatically calls UPS Time in Transit API** to get delivery estimates
   - Returns shipping cost in cents + transit time information
4. **Frontend displays**:
   - Shipping cost
   - Estimated transit days
   - Estimated delivery date
   - Guaranteed delivery indicator (if applicable)
5. **Order creation** includes shipping cost in the order total

### Time in Transit Features

- **Automatic Integration**: Time in Transit is automatically fetched when calculating shipping rates
- **Delivery Estimates**: Shows estimated business days and delivery date
- **Guaranteed Services**: Displays "✓ Guaranteed" badge for guaranteed delivery services
- **Fallback Handling**: If Time in Transit API fails, falls back to Rating API transit data
- **Separate Endpoint**: Available at `/api/shipping/transit` to get transit times for all services

## UPS Service Codes

Default service code is `03` (UPS Ground). You can modify this in `Checkout.tsx`:

- `01` - UPS Next Day Air
- `02` - UPS 2nd Day Air
- `03` - UPS Ground (default)
- `12` - UPS 3 Day Select
- `13` - UPS Next Day Air Saver
- `14` - UPS Next Day Air Early AM
- `59` - UPS 2nd Day Air AM
- `65` - UPS Saver

## Testing

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Test the checkout flow:
   - Add items to cart
   - Go to checkout
   - Select a shipping address
   - Verify shipping cost is calculated and displayed

## Troubleshooting

### "Invalid Authentication Information" Error

If you see this error, it usually means:

1. **Missing or incorrect credentials**: Make sure `UPS_CLIENT_ID` and `UPS_CLIENT_SECRET` are set correctly in your `.env` file
2. **Expired token**: If using `UPS_ACCESS_TOKEN`, it may have expired. Remove it and let the system generate a new one using client credentials
3. **Wrong environment**: Ensure `UPS_USE_SANDBOX` matches your credentials (sandbox vs production)

**Solution**: 
- Remove any hardcoded credentials from the code
- Set `UPS_CLIENT_ID` and `UPS_CLIENT_SECRET` in your `.env` file
- Restart your backend server
- The system will automatically generate a new token

## Notes

- Shipping cost is stored in cents (matching order pricing format)
- Weight is estimated as 0.5 lbs per cart item (can be customized)
- If shipping calculation fails, checkout still proceeds (shipping shows as "Unable to calculate")
- The system uses UPS Sandbox by default (set `UPS_USE_SANDBOX=false` for production)
- **Security**: Never commit `.env` files or hardcode credentials in your codebase
- Token expiration is automatically handled - tokens are regenerated when expired




