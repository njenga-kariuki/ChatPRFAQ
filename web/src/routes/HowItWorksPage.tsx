import { Link } from 'react-router-dom';
import { PersonaMonogram } from '../components/PersonaMonogram';
import { KIND_TITLES, KIND_VERSION, VERSION_NAMES, seatPhases } from '../lib/council';
import { useRosterAndSeats } from '../lib/roster';

export function HowItWorksPage() {
  const { roster, seats } = useRosterAndSeats();
  const phases = seatPhases(seats);
  const personaOf = (id: string) => roster.find((p) => p.id === id);
  const checkpoints = seats.filter((s) => KIND_VERSION[s.produces]);

  return (
    <div className="page how">
      <header className="page__head">
        <h1 className="page__title">“Can't I just ask any model for a PRFAQ?”</h1>
        <p className="page__lede">
          Yes, and you will get something that looks like one in thirty seconds. What a one-shot answer skips is the review: research with sources, a
          panel that argues back, an executive who cuts unsupported claims, and an editor who has to justify every change. ChatPRFAQ runs that review as
          a council of colleagues and keeps the paper trail.
        </p>
      </header>

      <section className="section">
        <h2 className="section__title">The process</h2>
        <div className="how__phases">
          {phases.map((ph, i) => (
            <div key={ph.phase} className="how__phase card">
              <div className="card__body">
                <div className="how__phase-title">
                  <span className="muted tabular">{i + 1}</span> {ph.phase}
                </div>
                <ol className="how__seats">
                  {ph.seats.map((seat) => {
                    const p = personaOf(seat.persona);
                    return (
                      <li key={seat.id} className="how__seat">
                        <PersonaMonogram persona={p} size={24} />
                        <div>
                          <div className="how__seat-name">{seat.name}</div>
                          <div className="muted small">
                            {p?.name} · produces {KIND_TITLES[seat.produces].toLowerCase()}
                            {seat.depends_on.length ? ` · reads ${seat.depends_on.map((k) => KIND_TITLES[k].toLowerCase()).join(', ')}` : ''}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          Nothing expensive runs until you have reviewed the brief. The internal FAQ and the concept panel run side by side; everything else waits for
          its inputs, so the sequence is intentional and visible.
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">Four press-release checkpoints</h2>
        <div className="how__checkpoints">
          {checkpoints.map((seat) => {
            const v = KIND_VERSION[seat.produces] as number;
            const p = personaOf(seat.persona);
            return (
              <div key={seat.id} className="how__checkpoint">
                <div className="row">
                  <span className="chip chip--version">v{v}</span>
                  <strong>{VERSION_NAMES[v]}</strong>
                </div>
                <div className="how__checkpoint-by">
                  <PersonaMonogram persona={p} size={20} />
                  <span>{p?.name}</span>
                </div>
                <p className="small muted">{p?.how_i_review}</p>
              </div>
            );
          })}
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          Every version keeps the same eight paragraphs: headline, sub-heading, summary, problem, solution, benefits, internal quote, and how to get
          started. Each reviewer returns surgical edits with a one-sentence rationale and the findings that justify it, so the evolution reads as a
          redline with provenance rather than a pile of rewrites.
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">The council</h2>
        <div className="how__roster">
          {roster.map((p) => (
            <div key={p.id} className="how__person">
              <PersonaMonogram persona={p} size={28} />
              <div>
                <div className="how__person-name">
                  {p.name} <span className="muted small">· {p.title}</span>
                </div>
                <div className="small">{p.how_i_review}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">What you get</h2>
        <ul className="how__list">
          <li>An executive PRFAQ: summary, press release, customer FAQ, internal FAQ and a research synthesis, exportable to Word.</li>
          <li>The press release's evolution: four versions, every edit with its author, rationale and evidence, as a redline you can walk through.</li>
          <li>An evidence ledger of findings and sources, with backlinks to every place a finding is used.</li>
          <li>A hypothesis-driven validation plan: ranked hypotheses, a sequence, and frugal test designs.</li>
          <li>An independent Bar Raiser score against a fixed rubric, with the fixes applied before you see the final document.</li>
        </ul>
        <p style={{ marginTop: 16 }}>
          <Link to="/" className="btn btn--primary">
            Start with an idea
          </Link>{' '}
          <Link to="/demo" className="btn">
            Watch a sample run
          </Link>
        </p>
      </section>
    </div>
  );
}
