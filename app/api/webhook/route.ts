import { NextRequest, NextResponse } from 'next/server';
import { fetchIncrementalChanges } from '@/lib/calendar';
import { getSyncState, saveSyncState, processIncrementalChanges } from '@/lib/db';

// Store for SSE clients (in-memory, will be replaced with proper pub/sub in production)
const sseClients = new Set<ReadableStreamDefaultController>();

export function addSSEClient(controller: ReadableStreamDefaultController) {
  sseClients.add(controller);
}

export function removeSSEClient(controller: ReadableStreamDefaultController) {
  sseClients.delete(controller);
}

function broadcastToClients(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(controller => {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (e) {
      // Client disconnected
      sseClients.delete(controller);
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    // Google sends a sync notification
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceState = request.headers.get('x-goog-resource-state');
    
    console.log('Webhook received:', { channelId, resourceState });
    
    // If it's a sync message (initial handshake), just acknowledge
    if (resourceState === 'sync') {
      return NextResponse.json({ success: true, type: 'handshake' });
    }
    
    // Use incremental sync with sync token
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'round1@grapevine.in';
    
    // Get current sync state
    const syncState = await getSyncState();
    
    // Fetch incremental changes
    const { events, nextSyncToken, fullSync } = await fetchIncrementalChanges(
      calendarId,
      syncState?.sync_token
    );
    
    console.log(`Webhook: fetched ${events.length} changes (${fullSync ? 'full' : 'incremental'})`);
    
    if (events.length === 0) {
      return NextResponse.json({ success: true, changes: 0 });
    }
    
    // Process changes
    const result = await processIncrementalChanges(events);
    
    // Save new sync token
    await saveSyncState({
      sync_token: nextSyncToken,
      last_synced_at: new Date().toISOString(),
    });
    
    console.log('Webhook sync result:', result);
    
    // Broadcast to SSE clients if there were actual changes
    if (result.added > 0 || result.updated > 0 || result.deleted > 0) {
      // Get details of changed events for the notification
      const changedEvents = events
        .filter(e => e.status !== 'cancelled')
        .slice(0, 5)
        .map(e => ({
          title: e.summary,
          start: e.start?.dateTime || e.start?.date,
        }));
      
      broadcastToClients({
        type: 'sync',
        added: result.added,
        updated: result.updated,
        deleted: result.deleted,
        events: changedEvents,
        timestamp: new Date().toISOString(),
      });
    }
    
    return NextResponse.json({
      success: true,
      ...result,
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
