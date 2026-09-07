import { readFileSync } from 'node:fs';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { RunSnapshot, SynthesisOutput } from '../api/model';
import { allEdits, finalPrfaq, hydrate, initialState, versionList } from '../state/runStore';
import { cleanDocument, redlineDocument } from './docx';

const snapshot = JSON.parse(readFileSync(new URL('../../fixtures/run.snapshot.json', import.meta.url), 'utf8')) as RunSnapshot;
const state = hydrate(initialState(), snapshot);
const prfaq = finalPrfaq(state) as SynthesisOutput;

async function unzip(doc: ReturnType<typeof cleanDocument>) {
  const buffer = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buffer);
  const read = async (name: string) => (await zip.file(name)?.async('string')) ?? '';
  return { size: buffer.length, document: await read('word/document.xml'), comments: await read('word/comments.xml'), styles: await read('word/styles.xml') };
}

describe('docx exports', () => {
  it('builds the clean PRFAQ with the legacy typography', async () => {
    const out = await unzip(cleanDocument(prfaq));
    expect(out.size).toBeGreaterThan(5000);
    expect(out.document).toContain('Executive Summary');
    expect(out.document).toContain(prfaq.press_release.slots[0].text);
    expect(out.document).toContain('w:jc w:val="center"');
    expect(out.document).toContain('w:u w:val="single"');
    expect(out.document).toContain('w:i');
    expect(out.styles).toContain('Calibri');
    expect(out.document).toContain('w:sz w:val="20"');
    expect(out.document).toContain('Customer FAQ');
    expect(out.document).toContain('Internal FAQ');
  });

  it('builds a redline with tracked changes attributed to the reviewers', async () => {
    const versions = versionList(state);
    const doc = redlineDocument({
      title: prfaq.title,
      versions,
      from: 1,
      to: 4,
      roster: state.roster,
      editsInRange: allEdits(state, 1, 4),
      findings: state.findings,
      endedAt: () => '2026-09-07T04:54:51.000Z',
      prfaq,
    });
    const out = await unzip(doc);
    expect(out.document).toContain('<w:ins ');
    expect(out.document).toContain('<w:del ');
    expect(out.document).toContain('w:author="VP Product"');
    expect(out.document).toContain('w:author="Senior Editor"');
    expect(out.document).toContain('w:author="Principal PM"');
    expect(out.document).toContain('w:commentRangeStart');
    expect(out.comments).toContain('<w:comment ');
    expect(out.comments).toContain('w:author="VP Product"');
    expect(out.comments).toContain('Named the segment the research supports');
    expect(out.document).toContain('Reviewer notes');
  });
});
