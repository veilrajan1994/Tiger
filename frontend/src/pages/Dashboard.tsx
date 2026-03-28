import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

interface Stats {
  totalRecords: number;
  totalStores: number;
  recentUploads: number;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

const StatCard = memo<StatCardProps & { loading?: boolean }>(({ label, value, icon, colorClass, loading }) => (
  <div className={`stat-card ${loading ? 'skeleton' : ''}`}>
    <div className="stat-card-info">
      <span className="stat-card-label">{loading ? '\u00A0' : label}</span>
      <span className="stat-card-value">{loading ? '\u00A0' : value.toLocaleString()}</span>
    </div>
    <div className={`stat-card-icon ${colorClass}`}>{icon}</div>
  </div>
));
StatCard.displayName = 'StatCard';

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const PriceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const StoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

interface Insights {
  summary: string;
  highlights: string[];
  recommendations: string[];
}

// ─── AI Insights Card ────────────────────────────────────────────────────────

interface InsightsCardProps {
  insights: Insights | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

const InsightsCard = memo<InsightsCardProps>(({ insights, loading, error, onRefresh }) => (
  <div className="insights-card">
    <div className="insights-header">
      <h3>
        <span className="ai-badge">AI</span>
        Pricing Insights
      </h3>
      <button className="insights-refresh-btn" onClick={onRefresh} disabled={loading}>
        {loading ? 'Analyzing...' : 'Refresh'}
      </button>
    </div>

    {loading && (
      <>
        <div className="insights-loading">
          <div className="spinner" />
          Analyzing your pricing data...
        </div>
        <div className="insights-skeleton">
          <div className="skeleton-bar w-full h-lg" />
          <div className="skeleton-bar w-3-4" />
          <div className="skeleton-bar w-2-3" />
          <div className="skeleton-bar w-1-2" />
          <div className="skeleton-bar w-3-4" />
        </div>
      </>
    )}

    {error && !loading && <div className="insights-error">{error}</div>}

    {insights && !loading && (
      <>
        <div className="insights-summary">{insights.summary}</div>
        <div className="insights-section">
          <h4>Key Highlights</h4>
          <ul className="insights-list">
            {insights.highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
        <div className="insights-section">
          <h4>Recommendations</h4>
          <ul className="insights-list">
            {insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </>
    )}
  </div>
));
InsightsCard.displayName = 'InsightsCard';

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  // Report Generator state
  const [reportQuery, setReportQuery] = useState('');
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [pricingRes, storesRes, uploadsRes] = await Promise.all([
          api.get('/pricing?limit=1'),
          api.get('/stores'),
          api.get('/upload/history?limit=10')
        ]);
        setStats({
          totalRecords: pricingRes.data.data.pagination.total,
          totalStores: storesRes.data.data.stores.length,
          recentUploads: uploadsRes.data.data.uploads.length
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const response = await api.get('/ai/insights');
      setInsights(response.data.data.insights);
    } catch (err: any) {
      setInsightsError(
        err.response?.data?.message || 'Failed to generate insights. Check your Gemini API key.'
      );
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  // Insights only fetched when user clicks the button — no auto-load

  const handleGenerateReport = useCallback(async () => {
    if (!reportQuery.trim()) return;
    setReportLoading(true);
    setReportError('');
    try {
      const res = await api.post('/ai/report', { query: reportQuery.trim() });
      setReport(res.data.data.report);
    } catch (err: any) {
      setReportError(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  }, [reportQuery]);

  const handleReportKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGenerateReport();
  }, [handleGenerateReport]);

  const handleNavPricing = useCallback(() => navigate('/pricing'), [navigate]);
  const handleNavUpload = useCallback(() => navigate('/upload'), [navigate]);

  return (
    <div className="dashboard-page">
      <h1>{greeting}, {user?.firstName || 'there'}</h1>
      <div className="subtitle">
        Here's an overview of your pricing data
      </div>

      <div className="stats-grid">
        <StatCard label="Pricing Records" value={stats?.totalRecords || 0} icon={<PriceIcon />} colorClass="blue" loading={loading} />
        <StatCard label="Active Stores" value={stats?.totalStores || 0} icon={<StoreIcon />} colorClass="green" loading={loading} />
        <StatCard label="Recent Uploads" value={stats?.recentUploads || 0} icon={<UploadIcon />} colorClass="orange" loading={loading} />
      </div>

      <div className="quick-actions">
        <button className="quick-action-btn" onClick={handleNavPricing}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search Pricing Records
        </button>
        <button className="quick-action-btn" onClick={handleNavUpload}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload CSV File
        </button>
      </div>

      {/* AI Features Grid — Report Generator + Pricing Insights side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

        {/* Report Generator */}
        <div className="insights-card" style={{ margin: 0 }}>
          <div className="insights-header">
            <h3>
              <span className="ai-badge">AI</span>
              Report Generator
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder='e.g. "Weekly report for Tokyo store"'
              value={reportQuery}
              onChange={(e) => setReportQuery(e.target.value)}
              onKeyDown={handleReportKeyDown}
              style={{ flex: 1, padding: '0.625rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
            />
            <button
              onClick={handleGenerateReport}
              disabled={reportLoading || !reportQuery.trim()}
              style={{ padding: '0.625rem 1.25rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', opacity: reportLoading || !reportQuery.trim() ? 0.5 : 1 }}
            >
              {reportLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
          {reportError && <div className="insights-error">{reportError}</div>}
          {reportLoading && (
            <div className="insights-loading">
              <div className="spinner" />
              Generating your report...
            </div>
          )}
          {report && !reportLoading && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{report.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Period: {report.period}</div>
              </div>
              {report.keyMetrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', padding: '0.75rem 1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {report.keyMetrics.map((m: any, i: number) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{m.value}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {report.sections?.map((s: any, i: number) => (
                <div key={i} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>{s.heading}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#4b5563', lineHeight: 1.5 }}>{s.content}</div>
                </div>
              ))}
              {report.recommendations?.length > 0 && (
                <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>Recommendations</div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {report.recommendations.map((r: string, i: number) => (
                      <li key={i} style={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.5 }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Pricing Insights — only loads on button click */}
        <div style={{ margin: 0 }}>
          <InsightsCard
            insights={insights}
            loading={insightsLoading}
            error={insightsError}
            onRefresh={fetchInsights}
          />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
