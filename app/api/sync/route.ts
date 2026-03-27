import { NextRequest, NextResponse } from 'next/server';
import { fetchCalendarEvents } from '@/lib/calendar';
import { bulkUpsertInterviews } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // TODO: Add authorization back later
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.JWT_SECRET}`) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'round1@grapevine.in';
    
    // Fetch last 7 months of events
    const now = new Date();
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(now.getMonth() - 7);
    
    console.log('Fetching calendar events...');
    const events = await fetchCalendarEvents(calendarId, sevenMonthsAgo, now);
    console.log(`Fetched ${events.length} events`);
    
    // Bulk upsert to database
    console.log('Syncing to database...');
    const result = await bulkUpsertInterviews(events);
    console.log('Sync complete:', result);
    
    return NextResponse.json({
      success: true,
      total: events.length,
      synced: result.success,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', message: error.message },
      { status: 500 }
    );
  }
}
