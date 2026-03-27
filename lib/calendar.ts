import { google } from 'googleapis';

// Initialize Google Calendar client
export function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost'
  );
  
  // Set credentials from environment variables
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  return { calendar, oauth2Client };
}

// Fetch events from Google Calendar
export async function fetchCalendarEvents(
  calendarId: string,
  timeMin?: Date,
  timeMax?: Date
) {
  const { calendar } = getCalendarClient();
  
  const params: any = {
    calendarId,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 2500,
  };
  
  if (timeMin) {
    params.timeMin = timeMin.toISOString();
  }
  
  if (timeMax) {
    params.timeMax = timeMax.toISOString();
  }
  
  const allEvents: any[] = [];
  let pageToken: string | undefined;
  
  do {
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    allEvents.push(...events);
    
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  
  return allEvents;
}

// Set up a webhook watch for calendar changes
export async function setupCalendarWatch(
  calendarId: string,
  webhookUrl: string
) {
  const { calendar } = getCalendarClient();
  
  const channelId = `round1-dashboard-${Date.now()}`;
  const expiration = Date.now() + (3 * 24 * 60 * 60 * 1000); // 3 days
  
  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      expiration: expiration.toString(),
    },
  });
  
  return {
    channelId,
    resourceId: response.data.resourceId,
    expiration: new Date(parseInt(response.data.expiration || '0')),
  };
}

// Stop a webhook watch
export async function stopCalendarWatch(
  channelId: string,
  resourceId: string
) {
  const { calendar } = getCalendarClient();
  
  await calendar.channels.stop({
    requestBody: {
      id: channelId,
      resourceId,
    },
  });
}

// Fetch a single event by ID
export async function fetchEventById(
  calendarId: string,
  eventId: string
) {
  const { calendar } = getCalendarClient();
  
  try {
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });
    return response.data;
  } catch (error: any) {
    if (error.code === 404) {
      return null; // Event deleted
    }
    throw error;
  }
}

// Incremental sync - fetch only changed events since last sync
export async function fetchIncrementalChanges(
  calendarId: string,
  syncToken?: string | null
): Promise<{ events: any[]; nextSyncToken: string; fullSync: boolean }> {
  const { calendar } = getCalendarClient();
  
  // If no sync token, do a full sync
  // NOTE: To get a nextSyncToken from Google Calendar API:
  // - Cannot use timeMax
  // - Cannot use orderBy
  // - Cannot use singleEvents: true with timeMin/timeMax
  // We do an unbounded query to get the sync token
  if (!syncToken) {
    const allEvents: any[] = [];
    let pageToken: string | undefined;
    let nextSyncToken = '';
    
    do {
      const response = await calendar.events.list({
        calendarId,
        maxResults: 2500,
        pageToken,
        // No timeMin/timeMax/orderBy/singleEvents - required for sync token
      });
      
      allEvents.push(...(response.data.items || []));
      pageToken = response.data.nextPageToken || undefined;
      // Only capture nextSyncToken from the final page (when no more pageToken)
      if (response.data.nextSyncToken) {
        nextSyncToken = response.data.nextSyncToken;
      }
    } while (pageToken);
    
    // Filter to relevant events (confirmed status, within reasonable time range)
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const filteredEvents = allEvents.filter(event => {
      // Skip cancelled events
      if (event.status === 'cancelled') return false;
      // Check if event has a start date
      const startDate = event.start?.dateTime || event.start?.date;
      if (!startDate) return false;
      const eventDate = new Date(startDate);
      // Only include events from last 7 months onwards
      return eventDate >= sevenMonthsAgo;
    });
    
    return { events: filteredEvents, nextSyncToken, fullSync: true };
  }
  
  // Incremental sync with token
  try {
    const allEvents: any[] = [];
    let pageToken: string | undefined;
    let nextSyncToken = '';
    let currentSyncToken: string | undefined = syncToken;
    
    do {
      const params: any = {
        calendarId,
        maxResults: 2500,
      };
      
      if (pageToken) {
        params.pageToken = pageToken;
      } else if (currentSyncToken) {
        params.syncToken = currentSyncToken;
        currentSyncToken = undefined; // Only use on first request
      }
      
      const response = await calendar.events.list(params);
      allEvents.push(...(response.data.items || []));
      pageToken = response.data.nextPageToken || undefined;
      // Only capture nextSyncToken from the final page (when no more pageToken)
      if (response.data.nextSyncToken) {
        nextSyncToken = response.data.nextSyncToken;
      }
    } while (pageToken);
    
    return { events: allEvents, nextSyncToken, fullSync: false };
  } catch (error: any) {
    // If sync token is invalid/expired, do a full sync
    if (error.code === 410) {
      console.log('Sync token expired, doing full sync...');
      return fetchIncrementalChanges(calendarId, null);
    }
    throw error;
  }
}
