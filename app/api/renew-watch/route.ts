import { NextRequest, NextResponse } from 'next/server';
import { setupCalendarWatch, stopCalendarWatch } from '@/lib/calendar';
import { getSyncState, saveWatchInfo } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Authorization is optional - check if JWT_SECRET is set and header is provided
    const authHeader = request.headers.get('authorization');
    if (process.env.JWT_SECRET && authHeader && authHeader !== `Bearer ${process.env.JWT_SECRET}`) {
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
    
    // Get current sync state to stop old watch if it exists
    const syncState = await getSyncState();
    
    if (syncState?.watch_channel_id && syncState?.watch_resource_id) {
      try {
        await stopCalendarWatch(syncState.watch_channel_id, syncState.watch_resource_id);
        console.log('Stopped old watch:', syncState.watch_channel_id);
      } catch (stopError: any) {
        // Ignore errors stopping old watch - it might already be expired
        console.log('Could not stop old watch:', stopError.message);
      }
    }
    
    console.log('Setting up calendar watch...');
    const watchInfo = await setupCalendarWatch(calendarId, webhookUrl);
    console.log('Watch setup complete:', watchInfo);
    
    // Save the new watch info to database
    await saveWatchInfo(
      watchInfo.channelId,
      watchInfo.resourceId!,
      watchInfo.expiration
    );
    
    return NextResponse.json({
      success: true,
      channelId: watchInfo.channelId,
      resourceId: watchInfo.resourceId,
      expiration: watchInfo.expiration.toISOString(),
      expiresIn: Math.round((watchInfo.expiration.getTime() - Date.now()) / (1000 * 60 * 60)) + ' hours',
    });
  } catch (error: any) {
    console.error('Renew watch error:', error);
    return NextResponse.json(
      { error: 'Failed to renew watch', message: error.message },
      { status: 500 }
    );
  }
}
