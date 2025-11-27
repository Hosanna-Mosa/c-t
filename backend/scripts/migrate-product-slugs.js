#!/usr/bin/env node

/**
 * Migrate Product Slugs
 * 
 * This script removes the unnecessary productSlug field from existing orders
 * to reduce storage size.
 * 
 * Usage:
 *   node scripts/migrate-product-slugs.js
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --limit N    Process only N orders (default: all)
 */

import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = process.argv.includes('--limit') 
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) 
  : null;

async function migrateProductSlugs() {
  try {
    console.log('🐌 Migrate Product Slugs');
    console.log('======================\n');
    
    if (DRY_RUN) {
      console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }
    
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');
    
    // Find orders with productSlug in items
    const query = {
      'items.productSlug': { $exists: true }
    };
    
    let ordersToMigrate = Order.find(query);
    
    if (LIMIT) {
      ordersToMigrate = ordersToMigrate.limit(LIMIT);
    }
    
    const orders = await ordersToMigrate;
    
    console.log(`Found ${orders.length} orders to migrate\n`);
    
    if (orders.length === 0) {
      console.log('✨ No orders need migration!\n');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    let totalSavedBytes = 0;
    
    // Use updateMany with $unset for efficiency
    if (!DRY_RUN) {
      const result = await Order.updateMany(
        { 'items.productSlug': { $exists: true } },
        { $unset: { 'items.$[].productSlug': 1 } }
      );
      
      console.log(`✅ Removed productSlug from ${result.modifiedCount} orders`);
      migratedCount = result.modifiedCount;
    } else {
      // Count how many would be updated
      const count = await Order.countDocuments({ 'items.productSlug': { $exists: true } });
      console.log(`[DRY RUN] Would remove productSlug from ${count} orders`);
      migratedCount = count;
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Orders processed: ${migratedCount}`);
    console.log('='.repeat(60) + '\n');
    
    if (DRY_RUN) {
      console.log('💡 Run without --dry-run to apply changes\n');
    } else {
      console.log('✨ Migration complete!\n');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Run migration
migrateProductSlugs();
