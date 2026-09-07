import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, getOwnerToken, setOwnerToken } from '../api/client';
import type { RunListItem } from '../api/model';
import { useToast } from '../components/Toast';
import { firstSentence, formatDateTime, formatUsd } from '../lib/format';

const STATUS_CHIP: Record<string, string> = {
  framing: 'chip--warning',
  awaiting_confirmation: 'chip--warning',
  running: 'chip--accent',
  completed: 'chip--success',
  failed: 'chip--danger',
  cancelled: 'chip--muted',
};
const STATUS_LABEL: Record<string, string> = {
  framing: 'Framing',
  awaiting_confirmation: 'Awaiting review',
  running: 'Working',
  completed: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function OwnerTokenSettings({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState(() => getOwnerToken());
  const toast = useToast();
  return (
    <details className="settings card">
      <summary className="settings__summary">Settings</summary>
      <div className="card__body">
        <label className="label" htmlFor="owner-token">
          Owner token
        </label>
        <p className="muted small" style={{ marginBottom: 8 }}>
          If the backend was started with OWNER_TOKEN, creating runs and listing them needs it. It is stored only in this browser.
        </p>
        <div className="row">
          <input id="owner-token" className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" placeholder="Bearer token" />
          <button
            type="button"
            className="btn"
            onClick={() => {
              setOwnerToken(token);
              toast(token.trim() ? 'Owner token saved' : 'Owner token cleared');
              onSaved();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </details>
  );
}

export function RunLibraryPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(async (after: string | null, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listRuns(25, after);
      setRuns((prev) => (append ? [...prev, ...res.runs] : res.runs));
      setCursor(res.next_cursor);
      setNeedsToken(false);
    } catch (e) {
      if (e instanceof ApiError && e.needsOwnerToken) setNeedsToken(true);
      setError(e instanceof ApiError ? e.detail : 'Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  const resume = async (id: string) => {
    setResuming(id);
    try {
      await api.resumeRun(id);
      navigate(`/runs/${id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.detail : 'Could not resume');
      setResuming(null);
    }
  };

  return (
    <div className="page library">
      <header className="page__head row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page__title">Runs</h1>
          <p className="page__lede">Every council run on this server. Open a run to read it, or resume one that stopped.</p>
        </div>
        <Link to="/" className="btn btn--primary">
          New idea
        </Link>
      </header>

      {error && (
        <div className={`notice ${needsToken ? 'notice--warning' : 'notice--danger'}`} role="alert" style={{ marginBottom: 16 }}>
          <span className="grow">{error}</span>
          <button type="button" className="btn btn--sm" onClick={() => load(null, false)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <p className="muted">
          No runs yet. <Link to="/">Start with an idea</Link> or <Link to="/demo">watch the sample run</Link>.
        </p>
      )}

      {runs.length > 0 && (
        <div className="scroll-x">
          <table className="table library__table">
            <thead>
              <tr>
                <th>Run</th>
                <th className="nowrap">Working name</th>
                <th>Status</th>
                <th className="nowrap">Created</th>
                <th className="nowrap">Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/runs/${r.id}`} className="library__title">
                      {r.headline ?? firstSentence(r.idea)}
                    </Link>
                    {r.headline && <div className="muted small">{firstSentence(r.idea)}</div>}
                  </td>
                  <td className="nowrap">{r.working_name ?? <span className="muted">—</span>}</td>
                  <td className="nowrap">
                    <span className={`chip ${STATUS_CHIP[r.status] ?? ''}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </td>
                  <td className="nowrap muted small">{formatDateTime(r.created_at)}</td>
                  <td className="nowrap tabular">{formatUsd(r.total_cost_usd)}</td>
                  <td className="nowrap">
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      {(r.status === 'failed' || r.status === 'cancelled') && (
                        <button type="button" className="btn btn--sm" onClick={() => resume(r.id)} disabled={resuming === r.id}>
                          {resuming === r.id ? 'Resuming…' : 'Resume'}
                        </button>
                      )}
                      <Link to={`/runs/${r.id}`} className="btn btn--sm">
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <p style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => load(cursor, true)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </p>
      )}
      {loading && runs.length === 0 && !error && <p className="muted">Loading…</p>}

      <div className="section">
        <OwnerTokenSettings onSaved={() => load(null, false)} />
      </div>
    </div>
  );
}
