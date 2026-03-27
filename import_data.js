const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Read the parsed calendar events
const rawEvents = JSON.parse(fs.readFileSync('/Users/aj/calendar_events_raw.json', 'utf8'));

console.log(`Found ${rawEvents.length} events`);

// Import the parser functions
const parser = require('./lib/parser.ts');

// Process each event
async function importData() {
  let success = 0;
  let skipped = 0;

  for (const event of rawEvents) {
    // Skip if no datetime
    if (!event.start?.dateTime || !event.end?.dateTime) {
      skipped++;
      continue;
    }

    // Skip if internal meeting
    const title = (event.summary || '').toLowerCase();
    if (title.includes('all hands') || title.includes('standup') || title.includes('sync')) {
      skipped++;
      continue;
    }

    // Skip cancelled
    if (event.status === 'cancelled') {
      skipped++;
      continue;
    }

    const startTime = event.start.dateTime;
    const endTime = event.end.dateTime;
    const startDate = new Date(startTime);

    const interview = {
      calendar_event_id: event.id,
      title: event.summary || 'Untitled',
      client: null, // We'll parse these manually
      role_type: null,
      candidate_name: null,
      start_time: startTime,
      end_time: endTime,
      duration_mins: Math.round((new Date(endTime) - new Date(startTime)) / (1000 * 60)),
      interviewers: [],
      interviewer_names: [],
      status: event.status || 'confirmed',
      month: startTime.slice(0, 7),
      day_of_week: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startDate.getDay()],
      hour: startDate.getHours(),
      raw_json: event,
    };

    const { error } = await supabase
      .from('interviews')
      .upsert(interview, { onConflict: 'calendar_event_id' });

    if (error) {
      console.error('Error inserting:', error);
    } else {
      success++;
    }
  }

  console.log(`Done! Success: ${success}, Skipped: ${skipped}`);
}

importData();
