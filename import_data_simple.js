const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://myoxtbrgeudmsnjenmpb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15b3h0YnJnZXVkbXNuamVubXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU5MzMxOSwiZXhwIjoyMDkwMTY5MzE5fQ.sRxtOQbhSdNK2EhxwtcNr7_SU3aYqRMSLVPT9o4yzDk'
);

const rawEvents = JSON.parse(fs.readFileSync('/Users/aj/calendar_events_raw.json', 'utf8'));
console.log(`Found ${rawEvents.length} events`);

async function importData() {
  let success = 0;
  let skipped = 0;

  for (const event of rawEvents) {
    if (!event.start?.dateTime || !event.end?.dateTime) {
      skipped++;
      continue;
    }

    const title = (event.summary || '').toLowerCase();
    if (title.includes('all hands') || title.includes('standup') || title.includes('sync')) {
      skipped++;
      continue;
    }

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
      client: null,
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
      console.error('Error:', event.id, error.message);
    } else {
      success++;
      if (success % 50 === 0) console.log(`Imported ${success}...`);
    }
  }

  console.log(`\nDone! Success: ${success}, Skipped: ${skipped}`);
}

importData();
