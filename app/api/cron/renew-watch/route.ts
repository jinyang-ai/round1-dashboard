import { NextRequest, NextResponse } from 'next/server';
import { setupCalendarWatch, stopCalendarWatch } from '@/lib/calendar';
import { getSyncState, saveWatchInfo } from '@/lib/db';

// Vercel Cron handler - runs daily to check and renew watch if needed
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for Vercel Cron Jobs (optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'round1@grapevine.in';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    
    if (!siteUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SITE_URL not configured' },
        { status: 500 }
      );
    }

    const webhookUrl = `${siteUrl}/api/webhook`;

    // Get current sync state to check watch expiration
    const syncState = await getSyncState();
    
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Check if watch exists and if it's expiring within 24 hours
    let needsRenewal = true;
    let reason = 'No existing watch found';
    
    if (syncState?.watch_expiration) {
      const expiration = new Date(syncState.watch_expiration);
      
      if (expiration > twentyFourHoursFromNow) {
        // Watch is still valid for more than 24 hours
        return NextResponse.json({
          success: true,
          action: 'skipped',
          reason: 'Watch still valid',
          expiration: syncState.watch_expiration,
          expiresIn: Math.round((expiration.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours',
        });
      }
      
      reason = `Watch expiring soon (${syncState.watch_expiration})`;
      
      // Try to stop the old watch before creating a new one
      if (syncState.watch_channel_id && syncState.watch_resource_id) {
        try {
          await stopCalendarWatch(syncState.watch_channel_id, syncState.watch_resource_id);
          console.log('Stopped old watch:', syncState.watch_channel_id);
        } catch (stopError: any) {
          // Ignore errors stopping old watch - it might already be expired
          console.log('Could not stop old watch (may already be expired):', stopError.message);
        }
      }
    }

    // Set up a new watch
    console.log('Setting up new calendar watch...');
    const watchInfo = await setupCalendarWatch(calendarId, webhookUrl);
    console.log('Watch setup complete:', watchInfo);

    // Save the new watch info
    await saveWatchInfo(
      watchInfo.channelId,
      watchInfo.resourceId!,
      watchInfo.expiration
    );

    return NextResponse.json({
      success: true,
      action: 'renewed',
      reason,
      channelId: watchInfo.channelId,
      expiration: watchInfo.expiration.toISOString(),
      expiresIn: Math.round((watchInfo.expiration.getTime() - now.getTime()) / (1000 * 60 * 60)) + ' hours',
    });
  } catch (error: any) {
    console.error('Cron renew-watch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to renew watch', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
