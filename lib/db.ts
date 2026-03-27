import { supabaseAdmin } from './supabase';
import {
  parseClient,
  parseRole,
  parseCandidateName,
  extractInterviewers,
  shouldSkipEvent,
  calculateDuration,
  getMonth,
  getDayOfWeek,
  getHour,
} from './parser';

export interface Interview {
  id?: string;
  calendar_event_id: string;
  title: string;
  client: string | null;
  role_type: string | null;
  candidate_name: string | null;
  start_time: string;
  end_time: string;
  duration_mins: number;
  interviewers: string[];
  interviewer_names: string[];
  status: string;
  month: string;
  day_of_week: string;
  hour: number;
  raw_json: any;
  synced_at?: string;
}

// Upsert an interview from a calendar event
export async function upsertInterview(calendarEvent: any): Promise<Interview | null> {
  // Skip internal meetings
  if (shouldSkipEvent(calendarEvent)) {
    return null;
  }
  
  // Skip cancelled events
  if (calendarEvent.status === 'cancelled') {
    // Delete if exists
    await supabaseAdmin
      .from('interviews')
      .delete()
      .eq('calendar_event_id', calendarEvent.id);
    return null;
  }
  
  // Extract start and end times
  const startTime = calendarEvent.start?.dateTime || calendarEvent.start?.date;
  const endTime = calendarEvent.end?.dateTime || calendarEvent.end?.date;
  
  if (!startTime || !endTime) {
    return null; // Skip all-day events or events without times
  }
  
  // Parse event details
  const client = parseClient(calendarEvent);
  const roleType = parseRole(calendarEvent);
  const candidateName = parseCandidateName(calendarEvent);
  const { emails, names } = extractInterviewers(calendarEvent);
  const duration = calculateDuration(startTime, endTime);
  
  const interview: Interview = {
    calendar_event_id: calendarEvent.id,
    title: calendarEvent.summary || 'Untitled Event',
    client,
    role_type: roleType,
    candidate_name: candidateName,
    start_time: startTime,
    end_time: endTime,
    duration_mins: duration,
    interviewers: emails,
    interviewer_names: names,
    status: calendarEvent.status || 'confirmed',
    month: getMonth(startTime),
    day_of_week: getDayOfWeek(startTime),
    hour: getHour(startTime),
    raw_json: calendarEvent,
  };
  
  // Upsert to database
  const { data, error } = await supabaseAdmin
    .from('interviews')
    .upsert(interview, {
      onConflict: 'calendar_event_id',
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error upserting interview:', error);
    throw error;
  }
  
  return data;
}

// Bulk upsert interviews
export async function bulkUpsertInterviews(calendarEvents: any[]): Promise<{
  success: number;
  skipped: number;
  errors: number;
}> {
  let success = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const event of calendarEvents) {
    try {
      const result = await upsertInterview(event);
      if (result) {
        success++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      errors++;
    }
  }
  
  return { success, skipped, errors };
}

// Get interviews with filters
export async function getInterviews(filters: {
  client?: string;
  roleType?: string;
  startDate?: string;
  endDate?: string;
  interviewer?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabaseAdmin
    .from('interviews')
    .select('*', { count: 'exact' })
    .order('start_time', { ascending: false });
  
  if (filters.client) {
    query = query.eq('client', filters.client);
  }
  
  if (filters.roleType) {
    query = query.eq('role_type', filters.roleType);
  }
  
  if (filters.startDate) {
    query = query.gte('start_time', filters.startDate);
  }
  
  if (filters.endDate) {
    query = query.lte('start_time', filters.endDate);
  }
  
  if (filters.interviewer) {
    query = query.contains('interviewers', [filters.interviewer]);
  }
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    throw error;
  }
  
  return { data: data || [], count: count || 0 };
}

// Get statistics
export async function getStats(filters?: {
  client?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabaseAdmin.from('interviews').select('*');
  
  if (filters?.client) {
    query = query.eq('client', filters.client);
  }
  
  if (filters?.startDate) {
    query = query.gte('start_time', filters.startDate);
  }
  
  if (filters?.endDate) {
    query = query.lte('start_time', filters.endDate);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw error;
  }
  
  const interviews = data || [];
  
  // Calculate statistics
  const totalInterviews = interviews.length;
  
  // Clients breakdown
  const clientCounts: Record<string, number> = {};
  interviews.forEach((i) => {
    if (i.client) {
      clientCounts[i.client] = (clientCounts[i.client] || 0) + 1;
    }
  });
  
  // Monthly breakdown
  const monthlyCounts: Record<string, number> = {};
  interviews.forEach((i) => {
    if (i.month) {
      monthlyCounts[i.month] = (monthlyCounts[i.month] || 0) + 1;
    }
  });
  
  // Role breakdown
  const roleCounts: Record<string, number> = {};
  interviews.forEach((i) => {
    if (i.role_type) {
      roleCounts[i.role_type] = (roleCounts[i.role_type] || 0) + 1;
    }
  });
  
  // Interviewer leaderboard
  const interviewerCounts: Record<string, number> = {};
  interviews.forEach((i) => {
    i.interviewer_names?.forEach((name: string) => {
      interviewerCounts[name] = (interviewerCounts[name] || 0) + 1;
    });
  });
  
  // Day of week breakdown
  const dayOfWeekCounts: Record<string, number> = {};
  interviews.forEach((i) => {
    if (i.day_of_week) {
      dayOfWeekCounts[i.day_of_week] = (dayOfWeekCounts[i.day_of_week] || 0) + 1;
    }
  });
  
  // Hour breakdown
  const hourCounts: Record<number, number> = {};
  interviews.forEach((i) => {
    if (i.hour !== null && i.hour !== undefined) {
      hourCounts[i.hour] = (hourCounts[i.hour] || 0) + 1;
    }
  });
  
  return {
    totalInterviews,
    clients: clientCounts,
    monthly: monthlyCounts,
    roles: roleCounts,
    interviewers: interviewerCounts,
    dayOfWeek: dayOfWeekCounts,
    hours: hourCounts,
  };
}

// Get unique clients
export async function getClients() {
  const { data, error } = await supabaseAdmin
    .from('interviews')
    .select('client')
    .not('client', 'is', null);
  
  if (error) {
    throw error;
  }
  
  const clients = new Set(data?.map((i) => i.client) || []);
  return Array.from(clients).sort();
}

// Get unique role types
export async function getRoleTypes() {
  const { data, error } = await supabaseAdmin
    .from('interviews')
    .select('role_type')
    .not('role_type', 'is', null);
  
  if (error) {
    throw error;
  }
  
  const roles = new Set(data?.map((i) => i.role_type) || []);
  return Array.from(roles).sort();
}
