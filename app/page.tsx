'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { 
  Video, Clock, Search, Copy, Check, Zap, TrendingUp, Users, RefreshCw,
  Calendar, Building2, Briefcase, ChevronRight, Filter, X, ArrowUp, ArrowDown,
  Flame, Target, AlertCircle, Star, GitBranch, ArrowRight, Circle
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

// Animated number counter hook
function useAnimatedNumber(value: number, duration: number = 500) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const startValue = prevValue.current;
    const diff = value - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
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
  
  // Filters
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'all'>('month');
  const [viewMode, setViewMode] = useState<'timeline' | 'pipeline' | 'clients' | 'candidates' | 'roles'>('timeline');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

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
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  const parseWithAI = async () => {
    setParsing(true);
    try {
      const res = await fetch('/api/parse-interviews', { method: 'POST' });
      const data = await res.json();
      console.log('Parse result:', data);
      await loadData();
    } catch (e) {
      console.error('Parse failed:', e);
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

    // Daily breakdown
    const daily: Record<string, number> = {};
    all.forEach(i => {
      const d = i.start_time.slice(0, 10);
      daily[d] = (daily[d] || 0) + 1;
    });

    // Insights
    const insights: { icon: any; text: string; type: 'hot' | 'trend' | 'alert' | 'star' }[] = [];
    
    // Top client insight
    if (clientList[0] && clientList[0].name !== 'Unknown') {
      const pct = Math.round((clientList[0].count / all.length) * 100);
      insights.push({ 
        icon: Flame, 
        text: `${clientList[0].name} is most active — ${clientList[0].count} interviews (${pct}% of total)`,
        type: 'hot'
      });
    }

    // Growth/decline
    if (prev.length > 0) {
      const change = Math.round(((all.length - prev.length) / prev.length) * 100);
      if (change > 10) {
        insights.push({ icon: TrendingUp, text: `Activity up ${change}% vs previous period`, type: 'trend' });
      } else if (change < -10) {
        insights.push({ icon: AlertCircle, text: `Activity down ${Math.abs(change)}% vs previous period`, type: 'alert' });
      }
    }

    // Top role
    if (roleList[0]) {
      const pct = Math.round((roleList[0][1] / all.length) * 100);
      insights.push({ icon: Target, text: `${roleList[0][0]} is top role — ${pct}% of interviews`, type: 'trend' });
    }

    // Multi-round candidates
    const advancing = candidateList.filter(c => c.maxRound >= 2);
    if (advancing.length > 0) {
      insights.push({ 
        icon: Star, 
        text: `${advancing.length} candidates advancing (Round 2+): ${advancing.slice(0, 3).map(c => c.name).join(', ')}${advancing.length > 3 ? '...' : ''}`,
        type: 'star'
      });
    }

    // Multi-company candidates
    const multiCompany = candidateList.filter(c => c.clients.length > 1);
    if (multiCompany.length > 0) {
      insights.push({
        icon: Users,
        text: `${multiCompany.length} candidates interviewing at multiple companies`,
        type: 'trend'
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
    
    // Track by candidate-client pairs for accurate funnel
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

    // Candidate journeys (detailed timeline per candidate)
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

    // Sort interviews within each journey
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
      daily,
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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-zinc-500">Loading Round1...</div>
      </div>
    );
  }

  const hasFilters = selectedClient || selectedRole || searchQuery;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#09090b]/95 backdrop-blur border-b border-zinc-800/50">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-6">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <Zap size={16} className="text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Round1</h1>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Interview Intelligence</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                placeholder="Search candidates, clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={syncCalendar}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                Sync
              </button>
              <button
                onClick={parseWithAI}
                disabled={parsing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <Zap size={12} className={parsing ? 'animate-pulse' : ''} />
                {parsing ? 'Parsing...' : 'AI Parse'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics Bar */}
      <div className="border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Metric label="Interviews" value={analytics.total} prev={analytics.prevTotal} />
              <Metric label="Candidates" value={analytics.uniqueCandidates} />
              <Metric label="Clients" value={analytics.uniqueClients} />
              <Metric label="Top Role" value={analytics.roleList[0]?.[0] || '—'} small />
            </div>
            
            {/* Date Range */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {(['week', 'month', 'quarter', 'all'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    dateRange === r ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
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
        <div className="border-b border-zinc-800/50 bg-zinc-900/20">
          <div className="max-w-[1600px] mx-auto px-6 py-3">
            <div className="flex items-center gap-6 overflow-x-auto">
              {analytics.insights.map((insight, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <insight.icon size={14} className={
                    insight.type === 'hot' ? 'text-orange-400' :
                    insight.type === 'alert' ? 'text-red-400' :
                    insight.type === 'star' ? 'text-yellow-400' :
                    'text-emerald-400'
                  } />
                  <span className="text-zinc-400">{insight.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {/* View Tabs & Active Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-1">
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
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === tab.id 
                    ? 'bg-zinc-800 text-white shadow-lg shadow-black/20' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
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
                className="text-xs text-zinc-500 hover:text-white"
              >
                Clear all
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
    </div>
  );
}

function Metric({ label, value, prev, small }: { label: string; value: string | number; prev?: number; small?: boolean }) {
  const numValue = typeof value === 'number' ? value : 0;
  const animatedValue = useAnimatedNumber(numValue);
  const change = prev ? Math.round(((numValue - prev) / prev) * 100) : null;
  
  return (
    <div className="group">
      <div className={`font-bold text-white transition-transform group-hover:scale-105 ${small ? 'text-sm' : 'text-2xl tabular-nums'}`}>
        {typeof value === 'number' ? animatedValue.toLocaleString() : value}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
        {change !== null && change !== 0 && (
          <span className={`flex items-center text-[10px] transition-colors ${change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-400">
      {label}
      <button onClick={onClear} className="hover:text-white"><X size={12} /></button>
    </div>
  );
}

function TimelineView({ interviews, formatDate, formatTime, copyToClipboard, copiedId, onClientClick }: any) {
  // Group by date
  const byDate: Record<string, any[]> = {};
  interviews.forEach((i: any) => {
    const d = formatDate(i.start_time);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(i);
  });

  return (
    <div className="space-y-6">
      {Object.entries(byDate).slice(0, 15).map(([date, items], dateIdx) => (
        <div 
          key={date}
          className="animate-in fade-in slide-in-from-bottom-2"
          style={{ animationDelay: `${dateIdx * 100}ms`, animationFillMode: 'backwards' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{date}</span>
            <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full tabular-nums">{items.length}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-zinc-800/50 to-transparent" />
          </div>
          <div className="grid gap-1">
            {items.map((i: any, itemIdx: number) => {
              const round = extractRound(i.title);
              const meetLink = i.raw_json?.hangoutLink;
              
              return (
                <div 
                  key={i.id} 
                  className="group flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-zinc-900/50 transition-all duration-200 hover:translate-x-1"
                  style={{ animationDelay: `${dateIdx * 100 + itemIdx * 30}ms` }}
                >
                  <div className="w-14 text-right text-sm text-zinc-500 tabular-nums">{formatTime(i.start_time)}</div>
                  <div className="w-px h-6 bg-zinc-800 group-hover:bg-emerald-500 group-hover:h-8 transition-all duration-200" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onClientClick(i.client)}
                        className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {i.client || 'Unknown'}
                      </button>
                      {i.role_type && (
                        <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded transition-colors group-hover:bg-zinc-800">{i.role_type}</span>
                      )}
                      {round && round > 1 && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          round >= 3 ? 'text-yellow-400 bg-yellow-500/10' : 'text-emerald-400 bg-emerald-500/10'
                        }`}>R{round}</span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-300 truncate">{i.candidate_name || i.title}</div>
                  </div>
                  <div className="text-xs text-zinc-600 tabular-nums">{i.duration_mins}m</div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => copyToClipboard(`${i.client} - ${i.candidate_name}`, i.id)}
                      className="p-1.5 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                    >
                      {copiedId === i.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                    {meetLink && (
                      <a href={meetLink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded transition-colors">
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

function ClientsView({ clients, interviews, onSelect, selected }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.filter((c: any) => c.name !== 'Unknown').map((client: any, idx: number) => (
        <button
          key={client.name}
          onClick={() => onSelect(selected === client.name ? null : client.name)}
          className={`text-left p-5 rounded-xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            selected === client.name 
              ? 'bg-emerald-500/10 border-emerald-500/30 scale-[1.02] shadow-lg shadow-emerald-500/10' 
              : 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700/50 hover:bg-zinc-900/50 hover:scale-[1.01]'
          }`}
          style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
        >
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-base font-semibold text-white">{client.name}</h3>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">{client.count}</div>
          </div>
          <div className="text-sm text-zinc-500 mb-3">{client.candidates} candidates</div>
          <div className="flex flex-wrap gap-1.5">
            {client.roles.slice(0, 3).map((r: string) => (
              <span key={r} className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">{r}</span>
            ))}
            {client.roles.length > 3 && (
              <span className="text-[10px] text-zinc-600">+{client.roles.length - 3}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function CandidatesView({ candidates, formatDate }: any) {
  return (
    <div className="space-y-2">
      {candidates.slice(0, 50).map((c: any, idx: number) => (
        <div 
          key={c.name} 
          className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800/30 rounded-xl hover:bg-zinc-900/50 hover:border-zinc-700/50 transition-all duration-200 animate-in fade-in slide-in-from-left-2 hover:translate-x-1"
          style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
              c.maxRound >= 3 ? 'bg-gradient-to-br from-yellow-600 to-yellow-700 text-yellow-100' :
              c.maxRound >= 2 ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-emerald-100' :
              'bg-gradient-to-br from-zinc-700 to-zinc-800 text-zinc-400'
            }`}>
              {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{c.name}</span>
                {c.maxRound > 1 && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    c.maxRound >= 3 ? 'text-yellow-400 bg-yellow-500/10' : 'text-emerald-400 bg-emerald-500/10'
                  }`}>
                    R{c.maxRound}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                {c.clients.slice(0, 2).map((cl: string) => (
                  <span key={cl} className="text-emerald-400/80">{cl}</span>
                ))}
                {c.clients.length > 2 && <span className="text-zinc-600">+{c.clients.length - 2}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex gap-1.5">
              {c.roles.slice(0, 2).map((r: string) => (
                <span key={r} className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">{r}</span>
              ))}
            </div>
            <div className="text-right min-w-[60px]">
              <div className="text-base font-bold text-zinc-200 tabular-nums">{c.count}</div>
              <div className="text-[10px] text-zinc-600">interviews</div>
            </div>
            <div className="text-xs text-zinc-500 w-16 text-right tabular-nums">{formatDate(c.lastDate)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RolesView({ roles, total, onSelect, selected }: any) {
  const maxCount = roles[0]?.[1] || 1;
  
  return (
    <div className="space-y-3">
      {roles.map(([role, count]: [string, number], idx: number) => {
        const pct = Math.round((count / total) * 100);
        const barPct = (count / maxCount) * 100;
        
        return (
          <button
            key={role}
            onClick={() => onSelect(selected === role ? null : role)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
              selected === role 
                ? 'bg-emerald-500/10 border-emerald-500/30 scale-[1.02]' 
                : 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700/50 hover:bg-zinc-900/50'
            }`}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">{role}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-zinc-300 tabular-nums">{count}</span>
                <span className="text-xs text-zinc-600">({pct}%)</span>
              </div>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${barPct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PipelineView({ pipeline, journeys, selectedCandidate, onSelectCandidate, formatDate }: any) {
  const stages = [
    { label: 'Round 1', count: pipeline.r1, color: 'from-blue-500 to-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: 'Round 2', count: pipeline.r2, color: 'from-emerald-500 to-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Round 3+', count: pipeline.r3, color: 'from-yellow-500 to-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="space-y-8">
      {/* Funnel Visualization */}
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Interview Pipeline</h3>
        
        {/* Funnel Bars */}
        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const widthPct = (stage.count / maxCount) * 100;
            const conversionFromPrev = idx === 0 ? null : 
              stages[idx - 1].count > 0 ? Math.round((stage.count / stages[idx - 1].count) * 100) : 0;
            
            return (
              <div key={stage.label} className="relative">
                <div className="flex items-center gap-4">
                  <div className="w-20 text-right">
                    <span className="text-xs text-zinc-500">{stage.label}</span>
                  </div>
                  <div className="flex-1 relative">
                    <div className="h-12 bg-zinc-800/30 rounded-lg overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${stage.color} rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-4`}
                        style={{ width: `${Math.max(widthPct, 8)}%` }}
                      >
                        <span className="text-lg font-bold text-white drop-shadow-lg tabular-nums">{stage.count}</span>
                      </div>
                    </div>
                  </div>
                  {conversionFromPrev !== null && (
                    <div className="w-20 flex items-center gap-1">
                      <ArrowRight size={12} className="text-zinc-600" />
                      <span className={`text-sm font-medium ${conversionFromPrev >= 50 ? 'text-emerald-400' : conversionFromPrev >= 25 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                        {conversionFromPrev}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion Summary */}
        <div className="mt-8 pt-6 border-t border-zinc-800/50 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400 tabular-nums">{pipeline.r1}</div>
            <div className="text-xs text-zinc-500">Total Candidates</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">{pipeline.r1to2}%</div>
            <div className="text-xs text-zinc-500">R1 → R2 Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400 tabular-nums">{pipeline.r2to3}%</div>
            <div className="text-xs text-zinc-500">R2 → R3 Rate</div>
          </div>
        </div>
      </div>

      {/* Candidate Journeys */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Candidate Journeys ({journeys.length})
        </h3>
        
        <div className="space-y-3">
          {journeys.slice(0, 20).map((journey: any, idx: number) => {
            const isExpanded = selectedCandidate === journey.name;
            
            return (
              <div 
                key={journey.name}
                className={`bg-zinc-900/30 border rounded-xl overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800/50 hover:border-zinc-700/50'
                }`}
              >
                <button
                  onClick={() => onSelectCandidate(isExpanded ? null : journey.name)}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-400">
                      {journey.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{journey.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          journey.maxRound >= 3 ? 'bg-yellow-500/10 text-yellow-400' :
                          journey.maxRound >= 2 ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>
                          R{journey.maxRound}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {journey.clients.join(', ')} · {journey.interviews.length} interviews
                      </div>
                    </div>
                  </div>
                  
                  {/* Mini Journey Dots */}
                  <div className="flex items-center gap-1">
                    {journey.interviews.slice(0, 5).map((int: any, i: number) => (
                      <div 
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          int.round >= 3 ? 'bg-yellow-400' :
                          int.round >= 2 ? 'bg-emerald-400' :
                          'bg-blue-400'
                        }`}
                        title={`R${int.round}: ${int.client}`}
                      />
                    ))}
                    {journey.interviews.length > 5 && (
                      <span className="text-[10px] text-zinc-600">+{journey.interviews.length - 5}</span>
                    )}
                    <ChevronRight 
                      size={16} 
                      className={`text-zinc-600 transition-transform duration-300 ml-2 ${isExpanded ? 'rotate-90' : ''}`} 
                    />
                  </div>
                </button>

                {/* Expanded Timeline */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="relative pl-6 border-l-2 border-zinc-700/50 ml-5 space-y-4">
                      {journey.interviews.map((int: any, i: number) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 ${
                            int.round >= 3 ? 'bg-yellow-400 border-yellow-400' :
                            int.round >= 2 ? 'bg-emerald-400 border-emerald-400' :
                            'bg-blue-400 border-blue-400'
                          }`} />
                          <div className="bg-zinc-800/30 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-emerald-400">{int.client}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                  int.round >= 3 ? 'bg-yellow-500/10 text-yellow-400' :
                                  int.round >= 2 ? 'bg-emerald-500/10 text-emerald-400' :
                                  'bg-blue-500/10 text-blue-400'
                                }`}>
                                  Round {int.round}
                                </span>
                              </div>
                              <span className="text-xs text-zinc-500">{formatDate(int.date)}</span>
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">{int.role}</div>
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
