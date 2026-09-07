/* Client-side Markdown, used when there is no server export (the demo replay). Mirrors
   the backend's SynthesisOutput.markdown() and the redline's CriticMarkup. */

import type { PersonaRecord, SynthesisOutput, ValidationPlanOutput, VersionRecord } from '../api/model';
import { PHASE_LABELS, SLOT_ORDER, priorityScore } from '../lib/council';
import { wordDiff } from '../lib/wordDiff';

export function pressReleaseMarkdown(pr: SynthesisOutput['press_release']): string {
  const parts: string[] = [];
  for (const id of SLOT_ORDER) {
    const s = pr.slots.find((x) => x.id === id);
    if (!s) continue;
    if (id === 'headline') parts.push(`**${s.text.trim()}**`);
    else if (id === 'subheading') parts.push(`*${s.text.trim()}*`);
    else parts.push(s.text.trim());
  }
  return parts.join('\n\n');
}

export function prfaqMarkdown(p: SynthesisOutput): string {
  const out: string[] = [`### **${p.title}**`, '', '### **Executive Summary**', '', p.executive_summary, ''];
  out.push('### **Press Release**', '', pressReleaseMarkdown(p.press_release), '');
  out.push('### **Customer FAQ**', '');
  p.customer_faq.forEach((item, i) => out.push(`${i + 1}. **Question:** ${item.question}`, `**Answer:** ${item.answer}`, ''));
  out.push('### **Internal FAQ**', '');
  let n = 1;
  for (const section of p.internal_faq) {
    out.push(`**${section.title}**`, '');
    for (const item of section.items) {
      out.push(`${n}. **Question:** ${item.question}`, `**Answer:** ${item.answer}`, '');
      n += 1;
    }
  }
  out.push(`${n}. **Question:** ${p.research_faq.question}`, `**Answer:** ${p.research_faq.answer}`, '');
  return `${out.join('\n').trimEnd()}\n`;
}

export function planMarkdown(p: ValidationPlanOutput): string {
  const out: string[] = ['# Validation plan', '', p.executive_summary, '', '## Hypotheses (ranked)', ''];
  out.push('| # | Hypothesis | Phase | Impact | Confidence | Ease | Priority |', '|---|---|---|---|---|---|---|');
  const ranked = [...p.hypotheses].sort((a, b) => priorityScore(b) - priorityScore(a));
  for (const h of ranked) out.push(`| ${h.id} | ${h.statement} | ${PHASE_LABELS[h.phase]} | ${h.impact} | ${h.confidence} | ${h.ease} | ${priorityScore(h)} |`);
  out.push('', '## Sequence', '');
  for (const s of p.sequence) out.push(`### ${PHASE_LABELS[s.phase]}`, '', `Hypotheses: ${s.hypothesis_ids.join(', ')}`, '', s.rationale, '', `Decision point: ${s.decision_point}`, '');
  out.push('## Test plans', '');
  for (const t of p.test_plans) {
    out.push(`### ${t.hypothesis_id} · ${t.method}`, '', `- Build: ${t.build}`, `- Success criteria: ${t.success_criteria}`, `- Sample size: ${t.sample_size}`, `- Risks: ${t.risks}`, `- Tools: ${t.tools.join(', ')}`, '');
  }
  out.push('## Synthesis', '', `- Proceed: ${p.synthesis.proceed}`, `- Iterate: ${p.synthesis.iterate}`, `- Stop: ${p.synthesis.stop}`, '');
  out.push('## Not testing', '');
  for (const x of p.not_testing) out.push(`- ${x.aspect}: ${x.why}`);
  out.push('', '## Best practices', '', `- Biggest pitfall: ${p.best_practices.biggest_pitfall}`, `- First test: ${p.best_practices.first_test}`, `- Recruitment: ${p.best_practices.recruitment}`, `- Prototype fidelity: ${p.best_practices.prototype_fidelity}`, '');
  return out.join('\n');
}

/** CriticMarkup redline: {++ins++}, {--del--}, {>>Persona: rationale<<}. */
export function redlineMarkdown(versions: VersionRecord[], from: number, to: number, roster: PersonaRecord[]): string {
  const vFrom = versions.find((v) => v.version === from);
  const vTo = versions.find((v) => v.version === to);
  if (!vFrom || !vTo) return '';
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? id;
  const out: string[] = [`# Redline v${from} → v${to}`, ''];
  for (const id of SLOT_ORDER) {
    const before = vFrom.press_release.slots.find((s) => s.id === id)?.text ?? '';
    const after = vTo.press_release.slots.find((s) => s.id === id)?.text ?? '';
    if (before === after) {
      out.push(after, '');
      continue;
    }
    const marked = wordDiff(before, after)
      .map((seg) => (seg.op === 0 ? seg.text : seg.op === 1 ? `{++${seg.text}++}` : `{--${seg.text}--}`))
      .join('');
    const notes = versions
      .filter((v) => v.version > from && v.version <= to)
      .flatMap((v) => v.edits.filter((e) => e.slot_id === id).map((e) => `{>>${nameOf(v.persona)}: ${e.rationale}<<}`));
    out.push(`${marked}${notes.length ? ` ${notes.join(' ')}` : ''}`, '');
  }
  return out.join('\n');
}
