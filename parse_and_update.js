// Script to parse calendar events and update Supabase with client/role/candidate info
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://myoxtbrgeudmsnjenmpb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15b3h0YnJnZXVkbXNuamVubXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU5MzMxOSwiZXhwIjoyMDkwMTY5MzE5fQ.sRxtOQbhSdNK2EhxwtcNr7_SU3aYqRMSLVPT9o4yzDk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Known company patterns (domain -> company name)
const COMPANY_PATTERNS = {
  'sarvam.ai': 'Sarvam AI',
  'superliving.ai': 'Superliving AI',
  'waterlabs.ai': 'Waterlabs AI',
  'thesparkle.ai': 'TrustAnchor',
  'chroniclehq.com': 'ChronicleHQ',
  'coderabbit.ai': 'CodeRabbit',
  'metaforms.ai': 'Metaforms',
  'auquan.com': 'Auquan',
  'truefoundry.com': 'TrueFoundry',
  'trupeer.ai': 'Trupeer AI',
  'peoplegroup.co.in': 'People Group',
  'shaadi.com': 'Shaadi.com',
  'rebelfoods.com': 'Rebel Foods',
  'kiagentic.com': 'Kiagentic',
  'zilo.io': 'Zilo',
  'getzoop.today': 'Zoop',
  'enterpret.com': 'Enterpret',
  'fam.app': 'Fam',
  'grapeshot.co': 'Grapeshot',
  'razorpay.com': 'Razorpay',
  'zepto.co': 'Zepto',
  'cred.club': 'CRED',
  'zeta.tech': 'Zeta',
  'postman.com': 'Postman',
  'flipkart.com': 'Flipkart',
  'swiggy.in': 'Swiggy',
  'meesho.com': 'Meesho',
  'groww.in': 'Groww',
  'dream11.com': 'Dream11',
  'phonepe.com': 'PhonePe',
  'paytm.com': 'Paytm',
  'uber.com': 'Uber',
  'ola.com': 'Ola',
  'byju.com': 'BYJU\'S',
  'unacademy.com': 'Unacademy',
  'vedantu.com': 'Vedantu',
  'licious.in': 'Licious',
  'urbancompany.com': 'Urban Company',
  'nykaa.com': 'Nykaa',
  'dunzo.in': 'Dunzo',
  'makemytrip.com': 'MakeMyTrip',
  'oyo.com': 'OYO',
  'cars24.com': 'CARS24',
  'spinny.com': 'Spinny',
  'healthkart.com': 'HealthKart',
  'pharmeasy.in': 'PharmEasy',
  'practo.com': 'Practo',
  '1mg.com': '1mg',
  'lendingkart.com': 'Lendingkart',
  'slice.one': 'Slice',
  'jupiter.money': 'Jupiter',
  'fi.money': 'Fi Money',
  'smallcase.com': 'Smallcase',
  'paisa.com': 'Paisa',
  'assetplus.in': 'AssetPlus',
};

// Role patterns
const ROLE_PATTERNS = {
  'Frontend Engineer': /frontend|front-end|fe engineer|react engineer|vue engineer|angular engineer/i,
  'Backend Engineer': /backend|back-end|be engineer|node engineer|python engineer|java engineer|golang engineer/i,
  'Full Stack Engineer': /full[- ]?stack|fullstack/i,
  'AI/ML Engineer': /\bai\b|machine learning|ml engineer|llm|nlp|deep learning|ai engineer|ml |ai\/ml/i,
  'Data Engineer': /data engineer|data pipeline|etl engineer/i,
  'Data Scientist': /data scientist|data science/i,
  'DevOps Engineer': /devops|sre|site reliability|platform engineer/i,
  'Product Manager': /product manager|pm interview|apm |associate product/i,
  'Engineering Manager': /engineering manager|em interview|tech manager/i,
  'Tech Lead': /tech lead|technical lead|tl interview|lead engineer/i,
  'VP Engineering': /vp engineering|vpe|vice president.*eng/i,
  'CTO': /\bcto\b|chief technology/i,
  'Product Designer': /product design|designer|ui\/ux|ux design|visual design/i,
  'QA Engineer': /\bqa\b|quality assurance|test engineer|sdet|automation engineer/i,
  'Security Engineer': /security engineer|infosec|appsec|security/i,
  'Mobile Engineer': /mobile engineer|ios engineer|android engineer|react native/i,
  'Solutions Engineer': /solutions engineer|customer engineer|implementation/i,
  'Software Engineer': /software engineer|sde|swe/i,
};

function parseClientFromSummary(summary) {
  if (!summary) return null;
  
  // Common title patterns: "Company Role Interview (Candidate)"
  // Extract company name before role keywords
  
  // Try to match known company names first
  for (const [domain, company] of Object.entries(COMPANY_PATTERNS)) {
    const companyLower = company.toLowerCase().replace(/[^a-z0-9]/g, '');
    const summaryLower = summary.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (summaryLower.includes(companyLower)) {
      return company;
    }
  }
  
  // Try to extract from title structure
  // Pattern: "CompanyName RoleName Interview (CandidateName)"
  const match = summary.match(/^([A-Za-z0-9\s\.]+?)\s+(Frontend|Backend|Full[- ]?Stack|AI|ML|Data|DevOps|Product|Engineering|Tech|Software|Mobile|QA|Security|VP|CTO)/i);
  if (match) {
    let company = match[1].trim();
    // Clean up common suffixes
    company = company.replace(/\s*(AI|Labs|Tech|Technologies|Inc|Ltd|Pvt|Private|Limited)$/i, '$1').trim();
    if (company.length > 2 && company.length < 50) {
      return company;
    }
  }
  
  return null;
}

function parseClientFromAttendees(attendees) {
  if (!attendees || !Array.isArray(attendees)) return null;
  
  for (const attendee of attendees) {
    const email = (attendee.email || '').toLowerCase();
    
    // Skip organizer and candidate emails
    if (email === 'round1@grapevine.in') continue;
    if (email.includes('gmail.com') || email.includes('yahoo.com') || email.includes('outlook.com') || email.includes('hotmail.com')) continue;
    
    // Extract domain
    const domain = email.split('@')[1];
    if (domain && COMPANY_PATTERNS[domain]) {
      return COMPANY_PATTERNS[domain];
    }
  }
  
  return null;
}

function parseRole(summary) {
  if (!summary) return null;
  
  // Check each role pattern
  for (const [role, pattern] of Object.entries(ROLE_PATTERNS)) {
    if (pattern.test(summary)) {
      return role;
    }
  }
  
  // Default to Software Engineer if "Interview" is in title but no specific role
  if (/interview/i.test(summary)) {
    return 'Software Engineer';
  }
  
  return null;
}

function parseCandidate(summary) {
  if (!summary) return null;
  
  // Try to extract from parentheses: "... Interview (Candidate Name)"
  const parenMatch = summary.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const candidate = parenMatch[1].trim();
    // Verify it looks like a name (not technical details)
    if (candidate.length > 2 && candidate.length < 50 && !/round|r\d|interview/i.test(candidate)) {
      return candidate;
    }
  }
  
  // Try "with Name" pattern
  const withMatch = summary.match(/with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
  if (withMatch) {
    return withMatch[1].trim();
  }
  
  return null;
}

async function parseAndUpdateAll() {
  console.log('Fetching interviews from Supabase...');
  
  // Fetch all interviews
  const { data: interviews, error } = await supabase
    .from('interviews')
    .select('*')
    .order('start_time', { ascending: false });
  
  if (error) {
    console.error('Error fetching interviews:', error);
    return;
  }
  
  console.log(`Found ${interviews.length} interviews`);
  
  // Load raw calendar data for attendee info
  let rawEvents = [];
  try {
    const rawData = fs.readFileSync('/Users/aj/calendar_events_raw.json', 'utf8');
    rawEvents = JSON.parse(rawData);
    console.log(`Loaded ${rawEvents.length} raw calendar events`);
  } catch (e) {
    console.log('Could not load raw calendar data, will use summary only');
  }
  
  // Create a map of event id to raw event
  const rawEventMap = new Map();
  for (const event of rawEvents) {
    rawEventMap.set(event.id, event);
  }
  
  let updated = 0;
  let skipped = 0;
  const clientCounts = {};
  const roleCounts = {};
  
  for (const interview of interviews) {
    const rawEvent = rawEventMap.get(interview.calendar_event_id);
    const summary = interview.title;
    
    // Parse client
    let client = parseClientFromSummary(summary);
    if (!client && rawEvent) {
      client = parseClientFromAttendees(rawEvent.attendees);
    }
    
    // Parse role
    const role = parseRole(summary);
    
    // Parse candidate
    const candidate = parseCandidate(summary);
    
    // Track stats
    if (client) {
      clientCounts[client] = (clientCounts[client] || 0) + 1;
    }
    if (role) {
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }
    
    // Update if we have any new data
    if (client || role || candidate) {
      // Use the correct column names: client, role_type, candidate_name
      const updateData = {};
      if (client) updateData.client = client;
      if (role) updateData.role_type = role;
      if (candidate) updateData.candidate_name = candidate;
      
      const { error: updateError } = await supabase
        .from('interviews')
        .update(updateData)
        .eq('id', interview.id);
      
      if (updateError) {
        console.error(`Error updating interview ${interview.id}:`, updateError);
      } else {
        updated++;
        if (updated <= 10) {
          console.log(`Updated: "${summary}" -> Client: ${client || 'null'}, Role: ${role || 'null'}, Candidate: ${candidate || 'null'}`);
        }
      }
    } else {
      skipped++;
      if (skipped <= 5) {
        console.log(`Skipped (no data extracted): "${summary}"`);
      }
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total interviews: ${interviews.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  
  console.log('\n=== Clients ===');
  const sortedClients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]);
  for (const [client, count] of sortedClients.slice(0, 20)) {
    console.log(`  ${client}: ${count}`);
  }
  
  console.log('\n=== Roles ===');
  const sortedRoles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]);
  for (const [role, count] of sortedRoles) {
    console.log(`  ${role}: ${count}`);
  }
}

parseAndUpdateAll().catch(console.error);
