import { Link } from 'react-router-dom';
import { IdeaComposer } from '../components/IdeaComposer';
import { PersonaMonogram } from '../components/PersonaMonogram';
import { KIND_VERSION, VERSION_NAMES } from '../lib/council';
import { useRosterAndSeats } from '../lib/roster';

export function LandingPage() {
  const { roster, seats } = useRosterAndSeats();
  const checkpoints = seats
    .filter((s) => KIND_VERSION[s.produces])
    .map((s) => ({ version: KIND_VERSION[s.produces] as number, seat: s, persona: roster.find((p) => p.id === s.persona) }));

  return (
    <div className="landing">
      <section className="hero">
        <h1 className="hero__title">Put the idea in front of a council before you put it in front of leadership.</h1>
        <p className="hero__lede">
          ChatPRFAQ runs a Working Backwards council over a product idea: colleagues research the market, validate the problem with a panel, draft
          the press release, pressure-test it, and edit it into an executive PRFAQ, with every claim tied to a finding and every edit tied to its author.
        </p>
        <IdeaComposer />
        <p className="hero__links small">
          <Link to="/demo">Watch a sample run</Link>
          <span className="muted"> · </span>
          <Link to="/how-it-works">How it works</Link>
        </p>
      </section>

      <section className="section roster">
        <h2 className="section__title">The council</h2>
        <div className="roster__grid">
          {roster.map((p) => (
            <article key={p.id} className="persona card">
              <div className="card__body">
                <div className="persona__head">
                  <PersonaMonogram persona={p} size={36} />
                  <div>
                    <div className="persona__name">{p.name}</div>
                    <div className="persona__title muted small">{p.title}</div>
                  </div>
                </div>
                <p className="persona__how">{p.how_i_review}</p>
                <div className="persona__seats">
                  {p.seats.map((id) => {
                    const seat = seats.find((s) => s.id === id);
                    return seat ? (
                      <span key={id} className="chip chip--muted">
                        {seat.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section checkpoints">
        <h2 className="section__title">Four press-release checkpoints</h2>
        <div className="checkpoints__row">
          {checkpoints.map((c) => (
            <div key={c.version} className="checkpoint">
              <span className="chip chip--version">v{c.version}</span>
              <div className="checkpoint__name">{VERSION_NAMES[c.version]}</div>
              <div className="checkpoint__by">
                <PersonaMonogram persona={c.persona} size={20} />
                <span className="small">{c.persona?.name}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          Each version keeps the same eight paragraphs, so every change can be read as a redline with the reviewer's reason and evidence beside it.
        </p>
      </section>
    </div>
  );
}
