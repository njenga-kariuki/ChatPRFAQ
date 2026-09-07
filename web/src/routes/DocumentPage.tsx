import { Link, useSearchParams } from 'react-router-dom';
import type { ValidationPlanOutput } from '../api/model';
import { PressReleaseBlock } from '../components/ArtifactView';
import { DocumentView } from '../components/DocumentView';
import { VERSION_NAMES } from '../lib/council';
import { useHashScroll, useStoredFlag } from '../lib/hooks';
import { useRun } from '../state/RunProvider';
import { finalPrfaq, latestArtifact, versionList } from '../state/runStore';
import { useRunState } from '../state/store';

const SECTIONS = [
  { id: 'executive-summary', label: 'Executive summary' },
  { id: 'press-release', label: 'Press release' },
  { id: 'customer-faq', label: 'Customer FAQ' },
  { id: 'internal-faq', label: 'Internal FAQ' },
  { id: 'research-faq', label: 'Research' },
  { id: 'bar-raiser', label: 'Bar Raiser' },
];

const PLAN_SECTIONS = [
  { id: 'plan-summary', label: 'Summary' },
  { id: 'plan-hypotheses', label: 'Hypotheses' },
  { id: 'plan-sequence', label: 'Sequence' },
  { id: 'plan-tests', label: 'Test plans' },
  { id: 'plan-synthesis', label: 'Synthesis' },
  { id: 'plan-not-testing', label: 'Not testing' },
  { id: 'plan-best-practices', label: 'Best practices' },
];

export function DocumentPage() {
  const state = useRunState();
  const { basePath } = useRun();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'plan' ? 'plan' : 'prfaq';
  const [evidence, setEvidence] = useStoredFlag('chatprfaq.evidence', false);
  const [markers, setMarkers] = useStoredFlag('chatprfaq.markers', false);
  const prfaq = finalPrfaq(state);
  const plan = (latestArtifact(state, 'plan')?.payload as unknown as ValidationPlanOutput | undefined) ?? null;
  const versions = versionList(state);
  useHashScroll(!!prfaq);

  const setTab = (t: 'prfaq' | 'plan') => {
    const next = new URLSearchParams(params);
    if (t === 'plan') next.set('tab', 'plan');
    else next.delete('tab');
    setParams(next, { replace: true });
  };

  if (!prfaq) {
    const latest = versions[versions.length - 1];
    return (
      <div className="page page--narrow">
        <h1 className="page__title">The document is not finished yet</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {state.status === 'completed' ? 'This run finished without a final PRFAQ.' : 'The final PRFAQ arrives when the editor finishes.'}{' '}
          <Link to={`${basePath}/council`}>Watch the council</Link>.
        </p>
        {latest && (
          <section className="section">
            <div className="section__title">
              Latest press release · v{latest.version} {VERSION_NAMES[latest.version]}
            </div>
            <PressReleaseBlock slots={latest.press_release.slots} />
          </section>
        )}
      </div>
    );
  }

  const sections = tab === 'plan' ? PLAN_SECTIONS : SECTIONS.filter((s) => s.id !== 'bar-raiser' || state.barRaiser || latestArtifact(state, 'bar_raiser'));

  return (
    <div className="docpage">
      <div className="docpage__toolbar">
        <div className="seg" role="tablist" aria-label="Document">
          <button type="button" role="tab" className="seg__btn" aria-selected={tab === 'prfaq'} onClick={() => setTab('prfaq')}>
            PRFAQ
          </button>
          <button type="button" role="tab" className="seg__btn" aria-selected={tab === 'plan'} onClick={() => setTab('plan')} disabled={!plan}>
            Validation plan
          </button>
        </div>
        {tab === 'prfaq' && (
          <div className="docpage__toggles">
            <label className="toggle">
              <input type="checkbox" checked={evidence} onChange={(e) => setEvidence(e.target.checked)} />
              <span>Evidence</span>
            </label>
            <label className="toggle toggle--markers">
              <input type="checkbox" checked={markers} onChange={(e) => setMarkers(e.target.checked)} />
              <span>Revision markers</span>
            </label>
          </div>
        )}
      </div>
      <div className="docpage__layout">
        <nav className="docnav" aria-label="Sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="docnav__link">
              {s.label}
            </a>
          ))}
        </nav>
        <div className="docpage__doc">
          <DocumentView prfaq={prfaq} plan={plan} tab={tab} evidence={evidence} markers={markers} />
        </div>
      </div>
    </div>
  );
}
