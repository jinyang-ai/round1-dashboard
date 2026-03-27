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

// Known interviewer patterns
const INTERVIEWER_PATTERNS: Record<string, string> = {
  'vedant@sarvam.ai': 'Sarvam AI',
  'nitesh@sarvam.ai': 'Sarvam AI',
  'meenakshi@sarvam.ai': 'Sarvam AI',
  'ram@sarvam.ai': 'Sarvam AI',
  'jaskirat': 'Superliving AI',
  'vishesh': 'Superliving AI',
  'sravan': 'Waterlabs AI',
  'pankaj@thesparkle.ai': 'TrustAnchor',
  'sam@chroniclehq.com': 'ChronicleHQ',
  'sameeksha': 'ChronicleHQ',
  'coderabbit.ai': 'CodeRabbit',
  'metaforms.ai': 'Metaforms',
  'auquan.com': 'Auquan',
  'truefoundry.com': 'TrueFoundry',
  'trupeer.ai': 'Trupeer AI',
  'peoplegroup.co.in': 'Shaadi.com / People Group',
  'shaadi.com': 'Shaadi.com / People Group',
  'rebelfoods.com': 'Rebel Foods',
  'kiagentic': 'Kiagentic',
  'zilo.io': 'Zilo',
  'getzoop.today': 'Zoop',
  'enterpret.com': 'Enterpret',
  'fam.app': 'Fam',
};

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
  
  // Check title first
  for (const [pattern, client] of Object.entries(INTERVIEWER_PATTERNS)) {
    if (title.toLowerCase().includes(pattern.toLowerCase())) {
      return client;
    }
  }
  
  // Check attendee emails
  for (const attendee of attendees) {
    const email = attendee.email.toLowerCase();
    
    // Skip organizer
    if (email === 'round1@grapevine.in') continue;
    
    // Check against known patterns
    for (const [pattern, client] of Object.entries(INTERVIEWER_PATTERNS)) {
      if (email.includes(pattern.toLowerCase())) {
        return client;
      }
    }
    
    // Extract domain-based clients
    const domain = email.split('@')[1];
    if (domain) {
      for (const [pattern, client] of Object.entries(INTERVIEWER_PATTERNS)) {
        if (pattern.includes('@') && domain === pattern.split('@')[1]) {
          return client;
        }
        if (!pattern.includes('@') && domain.includes(pattern)) {
          return client;
        }
      }
    }
  }
  
  // Check attendee names
  for (const attendee of attendees) {
    const displayName = attendee.displayName?.toLowerCase() || '';
    for (const [pattern, client] of Object.entries(INTERVIEWER_PATTERNS)) {
      if (!pattern.includes('@') && displayName.includes(pattern.toLowerCase())) {
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

export function parseCandidateName(event: CalendarEvent): string | null {
  const title = event.summary || '';
  
  // Try to extract name from parentheses: "Company Role Interview (Candidate Name)"
  const parenMatch = title.match(/\(([^)]+)\)$/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }
  
  // Try to extract from "with Name" pattern
  const withMatch = title.match(/with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (withMatch) {
    return withMatch[1].trim();
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
