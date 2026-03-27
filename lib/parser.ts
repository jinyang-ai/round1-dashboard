// Client and role parsing logic for calendar events

interface CalendarEvent {
  summary?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    optional?: boolean;
  }>;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

// Known interviewer patterns (email/domain -> client)
const INTERVIEWER_PATTERNS: Record<string, string> = {
  'vedant@sarvam.ai': 'Sarvam AI',
  'nitesh@sarvam.ai': 'Sarvam AI',
  'meenakshi@sarvam.ai': 'Sarvam AI',
  'ram@sarvam.ai': 'Sarvam AI',
  'sarvam.ai': 'Sarvam AI',
  'jaskirat': 'Superliving AI',
  'vishesh': 'Superliving AI',
  'superliving.ai': 'Superliving AI',
  'sravan': 'Waterlabs AI',
  'waterlabs.ai': 'Waterlabs AI',
  'pankaj@thesparkle.ai': 'TrustAnchor',
  'thesparkle.ai': 'TrustAnchor',
  'sam@chroniclehq.com': 'ChronicleHQ',
  'sameeksha': 'ChronicleHQ',
  'chroniclehq.com': 'ChronicleHQ',
  'coderabbit.ai': 'CodeRabbit',
  'metaforms.ai': 'Metaforms',
  'auquan.com': 'Auquan',
  'truefoundry.com': 'TrueFoundry',
  'trupeer.ai': 'Trupeer AI',
  'peoplegroup.co.in': 'People Group',
  'shaadi.com': 'Shaadi.com',
  'rebelfoods.com': 'Rebel Foods',
  'kiagentic': 'Kiagentic',
  'zilo.io': 'Zilo',
  'getzoop.today': 'Zoop',
  'enterpret.com': 'Enterpret',
  'fam.app': 'Fam',
  'toystack.ai': 'Toystack AI',
  'naav.ai': 'Naav AI',
};

// Title patterns for client extraction
const TITLE_CLIENT_PATTERNS: Array<[RegExp, string]> = [
  [/sarvam\s*ai/i, 'Sarvam AI'],
  [/\bsarvam\b/i, 'Sarvam AI'],
  [/superliving\s*ai/i, 'Superliving AI'],
  [/\bsuperliving\b/i, 'Superliving AI'],
  [/waterlabs\s*ai/i, 'Waterlabs AI'],
  [/\bwaterlabs\b/i, 'Waterlabs AI'],
  [/toystack\s*ai/i, 'Toystack AI'],
  [/\btoystack\b/i, 'Toystack AI'],
  [/naav\s*ai/i, 'Naav AI'],
  [/\bnaav\b/i, 'Naav AI'],
  [/trustanchor/i, 'TrustAnchor'],
  [/chroniclehq/i, 'ChronicleHQ'],
  [/\bchronicle\b/i, 'ChronicleHQ'],
  [/coderabbit/i, 'CodeRabbit'],
  [/\bmetaforms\b/i, 'Metaforms'],
  [/\bauquan\b/i, 'Auquan'],
  [/truefoundry/i, 'TrueFoundry'],
  [/trupeer\s*ai/i, 'Trupeer AI'],
  [/\btrupeer\b/i, 'Trupeer AI'],
  [/people\s*group/i, 'People Group'],
  [/shaadi\.?com/i, 'Shaadi.com'],
  [/rebel\s*foods/i, 'Rebel Foods'],
  [/rebelfoods/i, 'Rebel Foods'],
  [/\bkiagentic\b/i, 'Kiagentic'],
  [/\bzilo\b/i, 'Zilo'],
  [/\bzoop\b/i, 'Zoop'],
  [/\benterp ret\b/i, 'Enterpret'],
  [/\bfam\b(?!\s*app)/i, 'Fam'],
  [/clarisights/i, 'Clarisights'],
];

// Role keywords
const ROLE_KEYWORDS: Record<string, RegExp> = {
  'Frontend Engineer': /frontend|front-end|fe |react|vue|angular/i,
  'Backend Engineer': /backend|back-end|be |node|python|java|golang/i,
  'Full Stack Engineer': /full[- ]?stack|fullstack/i,
  'AI Engineer': /\bai\b|machine learning|ml engineer|llm|nlp|deep learning/i,
  'Data Engineer': /data engineer|data pipeline|etl/i,
  'Data Scientist': /data scientist|data science/i,
  'DevOps Engineer': /devops|sre|site reliability/i,
  'Product Manager': /product manager|pm |apm/i,
  'Engineering Manager': /engineering manager|em |tech lead manager/i,
  'Tech Lead': /tech lead|technical lead|tl /i,
  'VP Engineering': /vp engineering|vpe|vice president/i,
  'CTO': /\bcto\b|chief technology/i,
  'Designer': /designer|design|ui\/ux|product design/i,
  'QA Engineer': /\bqa\b|quality assurance|test engineer|sdet/i,
  'Security Engineer': /security engineer|infosec|appsec/i,
  'Analytics': /analyst|analytics|business intelligence|bi /i,
};

export function parseClient(event: CalendarEvent): string | null {
  const title = event.summary || '';
  const attendees = event.attendees || [];
  
  // Strategy 1: Check title against regex patterns (most reliable)
  for (const [regex, client] of TITLE_CLIENT_PATTERNS) {
    if (regex.test(title)) {
      return client;
    }
  }
  
  // Strategy 2: Check attendee email domains
  for (const attendee of attendees) {
    const email = attendee.email.toLowerCase();
    
    // Skip organizer
    if (email === 'round1@grapevine.in' || email.includes('grapevine.in')) continue;
    
    // Check against known domain patterns
    const domain = email.split('@')[1];
    if (domain) {
      for (const [pattern, client] of Object.entries(INTERVIEWER_PATTERNS)) {
        // Direct domain match
        if (pattern === domain) {
          return client;
        }
        // Subdomain match
        if (pattern.includes('.') && domain.endsWith(pattern)) {
          return client;
        }
      }
    }
    
    // Check full email against patterns
    for (const [pattern, client] of Object.entries(INTERVIEWER_PATTERNS)) {
      if (email.includes(pattern.toLowerCase())) {
        return client;
      }
    }
  }
  
  // Strategy 3: Check attendee display names
  for (const attendee of attendees) {
    const displayName = attendee.displayName?.toLowerCase() || '';
    for (const [pattern, client] of Object.entries(INTERVIEWER_PATTERNS)) {
      if (!pattern.includes('@') && !pattern.includes('.') && displayName.includes(pattern.toLowerCase())) {
        return client;
      }
    }
  }
  
  return null;
}

export function parseRole(event: CalendarEvent): string | null {
  const title = event.summary || '';
  const description = event.description || '';
  const text = `${title} ${description}`.toLowerCase();
  
  // Check role keywords in order of specificity
  const roleOrder = [
    'VP Engineering',
    'CTO',
    'Engineering Manager',
    'Tech Lead',
    'Product Manager',
    'Full Stack Engineer',
    'Frontend Engineer',
    'Backend Engineer',
    'AI Engineer',
    'Data Engineer',
    'Data Scientist',
    'DevOps Engineer',
    'Security Engineer',
    'QA Engineer',
    'Designer',
    'Analytics',
  ];
  
  for (const role of roleOrder) {
    const regex = ROLE_KEYWORDS[role];
    if (regex && regex.test(text)) {
      return role;
    }
  }
  
  return null;
}

// Known company domains to exclude when looking for candidate emails
const COMPANY_DOMAINS = [
  'grapevine.in',
  'sarvam.ai',
  'toystack.ai',
  'waterlabs.ai',
  'superliving.ai',
  'thesparkle.ai',
  'chroniclehq.com',
  'coderabbit.ai',
  'metaforms.ai',
  'auquan.com',
  'truefoundry.com',
  'trupeer.ai',
  'peoplegroup.co.in',
  'shaadi.com',
  'rebelfoods.com',
  'kiagentic.com',
  'zilo.io',
  'getzoop.today',
  'enterpret.com',
  'fam.app',
  'observe.ai',
  'clarisights.com',
  'amazon.com',
  'microsoft.com',
  'google.com',
];

// Known interviewer/company names to exclude
const KNOWN_INTERVIEWERS = [
  'vedant', 'nitesh', 'meenakshi', 'ram', 'jaskirat', 'vishesh', 
  'sravan', 'pankaj', 'sam', 'sameeksha', 'shub', 'kartikay',
  'abhishek', 'pari', 'sunny', 'jitendra', 'aditya', 'kavya',
  'drashti', 'yash', 'chitra', 'shrikanth', 'hr'
];

// Known company names that might appear in titles
const COMPANY_NAMES = [
  'sarvam', 'sarvam ai', 'toystack', 'toystack ai', 'waterlabs', 'waterlabs ai',
  'superliving', 'superliving ai', 'trustanchor', 'chroniclehq', 'chronicle',
  'coderabbit', 'metaforms', 'auquan', 'truefoundry', 'trupeer', 'trupeer ai',
  'shaadi', 'shaadi.com', 'people group', 'rebel foods', 'rebelfoods',
  'kiagentic', 'zilo', 'zoop', 'enterpret', 'fam', 'clarisights', 'microsoft',
  'amazon', 'google', 'observe', 'observe.ai'
];

export function parseCandidateName(event: CalendarEvent): string | null {
  const title = event.summary || '';
  const attendees = event.attendees || [];
  
  // Strategy 1: Extract name before <> symbol
  // Patterns: "R1: Name <> Company", "Intro Chat: Name (Company) <> Interviewer", "Name <> Interviewer"
  const beforeArrowMatch = title.match(/^(?:R\d+\s*[:.]?\s*|Intro\s*[Cc]hat\s*[:.]?\s*)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)(?:\s*\([^)]+\))?\s*<>/);
  if (beforeArrowMatch) {
    const name = beforeArrowMatch[1].trim();
    if (!isCompanyOrInterviewer(name)) {
      return name;
    }
  }
  
  // Strategy 2: G-Meet pattern "G-Meet | Name | Role"
  const gMeetMatch = title.match(/G-?Meet\s*\|\s*([^|]+)\s*\|/i);
  if (gMeetMatch) {
    const name = gMeetMatch[1].trim();
    if (!isCompanyOrInterviewer(name)) {
      return name;
    }
  }
  
  // Strategy 3: Pattern "Company Role_Name (Company)" e.g., "Metaforms EM_Mihir Khandekhar (Clarisights)"
  const underscoreMatch = title.match(/_([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*(?:\(|$)/);
  if (underscoreMatch) {
    const name = underscoreMatch[1].trim();
    if (!isCompanyOrInterviewer(name)) {
      return name;
    }
  }
  
  // Strategy 4: Pattern with brackets "[Name]" or "(Name)" at end for candidate
  const bracketEndMatch = title.match(/[[(]([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)[)\]]$/);
  if (bracketEndMatch) {
    const name = bracketEndMatch[1].trim();
    // Check if it's not a role or company
    if (!isCompanyOrInterviewer(name) && !isRole(name)) {
      return name;
    }
  }
  
  // Strategy 5: Look at attendees - find personal email (gmail, yahoo, outlook, hotmail)
  const personalDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com', 'mail.com'];
  
  for (const attendee of attendees) {
    const email = attendee.email.toLowerCase();
    const domain = email.split('@')[1];
    
    // Check if it's a personal email domain
    if (personalDomains.some(d => domain === d)) {
      // Try displayName first
      if (attendee.displayName) {
        const name = cleanDisplayName(attendee.displayName);
        if (name && !isCompanyOrInterviewer(name)) {
          return name;
        }
      }
      
      // Extract from email username
      const username = email.split('@')[0];
      const nameFromEmail = extractNameFromEmail(username);
      if (nameFromEmail && !isCompanyOrInterviewer(nameFromEmail)) {
        return nameFromEmail;
      }
    }
  }
  
  // Strategy 6: Look for non-company domain attendees
  for (const attendee of attendees) {
    const email = attendee.email.toLowerCase();
    const domain = email.split('@')[1];
    
    // Skip known company domains
    if (COMPANY_DOMAINS.some(d => domain === d || domain?.endsWith('.' + d))) {
      continue;
    }
    
    // Skip grapevine
    if (domain?.includes('grapevine')) continue;
    
    // This might be a candidate
    if (attendee.displayName) {
      const name = cleanDisplayName(attendee.displayName);
      if (name && !isCompanyOrInterviewer(name)) {
        return name;
      }
    }
  }
  
  return null;
}

function isCompanyOrInterviewer(name: string): boolean {
  const lower = name.toLowerCase();
  
  // Check against known interviewers
  if (KNOWN_INTERVIEWERS.some(i => lower === i || lower.startsWith(i + ' '))) {
    return true;
  }
  
  // Check against company names
  if (COMPANY_NAMES.some(c => lower === c || lower.includes(c))) {
    return true;
  }
  
  return false;
}

function isRole(text: string): boolean {
  const lower = text.toLowerCase();
  const roleKeywords = ['engineer', 'manager', 'designer', 'analyst', 'developer', 'lead', 'sde', 'swe'];
  return roleKeywords.some(r => lower.includes(r));
}

function cleanDisplayName(displayName: string): string | null {
  // Remove email-like patterns
  let name = displayName.replace(/<[^>]+>/g, '').trim();
  
  // Remove company suffixes like "(Company Name)"
  name = name.replace(/\s*\([^)]+\)\s*$/, '').trim();
  
  // Must start with capital letter and be reasonable length
  if (name.length >= 2 && name.length <= 50 && /^[A-Z]/.test(name)) {
    return name;
  }
  
  return null;
}

function extractNameFromEmail(username: string): string | null {
  // Handle patterns like "firstname.lastname", "firstnamelastname", "firstname_lastname"
  const parts = username.split(/[._]/);
  
  if (parts.length >= 1) {
    // Capitalize each part
    const name = parts
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .filter(p => p.length > 1 && !/^\d+$/.test(p)) // Filter out numbers
      .slice(0, 2) // Max 2 parts (first + last name)
      .join(' ');
    
    if (name.length >= 2) {
      return name;
    }
  }
  
  return null;
}

export function extractInterviewers(event: CalendarEvent): {
  emails: string[];
  names: string[];
} {
  const attendees = event.attendees || [];
  const emails: string[] = [];
  const names: string[] = [];
  
  for (const attendee of attendees) {
    const email = attendee.email.toLowerCase();
    
    // Skip the organizer (Round1)
    if (email === 'round1@grapevine.in') continue;
    
    // Skip candidate email if it's a gmail/personal email
    const domain = email.split('@')[1];
    if (domain && (domain === 'gmail.com' || domain === 'yahoo.com' || domain === 'outlook.com')) {
      continue;
    }
    
    emails.push(attendee.email);
    if (attendee.displayName) {
      names.push(attendee.displayName);
    }
  }
  
  return { emails, names };
}

export function shouldSkipEvent(event: CalendarEvent): boolean {
  const title = (event.summary || '').toLowerCase();
  
  // Skip internal meetings
  const skipPatterns = [
    'all hands',
    'standup',
    'update standup',
    'sync',
    'internal',
    'team meeting',
  ];
  
  for (const pattern of skipPatterns) {
    if (title.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

export function calculateDuration(start: string, end: string): number {
  const startTime = new Date(start);
  const endTime = new Date(end);
  return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}

export function getMonth(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().slice(0, 7); // YYYY-MM format
}

export function getDayOfWeek(dateString: string): string {
  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

export function getHour(dateString: string): number {
  const date = new Date(dateString);
  return date.getHours();
}
