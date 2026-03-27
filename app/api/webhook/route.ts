import { NextRequest, NextResponse } from 'next/server';
import { fetchEventById } from '@/lib/calendar';
import { upsertInterview } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Google sends a sync notification
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceState = request.headers.get('x-goog-resource-state');
    
    console.log('Webhook received:', { channelId, resourceState });
    
    // If it's a sync message (initial handshake), just acknowledge
    if (resourceState === 'sync') {
      return NextResponse.json({ success: true });
    }
    
    // For exists/update/not_exists states, we need to fetch the changed events
    // Since Google doesn't tell us which specific event changed, we fetch recent events
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'round1@grapevine.in';
    
    // Fetch events from the last 24 hours (to catch recent changes)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { fetchCalendarEvents } = await import('@/lib/calendar');
    const events = await fetchCalendarEvents(calendarId, yesterday, now);
    
    // Upsert these events
    const { bulkUpsertInterviews } = await import('@/lib/db');
    const result = await bulkUpsertInterviews(events);
    
    console.log('Webhook sync result:', result);
    
    return NextResponse.json({
      success: true,
      synced: result.success,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Goog-Channel-Id, X-Goog-Resource-State',
    },
  });
}
