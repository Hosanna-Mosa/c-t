#!/usr/bin/env node

/**
 * Migrate Tracking History
 * 
 * This script moves tracking history from Order documents to the new
 * TrackingHistory collection to reduce Order document size.
 * 
 * Usage:
 *   node scripts/migrate-tracking-history.js
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --limit N    Process only N orders (default: all)
 */

import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import TrackingHistory from '../src/models/TrackingHistory.js';
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

async function migrateTrackingHistory() {
  try {
    console.log('🚚 Migrate Tracking History');
    console.log('=========================\n');
    
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
    
    // Find orders with trackingHistory (and not empty)
    const query = {
      'trackingHistory.0': { $exists: true }
    };
    
    let ordersToMigrate = Order.find(query);
    
    if (LIMIT) {
      ordersToMigrate = ordersToMigrate.limit(LIMIT);
    }
    
    const orders = await ordersToMigrate;
    
    console.log(`Found ${orders.length} orders with tracking history\n`);
    
    if (orders.length === 0) {
      console.log('✨ No orders need migration!\n');
      return;
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    let totalSavedBytes = 0;
    
    for (const order of orders) {
      try {
        const historySize = JSON.stringify(order.trackingHistory).length;
        
        if (!DRY_RUN) {
          // Create TrackingHistory document
          await TrackingHistory.findOneAndUpdate(
            { order: order._id },
            {
              order: order._id,
              trackingNumber: order.trackingNumber || 'UNKNOWN',
              events: order.trackingHistory,
              lastSyncAt: new Date()
            },
            { upsert: true, new: true }
          );
          
          // Remove from Order
          await Order.updateOne(
            { _id: order._id },
            { $unset: { trackingHistory: 1 } }
          );
          
          console.log(`✅ Migrated history for order ${order._id} (Saved: ${formatBytes(historySize)})`);
        } else {
          console.log(`[DRY RUN] Would migrate history for order ${order._id} (Est. Savings: ${formatBytes(historySize)})`);
        }
        
        migratedCount++;
        totalSavedBytes += historySize;
        
      } catch (error) {
        console.error(`❌ Error migrating order ${order._id}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Orders processed: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total storage saved: ${formatBytes(totalSavedBytes)}`);
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
migrateTrackingHistory();
