/**
 * Scheduled Cleanup Jobs
 * 
 * This module runs periodic cleanup tasks to maintain database efficiency.
 * Import and initialize in server.js to enable automated cleanup.
 */

import CheckoutSession from '../models/CheckoutSession.js';

/**
 * Cleanup completed checkout sessions
 * Removes redundant data from sessions that have been converted to orders
 */
export async function cleanupCompletedSessions() {
  try {
    const sessions = await CheckoutSession.find({
      status: 'completed',
      order: { $exists: true },
      items: { $exists: true, $ne: [] }
    }).limit(100); // Process in batches
    
    let cleanedCount = 0;
    
    for (const session of sessions) {
      try {
        await session.cleanupAfterOrder();
        cleanedCount++;
      } catch (error) {
        console.error(`[Cleanup] Error cleaning session ${session._id}:`, error.message);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Cleanup] Cleaned up ${cleanedCount} completed checkout sessions`);
    }
    
    return cleanedCount;
  } catch (error) {
    console.error('[Cleanup] Failed to cleanup sessions:', error);
    return 0;
  }
}

/**
 * Cleanup expired sessions
 * Manually remove expired sessions (backup to TTL index)
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await CheckoutSession.deleteMany({
      status: { $in: ['pending', 'failed', 'expired'] },
      expiresAt: { $lt: new Date() }
    });
    
    if (result.deletedCount > 0) {
      console.log(`[Cleanup] Deleted ${result.deletedCount} expired checkout sessions`);
    }
    
    return result.deletedCount;
  } catch (error) {
    console.error('[Cleanup] Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Initialize cleanup jobs
 * Call this function in server.js to start scheduled cleanup
 */
export function initializeCleanupJobs() {
  console.log('[Cleanup] Initializing scheduled cleanup jobs...');
  
  // Run completed session cleanup every hour
  setInterval(async () => {
    console.log('[Cleanup] Running scheduled cleanup of completed sessions...');
    await cleanupCompletedSessions();
  }, 60 * 60 * 1000); // 1 hour
  
  // Run expired session cleanup every 6 hours
  setInterval(async () => {
    console.log('[Cleanup] Running scheduled cleanup of expired sessions...');
    await cleanupExpiredSessions();
  }, 6 * 60 * 60 * 1000); // 6 hours
  
  // Run initial cleanup after 1 minute
  setTimeout(async () => {
    console.log('[Cleanup] Running initial cleanup...');
    await cleanupCompletedSessions();
    await cleanupExpiredSessions();
  }, 60 * 1000);
  
  console.log('[Cleanup] ✅ Cleanup jobs initialized');
  console.log('[Cleanup]   - Completed sessions: every 1 hour');
  console.log('[Cleanup]   - Expired sessions: every 6 hours');
}
