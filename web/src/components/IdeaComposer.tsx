import { useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';

const EXAMPLES = [
  'A bookkeeping service that closes the books for independent restaurants every month, with a reviewed close and a short exception list the owner clears from a phone.',
  'A scheduling assistant for home-care agencies that fills last-minute shift gaps by texting qualified carers in the right postcode first.',
  'A returns desk for independent online shops that prints the label, tracks the parcel and issues store credit without the owner touching it.',
  'A weekly one-page cash forecast for freelance designers, built from their invoices and bank feed, with a plain-language warning when a dry month is coming.',
];

export function IdeaComposer() {
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const tooShort = idea.trim().length < 10;

  const submit = async () => {
    if (tooShort || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { run_id } = await api.createRun(idea.trim());
      navigate(`/runs/${run_id}/brief`);
    } catch (e) {
      if (e instanceof ApiError) setError(e.detail);
      else setError('Could not reach the server. Is the backend running?');
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="idea" className="visually-hidden">
        Your product idea
      </label>
      <textarea
        id="idea"
        className="composer__input"
        placeholder="Describe the product idea in a sentence or two: who it is for and what it does for them."
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={onKey}
        rows={4}
        autoFocus
      />
      <div className="composer__row">
        <span className="composer__hint muted small">Enter to convene the council · Shift+Enter for a new line</span>
        <button type="submit" className="btn btn--primary btn--lg" disabled={tooShort || busy}>
          {busy ? 'Convening…' : 'Convene the council'}
        </button>
      </div>
      {error && (
        <div className="notice notice--danger" role="alert">
          <span className="grow">{error}</span>
          {error.toLowerCase().includes('owner token') && (
            <Link to="/runs" className="btn btn--sm">
              Settings
            </Link>
          )}
        </div>
      )}
      <div className="composer__examples">
        <span className="muted small">Try an example</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="example" onClick={() => setIdea(ex)}>
            {ex.split(' ').slice(0, 7).join(' ')}…
          </button>
        ))}
      </div>
    </form>
  );
}
