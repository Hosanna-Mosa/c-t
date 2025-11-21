import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../src/config/db.js';
import Product from '../src/models/Product.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common color names mapped to their expected hex codes
const COLOR_MAPPINGS = {
  // Basic Colors
  'red': '#FF0000',
  'blue': '#0000FF',
  'green': '#00FF00',
  'yellow': '#FFFF00',
  'orange': '#FFA500',
  'purple': '#800080',
  'pink': '#FFC0CB',
  'brown': '#A52A2A',
  'black': '#000000',
  'white': '#FFFFFF',
  'gray': '#808080',
  'grey': '#808080',
  
  // Extended Colors
  'navy': '#000080',
  'navy blue': '#000080',
  'sky blue': '#87CEEB',
  'skyblue': '#87CEEB',
  'sky': '#87CEEB',
  'light blue': '#ADD8E6',
  'lightblue': '#ADD8E6',
  'dark blue': '#00008B',
  'darkblue': '#00008B',
  'royal blue': '#4169E1',
  'royalblue': '#4169E1',
  
  'dark red': '#8B0000',
  'darkred': '#8B0000',
  'light red': '#FF6B6B',
  'lightred': '#FF6B6B',
  'maroon': '#800000',
  'crimson': '#DC143C',
  
  'dark green': '#006400',
  'darkgreen': '#006400',
  'light green': '#90EE90',
  'lightgreen': '#90EE90',
  'lime': '#00FF00',
  'olive': '#808000',
  'forest green': '#228B22',
  'forestgreen': '#228B22',
  
  'gold': '#FFD700',
  'silver': '#C0C0C0',
  'bronze': '#CD7F32',
  
  'beige': '#F5F5DC',
  'tan': '#D2B48C',
  'khaki': '#F0E68C',
  'cream': '#FFFDD0',
  'ivory': '#FFFFF0',
  
  'cyan': '#00FFFF',
  'magenta': '#FF00FF',
  'teal': '#008080',
  'turquoise': '#40E0D0',
  'aqua': '#00FFFF',
  
  'lavender': '#E6E6FA',
  'violet': '#EE82EE',
  'indigo': '#4B0082',
  'plum': '#DDA0DD',
  
  'coral': '#FF7F50',
  'salmon': '#FA8072',
  'peach': '#FFE5B4',
  'apricot': '#FBCEB1',
  'tangerine': '#FF7518',
  
  'charcoal': '#36454F',
  'slate': '#708090',
  'steel': '#4682B4',
  'gunmetal': '#2C3539',
  
  'burgundy': '#800020',
  'wine': '#722F37',
  'ruby': '#E0115F',
  'emerald': '#50C878',
  'sapphire': '#0F52BA',
  
  // Additional colors from product variants
  'antique royal': '#4169E1',
  'antiqueroyal': '#4169E1',
  'ash': '#B2BEB5',
  'azalea': '#F7C8E0',
  'charcole': '#36454F', // Misspelling of charcoal
  'cornsilk': '#FFF8DC',
  'daisy': '#FFFACD',
  'dark chocolate': '#3D2817',
  'darkchocolate': '#3D2817',
  'heather cardinal': '#A32638',
  'heathercardinal': '#A32638',
  'heliconia': '#FF4500',
  'iris': '#5A4FCF',
  'jade dome': '#00A86B',
  'jadedome': '#00A86B',
  'kelly': '#4CBB17',
  'kelly green': '#4CBB17',
  'kellygreen': '#4CBB17',
  'kiwi': '#8EE53F',
  'orchid': '#DA70D6',
  'pistachio': '#93C572',
  'prairie dust': '#B9A082',
  'prairiedust': '#B9A082',
  'sand': '#C2B280',
  'graphite heather': '#53565A',
  'graphiteheather': '#53565A',
  'cardinal': '#C41E3A',
  'cobalt': '#0047AB',
  'dark heather': '#4F4F4F',
  'darkheather': '#4F4F4F',
  'dusty rose': '#B76E79',
  'dustyrose': '#B76E79',
  'garnet': '#733635',
  'neon green': '#39FF14', // Keep as is - this is the correct neon green
  'neongreen': '#39FF14',
  'safety pink': '#FF91AF', // Safety pink is brighter than regular pink
  'safetypink': '#FF91AF',
  'sport grey': '#A7A7A7', // Sport grey is lighter than standard grey
  'sportgrey': '#A7A7A7',
  'sport gray': '#A7A7A7',
  'sportgray': '#A7A7A7',
  'military green': '#4B5320',
  'militarygreen': '#4B5320',
  'mint green': '#98FF98',
  'mintgreen': '#98FF98',
  'voilet': '#EE82EE', // Misspelling of violet
  'royal': '#4169E1',
  'forest': '#228B22',
  
  // Heathered variants (handle "Hodded" misspelling and "Heathered" prefix)
  'hodded ash': '#B2BEB5',
  'hoddedash': '#B2BEB5',
  'heathered ash': '#B2BEB5',
  'heatheredash': '#B2BEB5',
  'hodded azalea': '#F7C8E0',
  'hoddedazalea': '#F7C8E0',
  'heathered azalea': '#F7C8E0',
  'heatheredazalea': '#F7C8E0',
  'hodded dark chocolate': '#3D2817',
  'hoddeddarkchocolate': '#3D2817',
  'heathered dark chocolate': '#3D2817',
  'heathereddarkchocolate': '#3D2817',
  'hodded dark heather': '#4F4F4F',
  'hoddeddarkheather': '#4F4F4F',
  'heathered dark heather': '#4F4F4F',
  'heathereddarkheather': '#4F4F4F',
  'hodded forest': '#228B22',
  'hoddedforest': '#228B22',
  'heathered forest': '#228B22',
  'heatheredforest': '#228B22',
  'hodded garnet': '#733635',
  'hoddedgarnet': '#733635',
  'heathered garnet': '#733635',
  'heatheredgarnet': '#733635',
  'hodded graphite heather': '#53565A',
  'hoddedgraphiteheather': '#53565A',
  'heathered graphite heather': '#53565A',
  'heatheredgraphiteheather': '#53565A',
  'hodded heather dark royal': '#4169E1',
  'hoddedheatherdarkroyal': '#4169E1',
  'heathered dark royal': '#4169E1',
  'heathereddarkroyal': '#4169E1',
  'hodded heliconia': '#FF4500',
  'hoddedheliconia': '#FF4500',
  'heathered heliconia': '#FF4500',
  'heatheredheliconia': '#FF4500',
  'hodded military greeen': '#4B5320', // Handle misspelling
  'hoddedmilitarygreeen': '#4B5320',
  'hodded military green': '#4B5320',
  'hoddedmilitarygreen': '#4B5320',
  'heathered military green': '#4B5320',
  'heatheredmilitarygreen': '#4B5320',
  'hodded mint greeen': '#98FF98', // Handle misspelling
  'hoddedmintgreeen': '#98FF98',
  'hodded mint green': '#98FF98',
  'hoddedmintgreen': '#98FF98',
  'heathered mint green': '#98FF98',
  'heatheredmintgreen': '#98FF98',
  'hodded orchid': '#DA70D6',
  'hoddedorchid': '#DA70D6',
  'heathered orchid': '#DA70D6',
  'heatheredorchid': '#DA70D6',
  'hodded purple': '#800080',
  'hoddedpurple': '#800080',
  'heathered purple': '#800080',
  'heatheredpurple': '#800080',
  'hodded royal': '#4169E1',
  'hoddedroyal': '#4169E1',
  'heathered royal': '#4169E1',
  'heatheredroyal': '#4169E1',
  'hodded sand': '#C2B280',
  'hoddedsand': '#C2B280',
  'heathered sand': '#C2B280',
  'heatheredsand': '#C2B280',
  
  // Special cases
  'transparent': '#FFFFFF',
  'natural': '#F5F5DC',
  'off white': '#FAFAFA',
  'offwhite': '#FAFAFA',
  'off-white': '#FAFAFA',
};

// Helper function to normalize color name for comparison
const normalizeColorName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bhodded\b/g, 'heathered') // Fix common misspelling
    .replace(/\bgreeen\b/g, 'green') // Fix misspelling
    .replace(/\bvoilet\b/g, 'violet') // Fix misspelling
    .replace(/\bcharcole\b/g, 'charcoal') // Fix misspelling
    .trim();
};

// Helper function to parse hex color
const parseHexColor = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const cleaned = hex.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/i.test(cleaned)) return null;
  return cleaned;
};

// Helper function to convert hex to RGB
const hexToRgb = (hex) => {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Helper function to check if color code is close to expected color
const isColorSimilar = (hex1, hex2, tolerance = 50) => {
  if (!hex1 || !hex2) return false;
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return false;
  
  const diff = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
  
  return diff <= tolerance;
};

// Get expected color code for a color name
const getExpectedColorCode = (colorName) => {
  const normalized = normalizeColorName(colorName);
  
  // Direct match
  if (COLOR_MAPPINGS[normalized]) {
    return COLOR_MAPPINGS[normalized];
  }
  
  // Try to extract base color from heated/heathered variants
  // e.g., "heathered dark royal" -> "dark royal" -> "royal"
  let searchName = normalized;
  if (normalized.startsWith('heathered ') || normalized.startsWith('heated ')) {
    searchName = normalized.replace(/^(heathered|heated)\s+/, '');
  }
  
  // Direct match with base color
  if (COLOR_MAPPINGS[searchName]) {
    return COLOR_MAPPINGS[searchName];
  }
  
  // Try longest match first (more specific colors)
  const colorKeys = Object.keys(COLOR_MAPPINGS).sort((a, b) => b.length - a.length);
  for (const key of colorKeys) {
    // Check if the key is contained in the normalized name (for compound colors)
    if (normalized.includes(key) && key.length > 3) {
      return COLOR_MAPPINGS[key];
    }
    // Check if normalized name is contained in key (for partial matches)
    if (key.includes(searchName) && searchName.length > 3) {
      return COLOR_MAPPINGS[key];
    }
  }
  
  // Check for color names that contain common color words
  const colorWords = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey', 'royal', 'navy', 'coral', 'peach', 'sand', 'ash', 'charcoal'];
  for (const word of colorWords) {
    if (normalized.includes(word)) {
      const wordKey = Object.keys(COLOR_MAPPINGS).find(k => k === word || k.includes(word));
      if (wordKey) {
        return COLOR_MAPPINGS[wordKey];
      }
    }
  }
  
  return null;
};

// Check if color code matches color name
const checkColorMatch = (colorName, colorCode) => {
  const normalizedName = normalizeColorName(colorName);
  const parsedCode = parseHexColor(colorCode);
  
  // Check if color code is missing
  if (!colorCode || !parsedCode) {
    return {
      match: false,
      issue: 'Missing or invalid color code',
      expected: getExpectedColorCode(colorName),
      severity: 'high'
    };
  }
  
  // Get expected color code
  const expectedCode = getExpectedColorCode(colorName);
  
  if (!expectedCode) {
    // Unknown color name - mark as high severity so it can be fixed if we find a match
    return {
      match: false,
      issue: 'Unknown color name (cannot verify)',
      expected: null,
      severity: 'high' // Change to high so we can track it, but won't fix without expected code
    };
  }
  
  // Check exact match
  if (parsedCode === expectedCode.toUpperCase()) {
    return {
      match: true,
      issue: null,
      expected: expectedCode,
      severity: 'none'
    };
  }
  
  // Check if colors are very similar (within strict tolerance of 30)
  // Only very close matches are considered acceptable
  if (isColorSimilar(parsedCode, expectedCode, 30)) {
    return {
      match: true,
      issue: 'Very close match (acceptable variation)',
      expected: expectedCode,
      severity: 'none' // Don't fix very close matches
    };
  }
  
  // Check if colors are somewhat similar (within tolerance of 80)
  // These should be fixed to match exactly
  if (isColorSimilar(parsedCode, expectedCode, 80)) {
    return {
      match: false,
      issue: 'Close match (needs correction)',
      expected: expectedCode,
      severity: 'high' // Mark as high to fix it
    };
  }
  
  // Mismatch detected - significantly different
  return {
    match: false,
    issue: 'Color code does not match color name',
    expected: expectedCode,
    severity: 'high'
  };
};

// Fix color mismatches in database
const fixColorMismatches = async (mismatches) => {
  const updates = [];
  const productsToUpdate = new Map();
  
  // Group mismatches by product and only fix high severity issues
  for (const mismatch of mismatches) {
    if (mismatch.severity === 'high' && mismatch.expectedColorCode) {
      if (!productsToUpdate.has(mismatch.productId)) {
        productsToUpdate.set(mismatch.productId, {
          productId: mismatch.productId,
          productName: mismatch.productName,
          productSlug: mismatch.productSlug,
          variants: []
        });
      }
      
      productsToUpdate.get(mismatch.productId).variants.push({
        variantIndex: mismatch.variantIndex,
        colorName: mismatch.colorName,
        oldColorCode: mismatch.colorCode === '(missing)' ? null : mismatch.colorCode,
        newColorCode: mismatch.expectedColorCode,
        issue: mismatch.issue
      });
    }
  }
  
  // Update each product
  for (const [productId, productData] of productsToUpdate.entries()) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        console.log(`⚠️  Product not found: ${productId}`);
        continue;
      }
      
      let hasChanges = false;
      
      // Update each variant
      for (const variantUpdate of productData.variants) {
        const variant = product.variants[variantUpdate.variantIndex];
        if (variant) {
          variant.colorCode = variantUpdate.newColorCode;
          hasChanges = true;
          
          updates.push({
            productId: productId,
            productName: productData.productName,
            productSlug: productData.productSlug,
            variantIndex: variantUpdate.variantIndex,
            colorName: variantUpdate.colorName,
            oldColorCode: variantUpdate.oldColorCode,
            newColorCode: variantUpdate.newColorCode,
            issue: variantUpdate.issue
          });
        }
      }
      
      // Save product if there are changes
      if (hasChanges) {
        await product.save();
        console.log(`✅ Updated product: ${productData.productName}`);
      }
    } catch (error) {
      console.error(`❌ Error updating product ${productData.productName}:`, error.message);
    }
  }
  
  return updates;
};

// Main function to check and fix all products
const checkColorMismatches = async () => {
  try {
    console.log('🔍 Starting color mismatch check and fix...\n');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database\n');
    
    // Fetch all products
    const products = await Product.find({}).sort({ name: 1 });
    console.log(`📦 Found ${products.length} products\n`);
    
    if (products.length === 0) {
      console.log('⚠️  No products found in database');
      await mongoose.connection.close();
      return;
    }
    
    // Track mismatches
    const mismatches = [];
    const statistics = {
      totalProducts: products.length,
      totalVariants: 0,
      variantsWithIssues: 0,
      highSeverityIssues: 0,
      missingColorCodes: 0,
      exactMatches: 0,
      closeMatches: 0,
      unknownColors: 0,
    };
    
    // Check each product
    for (const product of products) {
      if (!product.variants || product.variants.length === 0) {
        continue;
      }
      
      statistics.totalVariants += product.variants.length;
      
      // Check each variant
      for (let i = 0; i < product.variants.length; i++) {
        const variant = product.variants[i];
        const colorName = variant.color || 'Unknown';
        const colorCode = variant.colorCode || '';
        
        const checkResult = checkColorMatch(colorName, colorCode);
        
        // Track statistics
        if (checkResult.match && checkResult.severity === 'none') {
          if (checkResult.issue === null) {
            statistics.exactMatches++;
          } else if (checkResult.issue === 'Very close match (acceptable variation)') {
            statistics.closeMatches++;
          }
        } else {
          // There's an issue to track
          if (checkResult.issue) {
            statistics.variantsWithIssues++;
            
            if (checkResult.severity === 'high') {
              statistics.highSeverityIssues++;
            }
            
            if (checkResult.issue === 'Missing or invalid color code') {
              statistics.missingColorCodes++;
            }
            
            if (checkResult.issue === 'Unknown color name (cannot verify)') {
              statistics.unknownColors++;
            }
            
            if (checkResult.issue === 'Close match (needs correction)') {
              statistics.closeMatches++;
            }
            
            // Add to mismatches
            mismatches.push({
              productId: product._id.toString(),
              productName: product.name,
              productSlug: product.slug,
              variantIndex: i,
              colorName: colorName,
              colorCode: colorCode || '(missing)',
              issue: checkResult.issue,
              expectedColorCode: checkResult.expected,
              severity: checkResult.severity,
            });
          }
        }
      }
    }
    
    // Display results
    console.log('='.repeat(80));
    console.log('📊 STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total Products: ${statistics.totalProducts}`);
    console.log(`Total Variants: ${statistics.totalVariants}`);
    console.log(`Variants with Issues: ${statistics.variantsWithIssues}`);
    console.log(`High Severity Issues: ${statistics.highSeverityIssues}`);
    console.log(`Missing Color Codes: ${statistics.missingColorCodes}`);
    console.log(`Exact Matches: ${statistics.exactMatches}`);
    console.log(`Close Matches: ${statistics.closeMatches}`);
    console.log(`Unknown Colors: ${statistics.unknownColors}`);
    console.log('='.repeat(80));
    console.log('');
    
    // Display mismatches
    if (mismatches.length > 0) {
      console.log('='.repeat(80));
      console.log('❌ COLOR MISMATCHES FOUND');
      console.log('='.repeat(80));
      console.log('');
      
      // Group by product
      const groupedByProduct = {};
      for (const mismatch of mismatches) {
        if (!groupedByProduct[mismatch.productId]) {
          groupedByProduct[mismatch.productId] = {
            productName: mismatch.productName,
            productSlug: mismatch.productSlug,
            variants: []
          };
        }
        groupedByProduct[mismatch.productId].variants.push(mismatch);
      }
      
      // Display each product with mismatches
      for (const [productId, productData] of Object.entries(groupedByProduct)) {
        console.log(`📦 Product: ${productData.productName}`);
        console.log(`   Slug: ${productData.productSlug}`);
        console.log(`   ID: ${productId}`);
        console.log(`   Variants with issues: ${productData.variants.length}`);
        console.log('');
        
        for (const variant of productData.variants) {
          const severityIcon = variant.severity === 'high' ? '🔴' : '🟡';
          console.log(`   ${severityIcon} Variant #${variant.variantIndex + 1}`);
          console.log(`      Color Name: "${variant.colorName}"`);
          console.log(`      Color Code: ${variant.colorCode}`);
          console.log(`      Issue: ${variant.issue}`);
          if (variant.expectedColorCode) {
            console.log(`      Expected: ${variant.expectedColorCode}`);
          }
          console.log('');
        }
        
        console.log('-'.repeat(80));
        console.log('');
      }
      
      // Fix high severity mismatches
      console.log('='.repeat(80));
      console.log('🔧 FIXING COLOR MISMATCHES');
      console.log('='.repeat(80));
      console.log('');
      
      const updates = await fixColorMismatches(mismatches);
      
      if (updates.length > 0) {
        console.log('');
        console.log('='.repeat(80));
        console.log('✅ UPDATES APPLIED');
        console.log('='.repeat(80));
        console.log('');
        console.log(`📝 Total updates: ${updates.length}`);
        console.log('');
        
        // Group updates by product
        const updatesByProduct = {};
        for (const update of updates) {
          if (!updatesByProduct[update.productId]) {
            updatesByProduct[update.productId] = {
              productName: update.productName,
              productSlug: update.productSlug,
              updates: []
            };
          }
          updatesByProduct[update.productId].updates.push(update);
        }
        
        // Display updates
        console.log('='.repeat(80));
        console.log('📋 UPDATED PRODUCTS');
        console.log('='.repeat(80));
        console.log('');
        
        for (const [productId, productData] of Object.entries(updatesByProduct)) {
          console.log(`📦 Product: ${productData.productName}`);
          console.log(`   Slug: ${productData.productSlug}`);
          console.log(`   ID: ${productId}`);
          console.log(`   Variants updated: ${productData.updates.length}`);
          console.log('');
          
          for (const update of productData.updates) {
            console.log(`   ✅ Variant #${update.variantIndex + 1}`);
            console.log(`      Color Name: "${update.colorName}"`);
            console.log(`      Old Color Code: ${update.oldColorCode || '(missing)'}`);
            console.log(`      New Color Code: ${update.newColorCode}`);
            console.log(`      Issue: ${update.issue}`);
            console.log('');
          }
          
          console.log('-'.repeat(80));
          console.log('');
        }
        
        // Generate summary report
        console.log('='.repeat(80));
        console.log('📋 SUMMARY REPORT');
        console.log('='.repeat(80));
        console.log('');
        console.log('Products updated:');
        for (const [productId, productData] of Object.entries(updatesByProduct)) {
          console.log(`  ✅ ${productData.productName} (${productData.updates.length} variant(s) updated)`);
        }
        console.log('');
        
        // Export to JSON file
        const reportPath = path.join(__dirname, 'color_mismatch_report.json');
        const updatesReportPath = path.join(__dirname, 'color_updates_report.json');
        
        const report = {
          generatedAt: new Date().toISOString(),
          statistics,
          mismatches: mismatches.map(m => ({
            productId: m.productId,
            productName: m.productName,
            productSlug: m.productSlug,
            variantIndex: m.variantIndex,
            colorName: m.colorName,
            colorCode: m.colorCode,
            issue: m.issue,
            expectedColorCode: m.expectedColorCode,
            severity: m.severity,
          }))
        };
        
        const updatesReport = {
          generatedAt: new Date().toISOString(),
          totalUpdates: updates.length,
          updates: updates.map(u => ({
            productId: u.productId,
            productName: u.productName,
            productSlug: u.productSlug,
            variantIndex: u.variantIndex,
            colorName: u.colorName,
            oldColorCode: u.oldColorCode,
            newColorCode: u.newColorCode,
            issue: u.issue,
          })),
          statistics: {
            productsUpdated: Object.keys(updatesByProduct).length,
            variantsUpdated: updates.length,
          }
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        fs.writeFileSync(updatesReportPath, JSON.stringify(updatesReport, null, 2));
        console.log(`💾 Mismatch report saved to: ${reportPath}`);
        console.log(`💾 Updates report saved to: ${updatesReportPath}`);
        console.log('');
      } else {
        console.log('⚠️  No high severity mismatches to fix (or no expected color codes available)');
        console.log('');
        
        // Export mismatch report only
        const reportPath = path.join(__dirname, 'color_mismatch_report.json');
        const report = {
          generatedAt: new Date().toISOString(),
          statistics,
          mismatches: mismatches.map(m => ({
            productId: m.productId,
            productName: m.productName,
            productSlug: m.productSlug,
            variantIndex: m.variantIndex,
            colorName: m.colorName,
            colorCode: m.colorCode,
            issue: m.issue,
            expectedColorCode: m.expectedColorCode,
            severity: m.severity,
          }))
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`💾 Detailed report saved to: ${reportPath}`);
        console.log('');
      }
    } else {
      console.log('✅ No color mismatches found! All color names match their color codes.');
      console.log('');
    }
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error checking/fixing color mismatches:', error);
    process.exit(1);
  }
};

// Run the script
checkColorMismatches();



};



// Fix color mismatches in database

const fixColorMismatches = async (mismatches) => {

  const updates = [];

  const productsToUpdate = new Map();

  

  // Group mismatches by product and only fix high severity issues

  for (const mismatch of mismatches) {

    if (mismatch.severity === 'high' && mismatch.expectedColorCode) {

      if (!productsToUpdate.has(mismatch.productId)) {

        productsToUpdate.set(mismatch.productId, {

          productId: mismatch.productId,

          productName: mismatch.productName,

          productSlug: mismatch.productSlug,

          variants: []

        });

      }

      

      productsToUpdate.get(mismatch.productId).variants.push({

        variantIndex: mismatch.variantIndex,

        colorName: mismatch.colorName,

        oldColorCode: mismatch.colorCode === '(missing)' ? null : mismatch.colorCode,

        newColorCode: mismatch.expectedColorCode,

        issue: mismatch.issue

      });

    }

  }

  

  // Update each product

  for (const [productId, productData] of productsToUpdate.entries()) {

    try {

      const product = await Product.findById(productId);

      if (!product) {

        console.log(`⚠️  Product not found: ${productId}`);

        continue;

      }

      

      let hasChanges = false;

      

      // Update each variant

      for (const variantUpdate of productData.variants) {

        const variant = product.variants[variantUpdate.variantIndex];

        if (variant) {

          variant.colorCode = variantUpdate.newColorCode;

          hasChanges = true;

          

          updates.push({

            productId: productId,

            productName: productData.productName,

            productSlug: productData.productSlug,

            variantIndex: variantUpdate.variantIndex,

            colorName: variantUpdate.colorName,

            oldColorCode: variantUpdate.oldColorCode,

            newColorCode: variantUpdate.newColorCode,

            issue: variantUpdate.issue

          });

        }

      }

      

      // Save product if there are changes

      if (hasChanges) {

        await product.save();

        console.log(`✅ Updated product: ${productData.productName}`);

      }

    } catch (error) {

      console.error(`❌ Error updating product ${productData.productName}:`, error.message);

    }

  }

  

  return updates;

};



// Main function to check and fix all products

const checkColorMismatches = async () => {

  try {

    console.log('🔍 Starting color mismatch check and fix...\n');

    

    // Connect to database

    await connectDB();

    console.log('✅ Connected to database\n');

    

    // Fetch all products

    const products = await Product.find({}).sort({ name: 1 });

    console.log(`📦 Found ${products.length} products\n`);

    

    if (products.length === 0) {

      console.log('⚠️  No products found in database');

      await mongoose.connection.close();

      return;

    }

    

    // Track mismatches

    const mismatches = [];

    const statistics = {

      totalProducts: products.length,

      totalVariants: 0,

      variantsWithIssues: 0,

      highSeverityIssues: 0,

      missingColorCodes: 0,

      exactMatches: 0,

      closeMatches: 0,

      unknownColors: 0,

    };

    

    // Check each product

    for (const product of products) {

      if (!product.variants || product.variants.length === 0) {

        continue;

      }

      

      statistics.totalVariants += product.variants.length;

      

      // Check each variant

      for (let i = 0; i < product.variants.length; i++) {

        const variant = product.variants[i];

        const colorName = variant.color || 'Unknown';

        const colorCode = variant.colorCode || '';

        

        const checkResult = checkColorMatch(colorName, colorCode);

        

        // Track statistics

        if (checkResult.match && checkResult.severity === 'none') {

          if (checkResult.issue === null) {

            statistics.exactMatches++;

          } else if (checkResult.issue === 'Very close match (acceptable variation)') {

            statistics.closeMatches++;

          }

        } else {

          // There's an issue to track

          if (checkResult.issue) {

            statistics.variantsWithIssues++;

            

            if (checkResult.severity === 'high') {

              statistics.highSeverityIssues++;

            }

            

            if (checkResult.issue === 'Missing or invalid color code') {

              statistics.missingColorCodes++;

            }

            

            if (checkResult.issue === 'Unknown color name (cannot verify)') {

              statistics.unknownColors++;

            }

            

            if (checkResult.issue === 'Close match (needs correction)') {

              statistics.closeMatches++;

            }

            

            // Add to mismatches

            mismatches.push({

              productId: product._id.toString(),

              productName: product.name,

              productSlug: product.slug,

              variantIndex: i,

              colorName: colorName,

              colorCode: colorCode || '(missing)',

              issue: checkResult.issue,

              expectedColorCode: checkResult.expected,

              severity: checkResult.severity,

            });

          }

        }

      }

    }

    

    // Display results

    console.log('='.repeat(80));

    console.log('📊 STATISTICS');

    console.log('='.repeat(80));

    console.log(`Total Products: ${statistics.totalProducts}`);

    console.log(`Total Variants: ${statistics.totalVariants}`);

    console.log(`Variants with Issues: ${statistics.variantsWithIssues}`);

    console.log(`High Severity Issues: ${statistics.highSeverityIssues}`);

    console.log(`Missing Color Codes: ${statistics.missingColorCodes}`);

    console.log(`Exact Matches: ${statistics.exactMatches}`);

    console.log(`Close Matches: ${statistics.closeMatches}`);

    console.log(`Unknown Colors: ${statistics.unknownColors}`);

    console.log('='.repeat(80));

    console.log('');

    

    // Display mismatches

    if (mismatches.length > 0) {

      console.log('='.repeat(80));

      console.log('❌ COLOR MISMATCHES FOUND');

      console.log('='.repeat(80));

      console.log('');

      

      // Group by product

      const groupedByProduct = {};

      for (const mismatch of mismatches) {

        if (!groupedByProduct[mismatch.productId]) {

          groupedByProduct[mismatch.productId] = {

            productName: mismatch.productName,

            productSlug: mismatch.productSlug,

            variants: []

          };

        }

        groupedByProduct[mismatch.productId].variants.push(mismatch);

      }

      

      // Display each product with mismatches

      for (const [productId, productData] of Object.entries(groupedByProduct)) {

        console.log(`📦 Product: ${productData.productName}`);

        console.log(`   Slug: ${productData.productSlug}`);

        console.log(`   ID: ${productId}`);

        console.log(`   Variants with issues: ${productData.variants.length}`);

        console.log('');

        

        for (const variant of productData.variants) {

          const severityIcon = variant.severity === 'high' ? '🔴' : '🟡';

          console.log(`   ${severityIcon} Variant #${variant.variantIndex + 1}`);

          console.log(`      Color Name: "${variant.colorName}"`);

          console.log(`      Color Code: ${variant.colorCode}`);

          console.log(`      Issue: ${variant.issue}`);

          if (variant.expectedColorCode) {

            console.log(`      Expected: ${variant.expectedColorCode}`);

          }

          console.log('');

        }

        

        console.log('-'.repeat(80));

        console.log('');

      }

      

      // Fix high severity mismatches

      console.log('='.repeat(80));

      console.log('🔧 FIXING COLOR MISMATCHES');

      console.log('='.repeat(80));

      console.log('');

      

      const updates = await fixColorMismatches(mismatches);

      

      if (updates.length > 0) {

        console.log('');

        console.log('='.repeat(80));

        console.log('✅ UPDATES APPLIED');

        console.log('='.repeat(80));

        console.log('');

        console.log(`📝 Total updates: ${updates.length}`);

        console.log('');

        

        // Group updates by product

        const updatesByProduct = {};

        for (const update of updates) {

          if (!updatesByProduct[update.productId]) {

            updatesByProduct[update.productId] = {

              productName: update.productName,

              productSlug: update.productSlug,

              updates: []

            };

          }

          updatesByProduct[update.productId].updates.push(update);

        }

        

        // Display updates

        console.log('='.repeat(80));

        console.log('📋 UPDATED PRODUCTS');

        console.log('='.repeat(80));

        console.log('');

        

        for (const [productId, productData] of Object.entries(updatesByProduct)) {

          console.log(`📦 Product: ${productData.productName}`);

          console.log(`   Slug: ${productData.productSlug}`);

          console.log(`   ID: ${productId}`);

          console.log(`   Variants updated: ${productData.updates.length}`);

          console.log('');

          

          for (const update of productData.updates) {

            console.log(`   ✅ Variant #${update.variantIndex + 1}`);

            console.log(`      Color Name: "${update.colorName}"`);

            console.log(`      Old Color Code: ${update.oldColorCode || '(missing)'}`);

            console.log(`      New Color Code: ${update.newColorCode}`);

            console.log(`      Issue: ${update.issue}`);

            console.log('');

          }

          

          console.log('-'.repeat(80));

          console.log('');

        }

        

        // Generate summary report

        console.log('='.repeat(80));

        console.log('📋 SUMMARY REPORT');

        console.log('='.repeat(80));

        console.log('');

        console.log('Products updated:');

        for (const [productId, productData] of Object.entries(updatesByProduct)) {

          console.log(`  ✅ ${productData.productName} (${productData.updates.length} variant(s) updated)`);

        }

        console.log('');

        

        // Export to JSON file

        const reportPath = path.join(__dirname, 'color_mismatch_report.json');

        const updatesReportPath = path.join(__dirname, 'color_updates_report.json');

        

        const report = {

          generatedAt: new Date().toISOString(),

          statistics,

          mismatches: mismatches.map(m => ({

            productId: m.productId,

            productName: m.productName,

            productSlug: m.productSlug,

            variantIndex: m.variantIndex,

            colorName: m.colorName,

            colorCode: m.colorCode,

            issue: m.issue,

            expectedColorCode: m.expectedColorCode,

            severity: m.severity,

          }))

        };

        

        const updatesReport = {

          generatedAt: new Date().toISOString(),

          totalUpdates: updates.length,

          updates: updates.map(u => ({

            productId: u.productId,

            productName: u.productName,

            productSlug: u.productSlug,

            variantIndex: u.variantIndex,

            colorName: u.colorName,

            oldColorCode: u.oldColorCode,

            newColorCode: u.newColorCode,

            issue: u.issue,

          })),

          statistics: {

            productsUpdated: Object.keys(updatesByProduct).length,

            variantsUpdated: updates.length,

          }

        };

        

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        fs.writeFileSync(updatesReportPath, JSON.stringify(updatesReport, null, 2));

        console.log(`💾 Mismatch report saved to: ${reportPath}`);

        console.log(`💾 Updates report saved to: ${updatesReportPath}`);

        console.log('');

      } else {

        console.log('⚠️  No high severity mismatches to fix (or no expected color codes available)');

        console.log('');

        

        // Export mismatch report only

        const reportPath = path.join(__dirname, 'color_mismatch_report.json');

        const report = {

          generatedAt: new Date().toISOString(),

          statistics,

          mismatches: mismatches.map(m => ({

            productId: m.productId,

            productName: m.productName,

            productSlug: m.productSlug,

            variantIndex: m.variantIndex,

            colorName: m.colorName,

            colorCode: m.colorCode,

            issue: m.issue,

            expectedColorCode: m.expectedColorCode,

            severity: m.severity,

          }))

        };

        

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log(`💾 Detailed report saved to: ${reportPath}`);

        console.log('');

      }

    } else {

      console.log('✅ No color mismatches found! All color names match their color codes.');

      console.log('');

    }

    

    // Close database connection

    await mongoose.connection.close();

    console.log('✅ Database connection closed');

    

  } catch (error) {

    console.error('❌ Error checking/fixing color mismatches:', error);

    process.exit(1);

  }

};



// Run the script

checkColorMismatches();




