import { google } from 'googleapis';

// Initialize Google Calendar client
export function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost'
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
