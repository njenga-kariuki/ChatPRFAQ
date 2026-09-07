import type { Finding, Source } from '../api/model';
import { domainOf, formatDate } from '../lib/format';
import { ExternalIcon } from './Icons';

interface Props {
  sources: Source[];
  findings: Finding[];
  retrievedAt?: string | null;
}

export function SourcesTable({ sources, findings, retrievedAt }: Props) {
  if (!sources.length) return <p className="muted">No sources yet.</p>;
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th>Id</th>
            <th>Source</th>
            <th>Domain</th>
            <th className="nowrap">Cited by</th>
            <th>Cited text</th>
            <th className="nowrap">Retrieved</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const n = findings.filter((f) => f.source_ids.includes(s.id)).length;
            return (
              <tr key={s.id} id={`source-${s.id}`}>
                <td className="mono nowrap">{s.id}</td>
                <td>
                  <a href={s.url} target="_blank" rel="noreferrer" className="srclink">
                    <span>{s.title}</span>
                    <ExternalIcon size={12} />
                  </a>
                </td>
                <td className="nowrap muted">{domainOf(s.url)}</td>
                <td className="tabular">
                  {n} {n === 1 ? 'finding' : 'findings'}
                </td>
                <td className="small">“{s.cited_text}”</td>
                <td className="nowrap muted small">{formatDate(retrievedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
