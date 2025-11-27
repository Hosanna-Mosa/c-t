#!/usr/bin/env node

/**
 * Migrate Orders to Design Snapshots
 * 
 * This script migrates existing orders with inline design data to use
 * the new optimized design snapshot system.
 * 
 * Usage:
 *   node scripts/migrate-orders-to-snapshots.js
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --limit N    Process only N orders (default: all)
 */

import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import Design from '../src/models/Design.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createDesignSnapshotFromCartItem, 
  createOptimizedCustomDesign 
} from '../src/services/designSnapshot.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = process.argv.includes('--limit') 
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) 
  : null;

async function migrateOrders() {
  try {
    console.log('📦 Migrate Orders to Design Snapshots');
    console.log('=====================================\n');
    
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
    
    // Find orders with inline design data (old format)
    // Look for items where customDesign exists but designSnapshotId does not
    const query = {
      'items.customDesign': { $exists: true },
      'items.customDesign.designSnapshotId': { $exists: false },
      // Ensure it actually has design data
      $or: [
        { 'items.customDesign.frontDesign.designData': { $exists: true } },
        { 'items.customDesign.backDesign.designData': { $exists: true } }
      ]
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
    
    for (const order of orders) {
      try {
        let orderUpdated = false;
        let orderSavedBytes = 0;
        
        for (const item of order.items) {
          // Check if item needs migration
          if (item.customDesign && 
              !item.customDesign.designSnapshotId && 
              (item.customDesign.frontDesign?.designData || item.customDesign.backDesign?.designData)) {
            
            const sizeBefore = JSON.stringify(item.customDesign).length;
            
            if (!DRY_RUN) {
              // Reconstruct cart item for snapshot creation
              const mockCartItem = {
                productId: item.product,
                productName: item.productName,
                selectedColor: item.selectedColor,
                selectedSize: item.selectedSize,
                frontDesign: item.customDesign.frontDesign,
                backDesign: item.customDesign.backDesign,
                basePrice: 0,
                frontCustomizationCost: 0,
                backCustomizationCost: 0,
                totalPrice: item.price
              };
              
              // Create snapshot
              const snapshot = await createDesignSnapshotFromCartItem(
                mockCartItem,
                order._id.toString(),
                order.user
              );
              
              if (snapshot) {
                // Update item with optimized data
                item.customDesign = createOptimizedCustomDesign(mockCartItem, snapshot);
                orderUpdated = true;
                
                const sizeAfter = JSON.stringify(item.customDesign).length;
                orderSavedBytes += (sizeBefore - sizeAfter);
              }
            } else {
              // Estimate savings
              const estimatedSizeAfter = 500; // Approx size of optimized object
              orderSavedBytes += (sizeBefore - estimatedSizeAfter);
              orderUpdated = true;
            }
          }
        }
        
        if (orderUpdated) {
          if (!DRY_RUN) {
            await order.save();
            console.log(`✅ Migrated order ${order._id} (Saved: ${formatBytes(orderSavedBytes)})`);
          } else {
            console.log(`[DRY RUN] Would migrate order ${order._id} (Est. Savings: ${formatBytes(orderSavedBytes)})`);
          }
          migratedCount++;
          totalSavedBytes += orderSavedBytes;
        }
        
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
migrateOrders();
