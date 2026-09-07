import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { SynthesisOutput, ValidationPlanOutput } from '../api/model';
import { planMarkdown, prfaqMarkdown, redlineMarkdown } from '../export/markdown';
import { downloadBlob, downloadText, safeFileStem } from '../lib/download';
import { useRun } from '../state/RunProvider';
import { allEdits, finalPrfaq, latestArtifact, versionList } from '../state/runStore';
import { useRunState } from '../state/store';
import { DownloadIcon } from './Icons';
import { useToast } from './Toast';

// The Word writer is the heaviest dependency in the app; load it only when an export is requested.
const loadDocx = () => import('../export/docx');

interface Props {
  from?: number;
  to?: number;
}

interface Item {
  id: string;
  title: string;
  description: string;
  disabled?: boolean;
  run: () => Promise<void>;
}

export function ExportMenu({ from, to }: Props) {
  const { source } = useRun();
  const state = useRunState();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const prfaq = finalPrfaq(state);
  const plan = latestArtifact(state, 'plan')?.payload as unknown as ValidationPlanOutput | null;
  const versions = versionList(state);
  const maxV = versions.length ? versions[versions.length - 1].version : 0;
  const rFrom = from ?? 1;
  const rTo = to ?? maxV;
  const stem = safeFileStem(state.framing?.working_name ?? state.headline);
  const serverId = source.kind === 'demo' ? null : state.runId;

  const endedAt = (seat: string, _version: number) => {
    const list = state.steps[seat] ?? [];
    const done = list.filter((a) => a.status === 'done' && a.endedAt);
    return done.length ? done[done.length - 1].endedAt : null;
  };

  const items: Item[] = [
    {
      id: 'docx',
      title: 'Word (.docx)',
      description: 'Clean PRFAQ in the executive format.',
      disabled: !prfaq,
      run: async () => {
        const { cleanDocument, toBlob } = await loadDocx();
        const blob = await toBlob(cleanDocument(prfaq as SynthesisOutput));
        downloadBlob(blob, `${stem}-prfaq.docx`);
      },
    },
    {
      id: 'docx-redline',
      title: `Word redline (.docx), v${rFrom} → v${rTo}`,
      description: 'Tracked changes attributed to the reviewers, rationales as comments.',
      disabled: versions.length < 2 || rFrom >= rTo,
      run: async () => {
        const { redlineDocument, toBlob } = await loadDocx();
        const doc = redlineDocument({
          title: prfaq?.title ?? `${state.framing?.working_name ?? 'PRFAQ'} press release`,
          versions,
          from: rFrom,
          to: rTo,
          roster: state.roster,
          editsInRange: allEdits(state, rFrom, rTo),
          findings: state.findings,
          endedAt,
          prfaq,
        });
        downloadBlob(await toBlob(doc), `${stem}-redline-v${rFrom}-v${rTo}.docx`);
      },
    },
    {
      id: 'md',
      title: 'Markdown',
      description: 'The PRFAQ as Markdown.',
      disabled: !prfaq,
      run: async () => {
        if (serverId) {
          const { text, filename } = await api.fetchExport(serverId, 'md');
          downloadText(text, filename, 'text/markdown;charset=utf-8');
        } else downloadText(prfaqMarkdown(prfaq as SynthesisOutput), `${stem}-prfaq.md`, 'text/markdown;charset=utf-8');
      },
    },
    {
      id: 'plan',
      title: 'Validation plan (Markdown)',
      description: 'Hypotheses, sequence and test plans.',
      disabled: !plan,
      run: async () => {
        if (serverId) {
          const { text, filename } = await api.fetchExport(serverId, 'plan');
          downloadText(text, filename, 'text/markdown;charset=utf-8');
        } else downloadText(planMarkdown(plan as ValidationPlanOutput), `${stem}-validation-plan.md`, 'text/markdown;charset=utf-8');
      },
    },
    {
      id: 'redline-md',
      title: `Redline (Markdown), v${rFrom} → v${rTo}`,
      description: 'CriticMarkup insertions, deletions and reviewer notes.',
      disabled: versions.length < 2 || rFrom >= rTo,
      run: async () => {
        if (serverId) {
          const { text, filename } = await api.fetchExport(serverId, 'redline', rFrom, rTo);
          downloadText(text, filename, 'text/markdown;charset=utf-8');
        } else downloadText(redlineMarkdown(versions, rFrom, rTo, state.roster), `${stem}-redline.md`, 'text/markdown;charset=utf-8');
      },
    },
    {
      id: 'json',
      title: 'JSON',
      description: 'Everything the council produced, as data.',
      run: async () => {
        if (serverId) {
          const { text, filename } = await api.fetchExport(serverId, 'json');
          downloadText(text, filename, 'application/json');
        } else {
          const { connection: _c, loadError: _e, ...rest } = state;
          downloadText(JSON.stringify(rest, null, 2), `${stem}-run.json`, 'application/json');
        }
      },
    },
  ];

  const onRun = async (item: Item) => {
    setBusy(item.id);
    try {
      await item.run();
      setOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="menu-host" ref={ref}>
      <button type="button" className="btn btn--sm" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <DownloadIcon size={14} />
        <span className="btn__label">Export</span>
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Export">
          {items.map((item) => (
            <button key={item.id} type="button" role="menuitem" className="menu__item" disabled={item.disabled || busy !== null} onClick={() => onRun(item)}>
              <span className="menu__title">{busy === item.id ? 'Preparing…' : item.title}</span>
              <span className="menu__desc">{item.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
