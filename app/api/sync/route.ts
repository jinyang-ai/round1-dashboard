import { NextRequest, NextResponse } from 'next/server';
import { fetchIncrementalChanges } from '@/lib/calendar';
import { getSyncState, saveSyncState, processIncrementalChanges, bulkUpsertInterviews } from '@/lib/db';

// GET for cron jobs
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  
  // In production, require CRON_SECRET to be configured
  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('CRON_SECRET not configured in production');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  
  // Verify auth if secret is set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return runSync(false);
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const forceFullSync = url.searchParams.get('full') === 'true';
  return runSync(forceFullSync);
}

async function runSync(forceFullSync: boolean) {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'round1@grapevine.in';
    
    // Get current sync state
    const syncState = await getSyncState();
    const currentSyncToken = forceFullSync ? null : syncState?.sync_token;
    
    console.log(`Syncing calendar (${currentSyncToken ? 'incremental' : 'full'})...`);
    
    // Fetch changes
    const { events, nextSyncToken, fullSync } = await fetchIncrementalChanges(
      calendarId,
      currentSyncToken
    );
    
    console.log(`Fetched ${events.length} events (${fullSync ? 'full sync' : 'incremental'})`);
    
    let result;
    if (fullSync) {
      // Full sync - bulk upsert all events
      result = await bulkUpsertInterviews(events);
    } else {
      // Incremental - process changes including deletes
      const changes = await processIncrementalChanges(events);
      result = {
        success: changes.added + changes.updated,
        skipped: changes.skipped,
        errors: 0,
        deleted: changes.deleted,
        added: changes.added,
        updated: changes.updated,
      };
    }
    
    // Save new sync token
    await saveSyncState({
      sync_token: nextSyncToken,
      last_synced_at: new Date().toISOString(),
    });
    
    console.log('Sync complete:', result);
    
    return NextResponse.json({
      ok: true,
      fullSync,
      total: events.length,
      ...result,
      syncToken: nextSyncToken ? 'saved' : 'none',
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', message: error.message },
      { status: 500 }
    );
  }
}
