#!/usr/bin/env node

/**
 * Migrate Design Cleanup
 * 
 * This script removes redundant fields (productName, productSlug, totalPrice)
 * from existing Design documents.
 * 
 * Usage:
 *   node scripts/migrate-design-cleanup.js
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --limit N    Process only N designs (default: all)
 */

import mongoose from 'mongoose';
import Design from '../src/models/Design.js';
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

async function migrateDesignCleanup() {
  try {
    console.log('🎨 Migrate Design Cleanup');
    console.log('=======================\n');
    
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
    
    // Find designs with redundant fields
    const query = {
      $or: [
        { productName: { $exists: true } },
        { productSlug: { $exists: true } },
        { totalPrice: { $exists: true } }
      ]
    };
    
    if (!DRY_RUN) {
      const result = await Design.updateMany(
        query,
        { 
          $unset: { 
            productName: 1, 
            productSlug: 1, 
            totalPrice: 1 
          } 
        }
      );
      
      console.log(`✅ Cleaned up ${result.modifiedCount} design documents`);
    } else {
      const count = await Design.countDocuments(query);
      console.log(`[DRY RUN] Would clean up ${count} design documents`);
    }
    
    console.log('\n✨ Cleanup complete!\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run migration
migrateDesignCleanup();
