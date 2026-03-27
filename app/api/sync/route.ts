import { NextRequest, NextResponse } from 'next/server';
import { fetchIncrementalChanges } from '@/lib/calendar';
import { getSyncState, saveSyncState, processIncrementalChanges, bulkUpsertInterviews } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'round1@grapevine.in';
    
    // Check for force full sync parameter
    const url = new URL(request.url);
    const forceFullSync = url.searchParams.get('full') === 'true';
    
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
