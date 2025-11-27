#!/usr/bin/env node

/**
 * Cleanup Completed CheckoutSessions
 * 
 * This script removes redundant data from completed checkout sessions
 * to reduce database storage. Run this after deploying the cleanup method.
 * 
 * Usage:
 *   node scripts/cleanup-completed-sessions.js
 * 
 * Options:
 *   --dry-run    Show what would be cleaned without making changes
 *   --limit N    Process only N sessions (default: all)
 */

import mongoose from 'mongoose';
import CheckoutSession from '../src/models/CheckoutSession.js';
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

async function cleanupCompletedSessions() {
  try {
    console.log('🧹 Cleanup Completed CheckoutSessions');
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
    
    // Find completed sessions that still have items (not cleaned up)
    const query = {
      status: 'completed',
      order: { $exists: true },
      items: { $exists: true, $ne: [] }
    };
    
    let sessionsToCleanup = CheckoutSession.find(query);
    
    if (LIMIT) {
      sessionsToCleanup = sessionsToCleanup.limit(LIMIT);
    }
    
    const sessions = await sessionsToCleanup;
    
    console.log(`Found ${sessions.length} completed sessions with redundant data\n`);
    
    if (sessions.length === 0) {
      console.log('✨ No sessions need cleanup!\n');
      return;
    }
    
    // Calculate storage before cleanup
    let totalSizeBefore = 0;
    let totalSizeAfter = 0;
    let cleanedCount = 0;
    let errorCount = 0;
    
    for (const session of sessions) {
      try {
        const sizeBefore = JSON.stringify(session.toObject()).length;
        totalSizeBefore += sizeBefore;
        
        if (!DRY_RUN) {
          await session.cleanupAfterOrder();
          
          // Reload to get actual size after cleanup
          const cleanedSession = await CheckoutSession.findById(session._id);
          const sizeAfter = JSON.stringify(cleanedSession.toObject()).length;
          totalSizeAfter += sizeAfter;
          
          const reduction = ((sizeBefore - sizeAfter) / sizeBefore * 100).toFixed(1);
          console.log(`✅ Cleaned session ${session._id}: ${formatBytes(sizeBefore)} → ${formatBytes(sizeAfter)} (${reduction}% reduction)`);
        } else {
          // Estimate size after cleanup (remove items and address)
          const estimatedSizeAfter = sizeBefore * 0.05; // ~95% reduction
          totalSizeAfter += estimatedSizeAfter;
          
          const reduction = ((sizeBefore - estimatedSizeAfter) / sizeBefore * 100).toFixed(1);
          console.log(`[DRY RUN] Would clean session ${session._id}: ${formatBytes(sizeBefore)} → ${formatBytes(estimatedSizeAfter)} (${reduction}% reduction)`);
        }
        
        cleanedCount++;
      } catch (error) {
        console.error(`❌ Error cleaning session ${session._id}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Cleanup Summary');
    console.log('='.repeat(60));
    console.log(`Sessions processed: ${cleanedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total size before: ${formatBytes(totalSizeBefore)}`);
    console.log(`Total size after: ${formatBytes(totalSizeAfter)}`);
    console.log(`Total saved: ${formatBytes(totalSizeBefore - totalSizeAfter)}`);
    console.log(`Average reduction: ${((totalSizeBefore - totalSizeAfter) / totalSizeBefore * 100).toFixed(1)}%`);
    console.log('='.repeat(60) + '\n');
    
    if (DRY_RUN) {
      console.log('💡 Run without --dry-run to apply changes\n');
    } else {
      console.log('✨ Cleanup complete!\n');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
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

// Run cleanup
cleanupCompletedSessions();
