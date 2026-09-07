import { useEffect, useRef, useState } from 'react';
import { KIND_VERSION } from '../lib/council';
import { usePrefersReducedMotion } from '../lib/hooks';
import { latestAttempt, liveSeat } from '../state/runStore';
import { useRunSelector } from '../state/store';
import { HandoffConnector } from './HandoffConnector';
import { ArrowDown } from './Icons';
import { StepCard } from './StepCard';

/** Ordered step cards with handoff connectors and chat-style auto-follow. */
export function CouncilTimeline() {
  const seats = useRunSelector((s) => s.seats);
  const live = useRunSelector((s) => liveSeat(s)?.id ?? null);
  const liveLen = useRunSelector((s) => (live ? (latestAttempt(s, live)?.text.length ?? 0) : 0));
  const reduced = usePrefersReducedMotion();
  const following = useRef(true);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    if (!live) {
      setShowJump(false);
      return;
    }
    const onScroll = () => {
      const el = document.getElementById(`seat-${live}`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const distance = rect.bottom - window.innerHeight;
      const near = distance < 120 && rect.top < window.innerHeight;
      following.current = near;
      setShowJump(!near);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [live]);

  useEffect(() => {
    if (!live || !following.current) return;
    const el = document.getElementById(`seat-${live}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const delta = rect.bottom - window.innerHeight + 24;
    if (delta > 0) window.scrollBy({ top: delta, behavior: 'auto' });
  }, [live, liveLen]);

  const jump = () => {
    const el = live ? document.getElementById(`seat-${live}`) : null;
    if (!el) return;
    following.current = true;
    const rect = el.getBoundingClientRect();
    window.scrollBy({ top: rect.bottom - window.innerHeight + 24, behavior: reduced ? 'auto' : 'smooth' });
    setShowJump(false);
  };

  return (
    <div className="timeline">
      {seats.map((seat, i) => {
        const prev = i > 0 ? seats[i - 1] : null;
        const upstreamVersion = prev ? (KIND_VERSION[prev.produces] ?? null) : null;
        return (
          <div key={seat.id} className="timeline__item">
            {prev && <HandoffConnector seat={seat} upstreamVersion={upstreamVersion} />}
            <StepCard seat={seat} isLive={live === seat.id} />
          </div>
        );
      })}
      {showJump && live && (
        <button type="button" className="jump-live" onClick={jump}>
          <ArrowDown size={14} />
          Jump to live
        </button>
      )}
    </div>
  );
}
