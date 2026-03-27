'use client';

import { useEffect, useState, useMemo, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Video, Clock, Search, Copy, Check, Zap, TrendingUp, Users, RefreshCw,
  Calendar, Building2, Briefcase, ChevronRight, X, ArrowUp, ArrowDown,
  GitBranch, ArrowRight, Circle, Wifi, WifiOff
} from 'lucide-react';

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
interface TimelineViewProps {
  interviews: Interview[];
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
  copyToClipboard: (text: string, id: string) => Promise<void>;
  copiedId: string | null;
  onClientClick: (client: string | null) => void;
}

interface ClientsViewProps {
  clients: Array<{ name: string; count: number; candidates: number; roles: string[] }>;
  interviews: Interview[];
  onSelect: (client: string | null) => void;
  selected: string | null;
}

interface CandidatesViewProps {
  candidates: Array<{
    name: string;
    count: number;
    clients: string[];
    roles: string[];
    maxRound: number;
    lastDate: string;
  }>;
  formatDate: (s: string) => string;
}

interface RolesViewProps {
  roles: Array<[string, number]>;
  total: number;
  onSelect: (role: string | null) => void;
  selected: string | null;
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
  selectedCandidate: string | null;
  onSelectCandidate: (candidate: string | null) => void;
  formatDate: (s: string) => string;
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
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-center p-6">
            <div className="text-[#fafafa] text-lg font-medium mb-2">Something went wrong</div>
            <div className="text-[#71717a] text-sm mb-4">{this.state.error?.message || 'An unexpected error occurred'}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#22c55e] text-[#0a0a0a] text-sm font-medium rounded-lg hover:bg-[#22c55e]/90 transition-colors"
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

// Animated number counter hook
function useAnimatedNumber(value: number, duration: number = 400) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const startValue = prevValue.current;
    const diff = value - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevValue.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return displayValue;
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
  const [parsing, setParsing] = useState(false);
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
  const [viewMode, setViewMode] = useState<'timeline' | 'pipeline' | 'clients' | 'candidates' | 'roles'>('timeline');
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

  const parseWithAI = async () => {
    setParsing(true);
    try {
      const res = await fetch('/api/parse-interviews', { method: 'POST' });
      const data = await res.json();
      await loadData();
      addToast(`Parsed ${data.processed || 0} interviews`, 'success');
    } catch (e) {
      console.error('Parse failed:', e);
      addToast('Parse failed', 'warning');
    } finally {
      setParsing(false);
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#71717a]">Loading...</div>
      </div>
    );
  }

  const hasFilters = selectedClient || selectedRole || searchQuery;

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#1c1c1f]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight">Round1</h1>
              {/* Live indicator */}
              <div className="flex items-center gap-1.5" title={isConnected ? 'Connected' : isReconnecting ? 'Reconnecting...' : 'Disconnected'}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? 'bg-[#22c55e] animate-pulse-dot' : 
                  isReconnecting ? 'bg-amber-500 animate-pulse' : 
                  'bg-[#71717a]'
                }`} />
                <span className="text-[10px] text-[#71717a] uppercase tracking-wider">
                  {isConnected ? 'Live' : isReconnecting ? 'Reconnecting...' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-sm relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-12 py-2 bg-[#111113] border border-[#1c1c1f] rounded-lg text-sm placeholder-[#71717a] focus:outline-none focus:border-[#22c55e]/50 transition-colors"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#71717a] bg-[#1c1c1f] px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={syncCalendar}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1c1c1f] text-[#71717a] hover:text-[#fafafa] hover:border-[#2a2a2f] disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                Sync
              </button>
              <button
                onClick={parseWithAI}
                disabled={parsing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#22c55e] text-[#0a0a0a] hover:bg-[#22c55e]/90 disabled:opacity-50 transition-colors"
              >
                <Zap size={12} className={parsing ? 'animate-pulse' : ''} />
                {parsing ? 'Parsing...' : 'Parse'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics Bar */}
      <div className="border-b border-[#1c1c1f]">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-12">
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
                    dateRange === r ? 'bg-[#111113] text-[#fafafa]' : 'text-[#71717a] hover:text-[#fafafa]'
                  }`}
                >
                  {r === 'week' ? '7D' : r === 'month' ? '30D' : r === 'quarter' ? '90D' : 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Insights Bar */}
      {analytics.insights.length > 0 && (
        <div className="border-b border-[#1c1c1f]">
          <div className="max-w-[1400px] mx-auto px-6 py-3">
            <div className="flex items-center gap-6 overflow-x-auto">
              {analytics.insights.map((insight, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-[#71717a] whitespace-nowrap">
                  <Circle size={4} className="text-[#71717a] fill-current" />
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {/* View Tabs & Active Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            {[
              { id: 'timeline', label: 'Timeline', icon: Calendar },
              { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
              { id: 'clients', label: 'Clients', icon: Building2 },
              { id: 'candidates', label: 'Candidates', icon: Users },
              { id: 'roles', label: 'Roles', icon: Briefcase },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === tab.id 
                    ? 'bg-[#111113] text-[#fafafa]' 
                    : 'text-[#71717a] hover:text-[#fafafa]'
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
                className="text-xs text-[#71717a] hover:text-[#fafafa] transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <TimelineView 
            interviews={filtered} 
            formatDate={formatDateFull}
            formatTime={formatTime}
            copyToClipboard={copyToClipboard}
            copiedId={copiedId}
            onClientClick={setSelectedClient}
          />
        )}

        {/* Pipeline View */}
        {viewMode === 'pipeline' && (
          <PipelineView 
            pipeline={analytics.pipeline}
            journeys={analytics.journeyList}
            selectedCandidate={selectedCandidate}
            onSelectCandidate={setSelectedCandidate}
            formatDate={formatDate}
          />
        )}

        {/* Clients View */}
        {viewMode === 'clients' && (
          <ClientsView 
            clients={analytics.clientList}
            interviews={filtered}
            onSelect={setSelectedClient}
            selected={selectedClient}
          />
        )}

        {/* Candidates View */}
        {viewMode === 'candidates' && (
          <CandidatesView 
            candidates={analytics.candidateList}
            formatDate={formatDate}
          />
        )}

        {/* Roles View */}
        {viewMode === 'roles' && (
          <RolesView 
            roles={analytics.roleList}
            total={analytics.total}
            onSelect={setSelectedRole}
            selected={selectedRole}
          />
        )}
      </main>

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 bg-[#111113] border border-[#1c1c1f] rounded-lg shadow-xl ${
              toast.exiting ? 'toast-exit' : 'toast-enter'
            }`}
          >
            {toast.type === 'success' && <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />}
            {toast.type === 'warning' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            {toast.type === 'info' && <div className="w-1.5 h-1.5 rounded-full bg-[#71717a]" />}
            <span className="text-sm text-[#fafafa]">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="ml-2 text-[#71717a] hover:text-[#fafafa] transition-colors"
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
  const animatedValue = useAnimatedNumber(numValue);
  const change = prev ? Math.round(((numValue - prev) / prev) * 100) : null;
  
  return (
    <div>
      <div className="text-3xl font-semibold tabular-nums tracking-tight">
        {typeof value === 'number' ? animatedValue.toLocaleString() : value}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs text-[#71717a]">{label}</span>
        {change !== null && change !== 0 && (
          <span className={`flex items-center text-xs ${change > 0 ? 'text-[#22c55e]' : 'text-[#71717a]'}`}>
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
    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111113] border border-[#1c1c1f] rounded text-xs text-[#fafafa]">
      {label}
      <button onClick={onClear} className="text-[#71717a] hover:text-[#fafafa] transition-colors"><X size={12} /></button>
    </div>
  );
}

function TimelineView({ interviews, formatDate, formatTime, copyToClipboard, copiedId, onClientClick }: TimelineViewProps) {
  // Group by date
  const byDate: Record<string, Interview[]> = {};
  interviews.forEach((i) => {
    const d = formatDate(i.start_time);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(i);
  });

  return (
    <div className="space-y-8">
        {Object.entries(byDate).slice(0, 15).map(([date, items], dateIdx) => (
          <div 
            key={date}
            className="animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${dateIdx * 50}ms`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium text-[#71717a]">{date}</span>
              <span className="text-xs text-[#71717a] tabular-nums">{items.length}</span>
            </div>
            <div className="space-y-1">
              {items.map((i) => {
              const round = extractRound(i.title);
              const meetLink = i.raw_json?.hangoutLink;
              
              return (
                <div 
                  key={i.id} 
                  className="group grid grid-cols-[60px_1fr_50px_auto] gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-[#111113] transition-colors"
                >
                  <div className="text-sm text-[#71717a] tabular-nums">{formatTime(i.start_time)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onClientClick(i.client)}
                        className="text-sm font-medium text-[#fafafa] hover:text-[#22c55e] transition-colors"
                      >
                        {i.client || 'Unknown'}
                      </button>
                      {i.role_type && (
                        <span className="text-xs text-[#71717a]">{i.role_type}</span>
                      )}
                      {round && round > 1 && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          round >= 3 ? 'text-amber-400 bg-amber-500/10' : 'text-[#22c55e] bg-[#22c55e]/10'
                        }`}>R{round}</span>
                      )}
                    </div>
                    <div className="text-sm text-[#71717a] truncate">{i.candidate_name || i.title}</div>
                  </div>
                  <div className="text-xs text-[#71717a] tabular-nums text-right">{i.duration_mins}m</div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyToClipboard(`${i.client} - ${i.candidate_name}`, i.id)}
                      className="p-1.5 text-[#71717a] hover:text-[#fafafa] rounded transition-colors"
                    >
                      {copiedId === i.id ? <Check size={12} className="text-[#22c55e]" /> : <Copy size={12} />}
                    </button>
                    {meetLink && (
                      <a href={meetLink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#71717a] hover:text-[#fafafa] rounded transition-colors">
                        <Video size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientsView({ clients, onSelect, selected }: ClientsViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {clients.filter((c) => c.name !== 'Unknown').map((client, idx) => (
        <button
          key={client.name}
          onClick={() => onSelect(selected === client.name ? null : client.name)}
          className={`text-left p-4 rounded-lg border transition-colors ${
            selected === client.name 
              ? 'bg-[#22c55e]/5 border-[#22c55e]/30' 
              : 'bg-[#111113] border-[#1c1c1f] hover:border-[#2a2a2f]'
          }`}
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-medium text-[#fafafa]">{client.name}</h3>
            <div className="text-xl font-semibold tabular-nums">{client.count}</div>
          </div>
          <div className="text-xs text-[#71717a] mb-2">{client.candidates} candidates</div>
          <div className="flex flex-wrap gap-1">
            {client.roles.slice(0, 2).map((r: string) => (
              <span key={r} className="text-[10px] text-[#71717a] bg-[#1c1c1f] px-1.5 py-0.5 rounded">{r}</span>
            ))}
            {client.roles.length > 2 && (
              <span className="text-[10px] text-[#71717a]">+{client.roles.length - 2}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function CandidatesView({ candidates, formatDate }: CandidatesViewProps) {
  return (
    <div className="space-y-1">
      {candidates.slice(0, 50).map((c, idx) => (
        <div 
          key={c.name} 
          className="group grid grid-cols-[40px_1fr_auto_60px_70px] gap-4 items-center p-3 rounded-lg hover:bg-[#111113] transition-colors"
          style={{ animationDelay: `${idx * 20}ms` }}
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium ${
            c.maxRound >= 3 ? 'bg-amber-500/10 text-amber-400' :
            c.maxRound >= 2 ? 'bg-[#22c55e]/10 text-[#22c55e]' :
            'bg-[#1c1c1f] text-[#71717a]'
          }`}>
            {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#fafafa]">{c.name}</span>
              {c.maxRound > 1 && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  c.maxRound >= 3 ? 'text-amber-400 bg-amber-500/10' : 'text-[#22c55e] bg-[#22c55e]/10'
                }`}>
                  R{c.maxRound}
                </span>
              )}
            </div>
            <div className="text-xs text-[#71717a]">
              {c.clients.slice(0, 2).join(', ')}
              {c.clients.length > 2 && ` +${c.clients.length - 2}`}
            </div>
          </div>
          <div className="hidden sm:flex gap-1">
            {c.roles.slice(0, 2).map((r: string) => (
              <span key={r} className="text-[10px] text-[#71717a] bg-[#1c1c1f] px-1.5 py-0.5 rounded">{r}</span>
            ))}
          </div>
          <div className="text-right">
            <div className="text-sm font-medium tabular-nums">{c.count}</div>
            <div className="text-[10px] text-[#71717a]">interviews</div>
          </div>
          <div className="text-xs text-[#71717a] text-right tabular-nums">{formatDate(c.lastDate)}</div>
        </div>
      ))}
    </div>
  );
}

function RolesView({ roles, total, onSelect, selected }: RolesViewProps) {
  const maxCount = roles[0]?.[1] || 1;
  
  return (
    <div className="space-y-2">
      {roles.map(([role, count]) => {
        const pct = Math.round((count / total) * 100);
        const barPct = (count / maxCount) * 100;
        
        return (
          <button
            key={role}
            onClick={() => onSelect(selected === role ? null : role)}
            className={`w-full text-left p-4 rounded-lg border transition-colors ${
              selected === role 
                ? 'bg-[#22c55e]/5 border-[#22c55e]/30' 
                : 'bg-[#111113] border-[#1c1c1f] hover:border-[#2a2a2f]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#fafafa]">{role}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">{count}</span>
                <span className="text-xs text-[#71717a]">{pct}%</span>
              </div>
            </div>
            <div className="h-1 bg-[#1c1c1f] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#22c55e] rounded-full transition-all duration-500"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PipelineView({ pipeline, journeys, selectedCandidate, onSelectCandidate, formatDate }: PipelineViewProps) {
  const stages = [
    { label: 'Round 1', count: pipeline.r1, color: 'bg-[#71717a]' },
    { label: 'Round 2', count: pipeline.r2, color: 'bg-[#22c55e]' },
    { label: 'Round 3+', count: pipeline.r3, color: 'bg-amber-500' },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="space-y-8">
      {/* Funnel */}
      <div className="bg-[#111113] border border-[#1c1c1f] rounded-lg p-6">
        <h3 className="text-xs font-medium text-[#71717a] uppercase tracking-wider mb-6">Pipeline</h3>
        
        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const widthPct = (stage.count / maxCount) * 100;
            const conversionFromPrev = idx === 0 ? null : 
              stages[idx - 1].count > 0 ? Math.round((stage.count / stages[idx - 1].count) * 100) : 0;
            
            return (
              <div key={stage.label} className="flex items-center gap-4">
                <div className="w-16 text-xs text-[#71717a] text-right">{stage.label}</div>
                <div className="flex-1">
                  <div className="h-8 bg-[#1c1c1f] rounded overflow-hidden">
                    <div 
                      className={`h-full ${stage.color} rounded flex items-center justify-end pr-3 transition-all duration-700`}
                      style={{ width: `${Math.max(widthPct, 8)}%` }}
                    >
                      <span className="text-sm font-semibold text-white tabular-nums">{stage.count}</span>
                    </div>
                  </div>
                </div>
                {conversionFromPrev !== null && (
                  <div className="w-14 text-xs text-[#71717a] tabular-nums">
                    {conversionFromPrev}%
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-[#1c1c1f] grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums">{pipeline.r1}</div>
            <div className="text-xs text-[#71717a]">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums text-[#22c55e]">{pipeline.r1to2}%</div>
            <div className="text-xs text-[#71717a]">R1 to R2</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold tabular-nums text-amber-400">{pipeline.r2to3}%</div>
            <div className="text-xs text-[#71717a]">R2 to R3</div>
          </div>
        </div>
      </div>

      {/* Journeys */}
      <div>
        <h3 className="text-xs font-medium text-[#71717a] uppercase tracking-wider mb-4">
          Journeys ({journeys.length})
        </h3>
        
        <div className="space-y-2">
          {journeys.slice(0, 20).map((journey) => {
            const isExpanded = selectedCandidate === journey.name;
            
            return (
              <div 
                key={journey.name}
                className={`bg-[#111113] border rounded-lg overflow-hidden transition-colors ${
                  isExpanded ? 'border-[#22c55e]/30' : 'border-[#1c1c1f] hover:border-[#2a2a2f]'
                }`}
              >
                <button
                  onClick={() => onSelectCandidate(isExpanded ? null : journey.name)}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1c1c1f] flex items-center justify-center text-xs font-medium text-[#71717a]">
                      {journey.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#fafafa]">{journey.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          journey.maxRound >= 3 ? 'bg-amber-500/10 text-amber-400' :
                          journey.maxRound >= 2 ? 'bg-[#22c55e]/10 text-[#22c55e]' :
                          'bg-[#1c1c1f] text-[#71717a]'
                        }`}>
                          R{journey.maxRound}
                        </span>
                      </div>
                      <div className="text-xs text-[#71717a]">
                        {journey.clients.join(', ')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {journey.interviews.slice(0, 4).map((int, i) => (
                      <div 
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          int.round >= 3 ? 'bg-amber-400' :
                          int.round >= 2 ? 'bg-[#22c55e]' :
                          'bg-[#71717a]'
                        }`}
                      />
                    ))}
                    <ChevronRight 
                      size={14} 
                      className={`text-[#71717a] transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="relative pl-6 border-l border-[#1c1c1f] ml-4 space-y-3">
                      {journey.interviews.map((int, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[13px] w-2 h-2 rounded-full ${
                            int.round >= 3 ? 'bg-amber-400' :
                            int.round >= 2 ? 'bg-[#22c55e]' :
                            'bg-[#71717a]'
                          }`} />
                          <div className="bg-[#0a0a0a] rounded p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-[#fafafa]">{int.client}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  int.round >= 3 ? 'bg-amber-500/10 text-amber-400' :
                                  int.round >= 2 ? 'bg-[#22c55e]/10 text-[#22c55e]' :
                                  'bg-[#1c1c1f] text-[#71717a]'
                                }`}>
                                  R{int.round}
                                </span>
                              </div>
                              <span className="text-xs text-[#71717a] tabular-nums">{formatDate(int.date)}</span>
                            </div>
                            <div className="text-xs text-[#71717a] mt-1">{int.role}</div>
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
