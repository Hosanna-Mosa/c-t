import fetch from "node-fetch";

// ---------------------
// CONFIG (UPDATE THESE)
// ---------------------
const CLIENT_ID = "AoWAv15m8xDeNPjgZQ4JNpqjKn5EGNWvYAm9yN6cnGf8xAhC";
const CLIENT_SECRET = "qsDIuVy7hVbGU7GpGotVL7D6n717fmRwOgQYGG1f4HMVl9n8DNFpA5uRYEQpFX9t";
const SHIPPER_NUMBER = "1C384J"; // UPS Account Number

// UPS Sandbox URLs
const TOKEN_URL = "https://wwwcie.ups.com/security/v1/oauth/token";
const RATING_URL = "https://wwwcie.ups.com/api/rating/v2205/rate";

// ----------------------------------
// STEP 1 → Generate OAuth Token
// ----------------------------------
async function generateToken() {
  console.log("🔐 Generating UPS OAuth Token...\n");

  const authHeader =
    "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: authHeader,
    },
    body: params.toString(),
  });

  const data = await response.json();
  console.log("✅ TOKEN RESPONSE:", data, "\n");

  if (!data.access_token) {
    throw new Error("❌ Failed to generate access token.");
  }

  return data.access_token;
}

// ----------------------------------
// STEP 2 → Call UPS Rating API
// ----------------------------------
async function getRate(accessToken) {
  console.log("📦 Calling UPS Rating API...\n");

  const body = {
    RateRequest: {
      Request: {
        TransactionReference: {
          CustomerContext: "Rating Test",
        },
      },
      Shipment: {
        Shipper: {
          Name: "Custom Tees Store",
          ShipperNumber: SHIPPER_NUMBER,
          Address: {
            AddressLine: "123 Main St",
            City: "Los Angeles",
            StateProvinceCode: "CA",
            PostalCode: "90001",
            CountryCode: "US",
          },
        },
        ShipTo: {
          Name: "Test Customer",
          Address: {
            AddressLine: "456 Market St",
            City: "San Francisco",
            StateProvinceCode: "CA",
            PostalCode: "94105",
            CountryCode: "US",
          },
        },
        ShipFrom: {
          Name: "Custom Tees Store",
          Address: {
            AddressLine: "123 Main St",
            City: "Los Angeles",
            StateProvinceCode: "CA",
            PostalCode: "90001",
            CountryCode: "US",
          },
        },
        Service: {
          Code: "03", // UPS Ground
        },
        Package: [
          {
            PackagingType: { Code: "02" },
            PackageWeight: {
              UnitOfMeasurement: { Code: "LBS" },
              Weight: "5",
            },
          },
        ],
      },
    },
  };

  const response = await fetch(RATING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      transId: "12345678",
      transactionSrc: "CustomTeesApp",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  console.log("📦 UPS Rating Response:\n", JSON.stringify(data, null, 2));
}

// ----------------------------------
// MAIN FLOW
// ----------------------------------
async function run() {
  try {
    const token = await generateToken();
    await getRate(token);
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

run();
