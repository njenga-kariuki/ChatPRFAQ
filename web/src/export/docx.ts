/* Word exports over the typed model. Typography ported from the previous exporter:
   Calibri 10pt, centred bold headline, centred italic sub-heading, underlined FAQ section
   headers, 0.5in margins, 1.15 line spacing. The redline uses real tracked changes. */

import {
  AlignmentType,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  DeletedTextRun,
  Document,
  InsertedTextRun,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from 'docx';
import type { Finding, PersonaRecord, PressRelease, SlotId, SynthesisOutput, VersionRecord } from '../api/model';
import { CHANGE_KIND_LABELS, SLOT_LABELS, SLOT_ORDER, VERSION_NAMES } from '../lib/council';
import { wordDiff } from '../lib/wordDiff';
import type { EditRef } from '../state/runStore';

const FONT = 'Calibri';
const SIZE = 20; // half-points: 10pt
const LINE = 276; // 1.15
const MARGIN = 720; // 0.5in

interface Style {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  center?: boolean;
  before?: number;
  after?: number;
  indent?: number;
}

const STYLE = {
  title: { bold: true, center: true, after: 240 },
  headline: { bold: true, center: true, after: 240 },
  subheading: { italics: true, center: true, after: 360 },
  body: { after: 120 },
  sectionHeader: { bold: true, underline: true, before: 480, after: 240 },
  subSectionHeader: { bold: true, before: 240, after: 120 },
  question: { bold: true, after: 60 },
  answer: { after: 240 },
  quote: { italics: true, indent: 720, before: 120, after: 120 },
  note: { after: 60 },
} satisfies Record<string, Style>;

function runOptions(style: Style) {
  return {
    font: FONT,
    size: SIZE,
    bold: !!style.bold,
    italics: !!style.italics,
    ...(style.underline ? { underline: { type: UnderlineType.SINGLE } } : {}),
  };
}

type Child = TextRun | InsertedTextRun | DeletedTextRun | CommentRangeStart | CommentRangeEnd;

function para(children: Child[], style: Style): Paragraph {
  return new Paragraph({
    children,
    alignment: style.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: style.before ?? 0, after: style.after ?? 120, line: LINE },
    ...(style.indent ? { indent: { left: style.indent } } : {}),
  });
}

function text(value: string, style: Style): Paragraph {
  return para([new TextRun({ text: value, ...runOptions(style) })], style);
}

function slotStyle(id: SlotId): Style {
  if (id === 'headline') return STYLE.headline;
  if (id === 'subheading') return STYLE.subheading;
  return STYLE.body;
}

function orderedSlots(pr: PressRelease) {
  return SLOT_ORDER.map((id) => pr.slots.find((s) => s.id === id)).filter((s): s is PressRelease['slots'][number] => !!s);
}

function documentFor(children: Paragraph[], title: string, comments?: { id: number; author: string; initials?: string; date: Date; children: Paragraph[] }[]): Document {
  return new Document({
    creator: 'ChatPRFAQ',
    title,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    ...(comments && comments.length ? { comments: { children: comments } } : {}),
    sections: [
      {
        properties: { page: { margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        children,
      },
    ],
  });
}

function faqParagraphs(prfaq: SynthesisOutput): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(text('Customer FAQ', STYLE.sectionHeader));
  prfaq.customer_faq.forEach((item, i) => {
    out.push(text(`${i + 1}. ${item.question}`, STYLE.question));
    out.push(text(item.answer, STYLE.answer));
  });
  out.push(text('Internal FAQ', STYLE.sectionHeader));
  let n = 1;
  for (const section of prfaq.internal_faq) {
    out.push(text(section.title, STYLE.subSectionHeader));
    for (const item of section.items) {
      out.push(text(`${n}. ${item.question}`, STYLE.question));
      out.push(text(item.answer, STYLE.answer));
      n += 1;
    }
  }
  if (prfaq.research_faq) {
    out.push(text('Research', STYLE.subSectionHeader));
    out.push(text(`${n}. ${prfaq.research_faq.question}`, STYLE.question));
    out.push(text(prfaq.research_faq.answer, STYLE.answer));
  }
  return out;
}

/** The clean executive PRFAQ. */
export function cleanDocument(prfaq: SynthesisOutput): Document {
  const children: Paragraph[] = [];
  children.push(text(prfaq.title, STYLE.title));
  children.push(text('Executive Summary', STYLE.sectionHeader));
  children.push(text(prfaq.executive_summary, STYLE.body));
  children.push(text('Press Release', STYLE.sectionHeader));
  for (const slot of orderedSlots(prfaq.press_release)) children.push(text(slot.text, slotStyle(slot.id)));
  children.push(...faqParagraphs(prfaq));
  return documentFor(children, prfaq.title);
}

export interface RedlineInput {
  title: string;
  versions: VersionRecord[];
  from: number;
  to: number;
  roster: PersonaRecord[];
  editsInRange: EditRef[];
  findings: Finding[];
  /** ISO end time per producing seat, for the tracked-change date. */
  endedAt: (seat: string, version: number) => string | null;
  prfaq: SynthesisOutput | null;
}

/** Tracked changes from one version to another, attributed to the persona who made each edit. */
export function redlineDocument(input: RedlineInput): Document {
  const { versions, from, to, roster, findings } = input;
  const vFrom = versions.find((v) => v.version === from);
  const vTo = versions.find((v) => v.version === to);
  if (!vFrom || !vTo) throw new Error('Both versions are required for a redline');
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? id;
  const initialsOf = (id: string) => roster.find((p) => p.id === id)?.initials ?? id.slice(0, 2).toUpperCase();
  const children: Paragraph[] = [];
  const comments: { id: number; author: string; initials?: string; date: Date; children: Paragraph[] }[] = [];
  let changeId = 1;
  let commentId = 0;

  children.push(text(input.title, STYLE.title));
  children.push(
    text(
      `Tracked changes from v${from} (${VERSION_NAMES[from] ?? ''}) to v${to} (${VERSION_NAMES[to] ?? ''}). Each change is attributed to the colleague who made it; their reasons are in the comments and under Reviewer notes.`,
      STYLE.body,
    ),
  );
  if (input.prfaq?.executive_summary && to === Math.max(...versions.map((v) => v.version))) {
    children.push(text('Executive Summary', STYLE.sectionHeader));
    children.push(text(input.prfaq.executive_summary, STYLE.body));
  }
  children.push(text('Press Release', STYLE.sectionHeader));

  for (const slotId of SLOT_ORDER) {
    const before = vFrom.press_release.slots.find((s) => s.id === slotId)?.text ?? '';
    const after = vTo.press_release.slots.find((s) => s.id === slotId)?.text ?? '';
    const style = slotStyle(slotId);
    if (before === after) {
      children.push(text(after, style));
      continue;
    }
    const refs = input.editsInRange.filter((r) => r.edit.slot_id === slotId);
    const last = refs[refs.length - 1];
    const authorPersona = last?.persona ?? vTo.persona;
    const author = nameOf(authorPersona);
    const seat = last?.seat ?? vTo.produced_by_seat;
    const version = last?.version ?? vTo.version;
    const date = input.endedAt(seat, version) ?? new Date().toISOString();
    const runs: Child[] = [];
    const ids: number[] = [];
    for (const ref of refs) {
      commentId += 1;
      ids.push(commentId);
      const lines: Paragraph[] = [
        text(`v${ref.version} · ${CHANGE_KIND_LABELS[ref.edit.change_kind]} · ${SLOT_LABELS[slotId]}`, STYLE.note),
        text(ref.edit.rationale, STYLE.note),
      ];
      for (const fid of ref.edit.evidence_finding_ids) {
        const f = findings.find((x) => x.id === fid);
        lines.push(text(`Evidence ${fid}${f ? `: ${f.claim}${f.metric ? ` (${f.metric})` : ''}` : ''}`, STYLE.note));
      }
      comments.push({ id: commentId, author: nameOf(ref.persona), initials: initialsOf(ref.persona), date: new Date(input.endedAt(ref.seat, ref.version) ?? date), children: lines });
    }
    for (const id of ids) runs.push(new CommentRangeStart(id));
    for (const seg of wordDiff(before, after)) {
      if (seg.op === 0) runs.push(new TextRun({ text: seg.text, ...runOptions(style) }));
      else if (seg.op === 1) runs.push(new InsertedTextRun({ text: seg.text, id: changeId++, author, date, ...runOptions(style) }));
      else runs.push(new DeletedTextRun({ text: seg.text, id: changeId++, author, date, ...runOptions(style) }));
    }
    for (const id of ids) runs.push(new CommentRangeEnd(id));
    const refRuns = ids.map((id) => new TextRun({ children: [new CommentReference(id)] }));
    children.push(para([...runs, ...refRuns], style));
  }

  if (input.prfaq && to === Math.max(...versions.map((v) => v.version))) {
    children.push(...faqParagraphs(input.prfaq));
  }

  children.push(text('Reviewer notes', STYLE.sectionHeader));
  if (!input.editsInRange.length) children.push(text('No edits were recorded in this range.', STYLE.body));
  for (const ref of input.editsInRange) {
    children.push(text(`v${ref.version} · ${SLOT_LABELS[ref.edit.slot_id]} · ${nameOf(ref.persona)} · ${CHANGE_KIND_LABELS[ref.edit.change_kind]}`, STYLE.question));
    const evidence = ref.edit.evidence_finding_ids
      .map((fid) => {
        const f = findings.find((x) => x.id === fid);
        return f ? `${fid}: ${f.claim}` : fid;
      })
      .join('; ');
    children.push(text(evidence ? `${ref.edit.rationale} Evidence: ${evidence}` : ref.edit.rationale, STYLE.answer));
  }

  return documentFor(children, `${input.title} redline`, comments);
}

export async function toBlob(doc: Document): Promise<Blob> {
  return Packer.toBlob(doc);
}
