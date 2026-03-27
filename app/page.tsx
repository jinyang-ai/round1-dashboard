'use client';

import { useEffect, useState, useMemo, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Video, Search, Copy, Check, Users, RefreshCw, AlertCircle,
  Calendar, ChevronRight, X, ArrowUp, ArrowDown, Clock,
  GitBranch, BarChart3, Building2, Briefcase, ChevronDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Interview {
  id: string;
  title: string;
  client: string | null;
  role_type: string | null;
  candidate_name: string | null;
  start_time: string;
  end_time: string;
  duration_mins: number;
  interviewer_names: string[];
  status: string;
  raw_json: any;
}

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  exiting?: boolean;
}

// View component interfaces
interface TodayViewProps {
  interviews: Interview[];
  filtered: Interview[];
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
  copyToClipboard: (text: string, id: string) => Promise<void>;
  copiedId: string | null;
  onClientClick: (client: string | null) => void;
  analytics: {
    candidateList: Array<{ name: string; count: number; clients: string[]; roles: string[]; maxRound: number; lastDate: string }>;
  };
}

interface PipelineViewProps {
  pipeline: {
    r1: number;
    r2: number;
    r3: number;
    r1Only: number;
    r1to2: number;
    r2to3: number;
  };
  journeys: Array<{
    name: string;
    interviews: Array<{ date: string; client: string; role: string; round: number; title: string }>;
    clients: string[];
    maxRound: number;
  }>;
  candidates: Array<{ name: string; count: number; clients: string[]; roles: string[]; maxRound: number; lastDate: string }>;
  selectedCandidate: string | null;
  onSelectCandidate: (candidate: string | null) => void;
  formatDate: (s: string) => string;
  onClientClick: (client: string | null) => void;
}

interface ReportsViewProps {
  interviews: Interview[];
  analytics: {
    total: number;
    clientList: Array<{ name: string; count: number; candidates: number; roles: string[] }>;
    roleList: Array<[string, number]>;
  };
  onClientSelect: (client: string | null) => void;
  onRoleSelect: (role: string | null) => void;
  selectedClient: string | null;
  selectedRole: string | null;
}

// Error Boundary for graceful error handling
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-[#ffffff] flex items-center justify-center">
          <div className="text-center p-6">
            <div className="text-[#111827] text-lg font-medium mb-2">Something went wrong</div>
            <div className="text-[#6b7280] text-sm mb-4">{this.state.error?.message || 'An unexpected error occurred'}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#059669] text-white text-sm font-medium rounded-lg hover:bg-[#059669]/90 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Extract round number from title
function extractRound(title: string): number | null {
  const match = title.match(/(?:R|Round\s*)(\d)/i);
  return match ? parseInt(match[1]) : null;
}

export default function DashboardPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const addToastRef = useRef<(message: string, type: Toast['type']) => void>(null);
  
  // Filters
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'all'>('month');
  const [viewMode, setViewMode] = useState<'today' | 'pipeline' | 'reports'>('today');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  // Toast management
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto dismiss after 5s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 150);
    }, 5000);
  }, []);

  // Keep addToast in a ref to avoid useEffect dependency issues
  addToastRef.current = addToast;

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 150);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchRef.current?.blur();
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let wasConnected = false;

    const connect = () => {
      try {
        if (wasConnected) {
          setIsReconnecting(true);
        }
        
        eventSource = new EventSource('/api/events');
        
        eventSource.onopen = () => {
          if (wasConnected && isReconnecting) {
            // We successfully reconnected after a disconnect
            setIsReconnecting(false);
          }
          wasConnected = true;
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'sync') {
              addToastRef.current?.(`Synced ${data.count || 'new'} interviews`, 'success');
              loadData();
            } else if (data.type === 'ping') {
              // Keep alive, no action needed
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          const wasConnectedBefore = wasConnected;
          setIsConnected(false);
          setIsReconnecting(true);
          eventSource?.close();
          
          // Show toast only on first disconnect
          if (wasConnectedBefore) {
            addToastRef.current?.('Connection lost, reconnecting...', 'warning');
          }
          
          // Reconnect after 5s
          reconnectTimeout = setTimeout(connect, 5000);
        };
      } catch (e) {
        setIsConnected(false);
        setIsReconnecting(false);
      }
    };

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, []); // No dependencies - uses ref for addToast

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/interviews?limit=1000');
      const data = await res.json();
      if (data.success) setInterviews(data.data);
    } catch (e) {
      console.error('Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      await loadData();
      addToast('Calendar synced', 'success');
    } catch (e) {
      console.error('Sync failed:', e);
      addToast('Sync failed', 'warning');
    } finally {
      setSyncing(false);
    }
  };

  // Date filtering
  const now = new Date();
  const getDateThreshold = () => {
    const d = new Date(now);
    if (dateRange === 'week') d.setDate(d.getDate() - 7);
    else if (dateRange === 'month') d.setMonth(d.getMonth() - 1);
    else if (dateRange === 'quarter') d.setMonth(d.getMonth() - 3);
    else return null;
    return d;
  };

  // Filtered data
  const filtered = useMemo(() => {
    let data = [...interviews];
    const threshold = getDateThreshold();
    
    if (threshold) {
      data = data.filter(i => new Date(i.start_time) >= threshold);
    }
    if (selectedClient) {
      data = data.filter(i => i.client === selectedClient);
    }
    if (selectedRole) {
      data = data.filter(i => i.role_type === selectedRole);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.candidate_name?.toLowerCase().includes(q) ||
        i.client?.toLowerCase().includes(q)
      );
    }
    
    return data.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [interviews, dateRange, selectedClient, selectedRole, searchQuery]);

  // Analytics
  const analytics = useMemo(() => {
    const all = filtered;
    const threshold = getDateThreshold();
    const prevThreshold = threshold ? new Date(threshold) : null;
    if (prevThreshold) {
      if (dateRange === 'week') prevThreshold.setDate(prevThreshold.getDate() - 7);
      else if (dateRange === 'month') prevThreshold.setMonth(prevThreshold.getMonth() - 1);
      else if (dateRange === 'quarter') prevThreshold.setMonth(prevThreshold.getMonth() - 3);
    }
    
    // Previous period for comparison
    const prev = prevThreshold ? interviews.filter(i => {
      const d = new Date(i.start_time);
      return d >= prevThreshold && d < threshold!;
    }) : [];

    // Client breakdown
    const clients: Record<string, { count: number; candidates: Set<string>; roles: Set<string> }> = {};
    all.forEach(i => {
      const c = i.client || 'Unknown';
      if (!clients[c]) clients[c] = { count: 0, candidates: new Set(), roles: new Set() };
      clients[c].count++;
      if (i.candidate_name) clients[c].candidates.add(i.candidate_name);
      if (i.role_type) clients[c].roles.add(i.role_type);
    });
    const clientList = Object.entries(clients)
      .map(([name, d]) => ({ name, count: d.count, candidates: d.candidates.size, roles: Array.from(d.roles) }))
      .sort((a, b) => b.count - a.count);

    // Role breakdown
    const roles: Record<string, number> = {};
    all.forEach(i => {
      if (i.role_type) roles[i.role_type] = (roles[i.role_type] || 0) + 1;
    });
    const roleList = Object.entries(roles).sort((a, b) => b[1] - a[1]);

    // Candidate analysis
    const candidates: Record<string, { count: number; clients: Set<string>; roles: Set<string>; rounds: number[]; lastDate: string }> = {};
    all.forEach(i => {
      if (!i.candidate_name) return;
      const c = i.candidate_name;
      if (!candidates[c]) candidates[c] = { count: 0, clients: new Set(), roles: new Set(), rounds: [], lastDate: '' };
      candidates[c].count++;
      if (i.client) candidates[c].clients.add(i.client);
      if (i.role_type) candidates[c].roles.add(i.role_type);
      const round = extractRound(i.title);
      if (round) candidates[c].rounds.push(round);
      if (i.start_time > candidates[c].lastDate) candidates[c].lastDate = i.start_time;
    });
    const candidateList = Object.entries(candidates)
      .map(([name, d]) => ({ 
        name, 
        count: d.count, 
        clients: Array.from(d.clients), 
        roles: Array.from(d.roles),
        maxRound: d.rounds.length ? Math.max(...d.rounds) : 1,
        lastDate: d.lastDate
      }))
      .sort((a, b) => b.count - a.count);

    // Insights - simplified
    const insights: { text: string; type: 'activity' | 'trend' | 'highlight' }[] = [];
    
    if (clientList[0] && clientList[0].name !== 'Unknown') {
      insights.push({ 
        text: `${clientList[0].name} leads with ${clientList[0].count} interviews`,
        type: 'activity'
      });
    }

    if (prev.length > 0) {
      const change = Math.round(((all.length - prev.length) / prev.length) * 100);
      if (Math.abs(change) > 10) {
        insights.push({ 
          text: `Activity ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% vs prior`,
          type: 'trend'
        });
      }
    }

    const advancing = candidateList.filter(c => c.maxRound >= 2);
    if (advancing.length > 0) {
      insights.push({ 
        text: `${advancing.length} candidates in Round 2+`,
        type: 'highlight'
      });
    }

    // Pipeline/Funnel Analysis
    const pipeline = {
      r1: 0,
      r2: 0,
      r3: 0,
      r1Only: 0,
      r1to2: 0,
      r2to3: 0,
    };
    
    const candidateClientRounds: Record<string, Set<number>> = {};
    all.forEach(i => {
      if (!i.candidate_name || !i.client) return;
      const key = `${i.candidate_name}::${i.client}`;
      if (!candidateClientRounds[key]) candidateClientRounds[key] = new Set();
      const round = extractRound(i.title) || 1;
      candidateClientRounds[key].add(round);
    });

    Object.values(candidateClientRounds).forEach(rounds => {
      if (rounds.has(1) || rounds.size > 0) pipeline.r1++;
      if (rounds.has(2)) pipeline.r2++;
      if (rounds.has(3)) pipeline.r3++;
    });

    pipeline.r1Only = pipeline.r1 - pipeline.r2;
    pipeline.r1to2 = pipeline.r1 > 0 ? Math.round((pipeline.r2 / pipeline.r1) * 100) : 0;
    pipeline.r2to3 = pipeline.r2 > 0 ? Math.round((pipeline.r3 / pipeline.r2) * 100) : 0;

    // Candidate journeys
    const journeys: Record<string, { 
      name: string; 
      interviews: { date: string; client: string; role: string; round: number; title: string }[];
      clients: string[];
      maxRound: number;
    }> = {};
    
    all.forEach(i => {
      if (!i.candidate_name) return;
      const name = i.candidate_name;
      if (!journeys[name]) {
        journeys[name] = { name, interviews: [], clients: [], maxRound: 1 };
      }
      const round = extractRound(i.title) || 1;
      journeys[name].interviews.push({
        date: i.start_time,
        client: i.client || 'Unknown',
        role: i.role_type || 'Unknown',
        round,
        title: i.title
      });
      if (i.client && !journeys[name].clients.includes(i.client)) {
        journeys[name].clients.push(i.client);
      }
      if (round > journeys[name].maxRound) journeys[name].maxRound = round;
    });

    Object.values(journeys).forEach(j => {
      j.interviews.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    const journeyList = Object.values(journeys)
      .filter(j => j.interviews.length > 1 || j.maxRound > 1)
      .sort((a, b) => b.maxRound - a.maxRound || b.interviews.length - a.interviews.length);

    return { 
      total: all.length,
      prevTotal: prev.length,
      uniqueCandidates: new Set(all.filter(i => i.candidate_name).map(i => i.candidate_name)).size,
      uniqueClients: clientList.filter(c => c.name !== 'Unknown').length,
      clientList, 
      roleList, 
      candidateList,
      insights,
      pipeline,
      journeyList
    };
  }, [filtered, interviews, dateRange]);

  const formatTime = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const formatDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const formatDateFull = (s: string) => new Date(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ffffff] flex items-center justify-center">
        <div className="text-[#6b7280]">Loading...</div>
      </div>
    );
  }

  const hasFilters = selectedClient || selectedRole || searchQuery;

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[#ffffff] text-[#111827]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#ffffff]/95 backdrop-blur-sm border-b border-[#e5e7eb]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight">Round1</h1>
              {/* Live indicator - no constant pulsing */}
              <div className="flex items-center gap-1.5" title={isConnected ? 'Connected' : isReconnecting ? 'Reconnecting...' : 'Disconnected'}>
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  isConnected ? 'bg-[#059669]' : 
                  isReconnecting ? 'bg-amber-500' : 
                  'bg-[#6b7280]'
                }`} />
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">
                  {isConnected ? 'Live' : isReconnecting ? 'Reconnecting...' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-sm relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-12 py-2 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg text-sm placeholder-[#6b7280] focus:outline-none focus:border-[#059669]/50 transition-colors"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#6b7280] bg-[#e5e7eb] px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={syncCalendar}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:text-[#111827] hover:border-[#d1d5db] disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                Sync
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics Bar */}
      <div className="border-b border-[#e5e7eb]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Metric label="Interviews" value={analytics.total} prev={analytics.prevTotal} />
              <Metric label="Candidates" value={analytics.uniqueCandidates} />
              <Metric label="Clients" value={analytics.uniqueClients} />
            </div>
            
            {/* Date Range */}
            <div className="flex items-center gap-1">
              {(['week', 'month', 'quarter', 'all'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    dateRange === r ? 'bg-[#f9fafb] text-[#111827]' : 'text-[#6b7280] hover:text-[#111827]'
                  }`}
                >
                  {r === 'week' ? '7D' : r === 'month' ? '30D' : r === 'quarter' ? '90D' : 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {/* View Tabs & Active Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            {[
              { id: 'today', label: 'Today', icon: Calendar },
              { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
              { id: 'reports', label: 'Reports', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as 'today' | 'pipeline' | 'reports')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === tab.id 
                    ? 'bg-[#f9fafb] text-[#111827]' 
                    : 'text-[#6b7280] hover:text-[#111827]'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Filters */}
          {hasFilters && (
            <div className="flex items-center gap-2">
              {selectedClient && (
                <FilterPill label={selectedClient} onClear={() => setSelectedClient(null)} />
              )}
              {selectedRole && (
                <FilterPill label={selectedRole} onClear={() => setSelectedRole(null)} />
              )}
              <button
                onClick={() => { setSelectedClient(null); setSelectedRole(null); setSearchQuery(''); }}
                className="text-xs text-[#6b7280] hover:text-[#111827] transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Today View */}
        {viewMode === 'today' && (
          <TodayView 
            interviews={interviews}
            filtered={filtered}
            formatDate={formatDateFull}
            formatTime={formatTime}
            copyToClipboard={copyToClipboard}
            copiedId={copiedId}
            onClientClick={setSelectedClient}
            analytics={analytics}
          />
        )}

        {/* Pipeline View */}
        {viewMode === 'pipeline' && (
          <PipelineView 
            pipeline={analytics.pipeline}
            journeys={analytics.journeyList}
            candidates={analytics.candidateList}
            selectedCandidate={selectedCandidate}
            onSelectCandidate={setSelectedCandidate}
            formatDate={formatDate}
            onClientClick={setSelectedClient}
          />
        )}

        {/* Reports View */}
        {viewMode === 'reports' && (
          <ReportsView 
            interviews={interviews}
            analytics={analytics}
            onClientSelect={setSelectedClient}
            onRoleSelect={setSelectedRole}
            selectedClient={selectedClient}
            selectedRole={selectedRole}
          />
        )}
      </main>

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg shadow-xl ${
              toast.exiting ? 'toast-exit' : 'toast-enter'
            }`}
          >
            {toast.type === 'success' && <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />}
            {toast.type === 'warning' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            {toast.type === 'info' && <div className="w-1.5 h-1.5 rounded-full bg-[#6b7280]" />}
            <span className="text-sm text-[#111827]">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="ml-2 text-[#6b7280] hover:text-[#111827] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
    </ErrorBoundary>
  );
}

function Metric({ label, value, prev }: { label: string; value: string | number; prev?: number }) {
  const numValue = typeof value === 'number' ? value : 0;
  const change = prev ? Math.round(((numValue - prev) / prev) * 100) : null;
  
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight">
        {typeof value === 'number' ? numValue.toLocaleString() : value}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs text-[#6b7280]">{label}</span>
        {change !== null && change !== 0 && (
          <span className={`flex items-center text-xs ${change > 0 ? 'text-[#059669]' : 'text-[#ef4444]'}`}>
            {change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#f9fafb] border border-[#e5e7eb] rounded text-xs text-[#111827]">
      {label}
      <button onClick={onClear} className="text-[#6b7280] hover:text-[#111827] transition-colors"><X size={12} /></button>
    </div>
  );
}


// ============== TODAY VIEW ==============
function TodayView({ interviews, filtered, formatDate, formatTime, copyToClipboard, copiedId, onClientClick, analytics }: TodayViewProps) {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  
  // Upcoming interviews (next 48 hours)
  const upcoming = useMemo(() => {
    return interviews
      .filter(i => {
        const d = new Date(i.start_time);
        return d >= now && d <= in48h;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [interviews]);

  // Stale candidates (no activity >7 days, but had recent activity before)
  const staleCandidates = useMemo(() => {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return analytics.candidateList
      .filter(c => {
        const lastDate = new Date(c.lastDate);
        return lastDate < sevenDaysAgo && lastDate > thirtyDaysAgo && c.maxRound < 3;
      })
      .slice(0, 8);
  }, [analytics.candidateList]);

  // Candidates needing R2 scheduling (had R1, no R2 yet, R1 was >3 days ago)
  const needsScheduling = useMemo(() => {
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    return analytics.candidateList
      .filter(c => {
        const lastDate = new Date(c.lastDate);
        return c.maxRound === 1 && lastDate < threeDaysAgo && lastDate > new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      })
      .slice(0, 8);
  }, [analytics.candidateList]);

  return (
    <div className="space-y-8">
      {/* Upcoming Interviews */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#111827]">Upcoming (48h)</h2>
          <span className="text-xs text-[#6b7280] tabular-nums">{upcoming.length} interviews</span>
        </div>
        
        {upcoming.length === 0 ? (
          <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-8 text-center">
            <div className="text-sm text-[#6b7280]">No interviews in the next 48 hours</div>
          </div>
        ) : (
          <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg divide-y divide-[#e5e7eb]">
            {upcoming.slice(0, 10).map((i) => {
              const round = extractRound(i.title);
              const meetLink = i.raw_json?.hangoutLink;
              const isToday = new Date(i.start_time).toDateString() === now.toDateString();
              
              return (
                <div key={i.id} className="group flex items-center gap-4 p-4 hover:bg-white transition-colors">
                  <div className="w-16 text-center">
                    <div className="text-xs text-[#6b7280]">{isToday ? 'Today' : formatDate(i.start_time)}</div>
                    <div className="text-sm font-medium tabular-nums">{formatTime(i.start_time)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onClientClick(i.client)}
                        className="text-sm font-medium text-[#111827] hover:text-[#059669] transition-colors"
                      >
                        {i.client || 'Unknown'}
                      </button>
                      {round && (
                        <span 
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded text-[#059669]"
                          style={{ backgroundColor: `rgba(5, 150, 105, ${round >= 2 ? 0.2 : 0.1})` }}
                        >
                          R{round}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[#6b7280] truncate">{i.candidate_name || i.title}</div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyToClipboard(`${i.client} - ${i.candidate_name}`, i.id)}
                      className="p-1.5 text-[#6b7280] hover:text-[#111827] rounded transition-colors"
                    >
                      {copiedId === i.id ? <Check size={14} className="text-[#059669]" /> : <Copy size={14} />}
                    </button>
                    {meetLink && (
                      <a href={meetLink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#6b7280] hover:text-[#111827] rounded transition-colors">
                        <Video size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Scheduling */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={14} className="text-[#059669]" />
            <h2 className="text-sm font-medium text-[#111827]">Needs R2 Scheduling</h2>
          </div>
          
          {needsScheduling.length === 0 ? (
            <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-6 text-center">
              <div className="text-sm text-[#6b7280]">All caught up</div>
            </div>
          ) : (
            <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg divide-y divide-[#e5e7eb]">
              {needsScheduling.map((c) => (
                <div key={c.name} className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-sm font-medium text-[#111827]">{c.name}</div>
                    <div className="text-xs text-[#6b7280]">{c.clients.join(', ')}</div>
                  </div>
                  <div className="text-xs text-[#6b7280] tabular-nums">
                    R1: {formatDate(c.lastDate)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stale Candidates */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-amber-500" />
            <h2 className="text-sm font-medium text-[#111827]">Stale ({'>'}7 days)</h2>
          </div>
          
          {staleCandidates.length === 0 ? (
            <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-6 text-center">
              <div className="text-sm text-[#6b7280]">No stale candidates</div>
            </div>
          ) : (
            <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg divide-y divide-[#e5e7eb]">
              {staleCandidates.map((c) => (
                <div key={c.name} className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#111827]">{c.name}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#059669]/10 text-[#059669]">
                        R{c.maxRound}
                      </span>
                    </div>
                    <div className="text-xs text-[#6b7280]">{c.clients.join(', ')}</div>
                  </div>
                  <div className="text-xs text-amber-600 tabular-nums">
                    {Math.floor((now.getTime() - new Date(c.lastDate).getTime()) / (24 * 60 * 60 * 1000))}d ago
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#111827]">Recent Activity</h2>
        </div>
        
        <div className="space-y-1">
          {filtered.slice(0, 15).map((i) => {
            const round = extractRound(i.title);
            const meetLink = i.raw_json?.hangoutLink;
            
            return (
              <div key={i.id} className="group flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-[#f9fafb] transition-colors">
                <div className="w-20 text-xs text-[#6b7280] tabular-nums">{formatDate(i.start_time)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onClientClick(i.client)}
                      className="text-sm font-medium text-[#111827] hover:text-[#059669] transition-colors"
                    >
                      {i.client || 'Unknown'}
                    </button>
                    {round && (
                      <span 
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded text-[#059669]"
                        style={{ backgroundColor: `rgba(5, 150, 105, ${round >= 2 ? 0.2 : 0.1})` }}
                      >
                        R{round}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[#6b7280] truncate">{i.candidate_name || i.title}</div>
                </div>
                <div className="text-xs text-[#6b7280] tabular-nums">{i.duration_mins}m</div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => copyToClipboard(`${i.client} - ${i.candidate_name}`, i.id)}
                    className="p-1.5 text-[#6b7280] hover:text-[#111827] rounded transition-colors"
                  >
                    {copiedId === i.id ? <Check size={12} className="text-[#059669]" /> : <Copy size={12} />}
                  </button>
                  {meetLink && (
                    <a href={meetLink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#6b7280] hover:text-[#111827] rounded transition-colors">
                      <Video size={12} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============== PIPELINE VIEW ==============
function PipelineView({ pipeline, journeys, candidates, selectedCandidate, onSelectCandidate, formatDate, onClientClick }: PipelineViewProps) {
  const stages = [
    { label: 'Round 1', count: pipeline.r1, pct: 100 },
    { label: 'Round 2', count: pipeline.r2, pct: pipeline.r1 > 0 ? Math.round((pipeline.r2 / pipeline.r1) * 100) : 0 },
    { label: 'Round 3+', count: pipeline.r3, pct: pipeline.r2 > 0 ? Math.round((pipeline.r3 / pipeline.r2) * 100) : 0 },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="space-y-8">
      {/* Funnel */}
      <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#111827]">Conversion Funnel</h3>
          <div className="flex items-center gap-4 text-xs text-[#6b7280]">
            <span>R1→R2: <span className="font-medium text-[#059669]">{pipeline.r1to2}%</span></span>
            <span>R2→R3: <span className="font-medium text-amber-500">{pipeline.r2to3}%</span></span>
          </div>
        </div>
        
        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const widthPct = (stage.count / maxCount) * 100;
            const opacity = 1 - (idx * 0.25);
            
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className="w-14 text-xs text-[#6b7280] text-right">{stage.label}</div>
                <div className="flex-1 h-8 bg-[#e5e7eb] rounded overflow-hidden">
                  <div 
                    className="h-full bg-[#059669] rounded flex items-center justify-end pr-3 transition-all duration-500"
                    style={{ width: `${Math.max(widthPct, 10)}%`, opacity }}
                  >
                    <span className="text-sm font-medium text-white tabular-nums">{stage.count}</span>
                  </div>
                </div>
                <div className="w-10 text-xs text-[#6b7280] tabular-nums">
                  {idx > 0 ? `${stage.pct}%` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Candidate Journeys */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#111827]">Candidate Journeys</h3>
          <span className="text-xs text-[#6b7280]">{journeys.length} candidates</span>
        </div>
        
        <div className="space-y-2">
          {journeys.slice(0, 25).map((journey) => {
            const isExpanded = selectedCandidate === journey.name;
            
            return (
              <div 
                key={journey.name}
                className={`bg-[#f9fafb] border rounded-lg overflow-hidden transition-colors ${
                  isExpanded ? 'border-[#059669]/30' : 'border-[#e5e7eb] hover:border-[#d1d5db]'
                }`}
              >
                <button
                  onClick={() => onSelectCandidate(isExpanded ? null : journey.name)}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-[#059669]"
                      style={{ backgroundColor: `rgba(5, 150, 105, ${journey.maxRound >= 2 ? 0.2 : 0.1})` }}
                    >
                      {journey.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#111827]">{journey.name}</span>
                        <span 
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded text-[#059669]"
                          style={{ backgroundColor: `rgba(5, 150, 105, ${journey.maxRound >= 2 ? 0.2 : 0.1})` }}
                        >
                          R{journey.maxRound}
                        </span>
                      </div>
                      <div className="text-xs text-[#6b7280]">{journey.clients.join(', ')}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6b7280] tabular-nums">{journey.interviews.length} interviews</span>
                    <ChevronRight 
                      size={14} 
                      className={`text-[#6b7280] transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="relative pl-6 border-l border-[#e5e7eb] ml-4 space-y-3">
                      {journey.interviews.map((int, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[13px] w-2 h-2 rounded-full bg-[#059669]`} style={{ opacity: 0.3 + (int.round * 0.2) }} />
                          <div className="bg-white rounded p-3 border border-[#e5e7eb]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => onClientClick(int.client)}
                                  className="text-sm text-[#111827] hover:text-[#059669] transition-colors"
                                >
                                  {int.client}
                                </button>
                                <span 
                                  className="text-[10px] px-1.5 py-0.5 rounded text-[#059669]"
                                  style={{ backgroundColor: `rgba(5, 150, 105, ${int.round >= 2 ? 0.2 : 0.1})` }}
                                >
                                  R{int.round}
                                </span>
                              </div>
                              <span className="text-xs text-[#6b7280] tabular-nums">{formatDate(int.date)}</span>
                            </div>
                            {int.role && <div className="text-xs text-[#6b7280] mt-1">{int.role}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============== REPORTS VIEW ==============
function ReportsView({ interviews, analytics, onClientSelect, onRoleSelect, selectedClient, selectedRole }: ReportsViewProps) {
  // Monthly trends
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; interviews: number; candidates: Set<string> }> = {};
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      months[key] = { month: label, interviews: 0, candidates: new Set() };
    }
    
    interviews.forEach(i => {
      const key = i.start_time.slice(0, 7);
      if (months[key]) {
        months[key].interviews++;
        if (i.candidate_name) months[key].candidates.add(i.candidate_name);
      }
    });
    
    return Object.values(months).map(m => ({
      month: m.month,
      interviews: m.interviews,
      candidates: m.candidates.size
    }));
  }, [interviews]);

  // Interviewer workload
  const { interviewerList, maxInterviewerCount } = useMemo(() => {
    const interviewers: Record<string, number> = {};
    interviews.forEach(i => {
      i.interviewer_names?.forEach(name => {
        if (name && name !== 'Unknown') {
          interviewers[name] = (interviewers[name] || 0) + 1;
        }
      });
    });
    const sorted = Object.entries(interviewers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.split(' ')[0], fullName: name, count }));
    return { interviewerList: sorted, maxInterviewerCount: sorted[0]?.count || 1 };
  }, [interviews]);

  // Time to schedule (average days between R1 and R2)
  const avgTimeToR2 = useMemo(() => {
    const candidateR1: Record<string, Date> = {};
    const gaps: number[] = [];
    
    interviews.forEach(i => {
      if (!i.candidate_name) return;
      const round = extractRound(i.title);
      const date = new Date(i.start_time);
      
      if (round === 1 && !candidateR1[i.candidate_name]) {
        candidateR1[i.candidate_name] = date;
      } else if (round === 2 && candidateR1[i.candidate_name]) {
        const gap = Math.floor((date.getTime() - candidateR1[i.candidate_name].getTime()) / (24 * 60 * 60 * 1000));
        if (gap > 0 && gap < 60) gaps.push(gap);
      }
    });
    
    return gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  }, [interviews]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
          <div className="text-2xl font-semibold tabular-nums">{analytics.total}</div>
          <div className="text-xs text-[#6b7280]">Total Interviews</div>
        </div>
        <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
          <div className="text-2xl font-semibold tabular-nums">{analytics.clientList.length}</div>
          <div className="text-xs text-[#6b7280]">Active Clients</div>
        </div>
        <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
          <div className="text-2xl font-semibold tabular-nums">{interviewerList.length}</div>
          <div className="text-xs text-[#6b7280]">Interviewers</div>
        </div>
        <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
          <div className="text-2xl font-semibold tabular-nums">{avgTimeToR2 ?? '—'}</div>
          <div className="text-xs text-[#6b7280]">Avg Days R1→R2</div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[#111827] mb-4">Monthly Trends</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
              />
              <Bar dataKey="interviews" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interviewer Workload */}
        <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[#111827] mb-4">Interviewer Workload</h3>
          <div className="space-y-2">
            {interviewerList.length === 0 ? (
              <div className="text-sm text-[#6b7280]">No data</div>
            ) : interviewerList.map((interviewer) => (
              <div key={interviewer.fullName} className="flex items-center gap-3">
                <div className="w-20 text-xs text-[#6b7280] truncate" title={interviewer.fullName}>
                  {interviewer.name}
                </div>
                <div className="flex-1 h-5 bg-[#e5e7eb] rounded overflow-hidden">
                  <div 
                    className="h-full bg-[#059669] rounded flex items-center justify-end pr-2"
                    style={{ width: `${(interviewer.count / maxInterviewerCount) * 100}%` }}
                  >
                    {interviewer.count >= 5 && (
                      <span className="text-[10px] font-medium text-white">{interviewer.count}</span>
                    )}
                  </div>
                </div>
                {interviewer.count < 5 && (
                  <span className="text-xs text-[#6b7280] tabular-nums w-6">{interviewer.count}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Client Breakdown */}
        <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
          <h3 className="text-sm font-medium text-[#111827] mb-4">Client Activity</h3>
          <div className="space-y-2">
            {analytics.clientList.filter(c => c.name !== 'Unknown').slice(0, 8).map((client) => (
              <button
                key={client.name}
                onClick={() => onClientSelect(selectedClient === client.name ? null : client.name)}
                className={`w-full flex items-center justify-between p-2 rounded transition-colors ${
                  selectedClient === client.name ? 'bg-[#059669]/10' : 'hover:bg-white'
                }`}
              >
                <span className="text-sm text-[#111827]">{client.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6b7280]">{client.candidates} candidates</span>
                  <span className="text-sm font-medium tabular-nums">{client.count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Role Breakdown */}
      <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[#111827] mb-4">Role Distribution</h3>
        <div className="flex flex-wrap gap-2">
          {analytics.roleList.slice(0, 12).map(([role, count]) => (
            <button
              key={role}
              onClick={() => onRoleSelect(selectedRole === role ? null : role)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                selectedRole === role 
                  ? 'bg-[#059669]/10 border-[#059669]/30 text-[#059669]' 
                  : 'border-[#e5e7eb] hover:border-[#d1d5db] text-[#111827]'
              }`}
            >
              <span className="text-sm">{role}</span>
              <span className="text-xs text-[#6b7280] tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
