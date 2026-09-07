import { useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { domainOf } from '../lib/format';
import { ExternalIcon } from './Icons';

interface Props {
  text: string;
  streaming?: boolean;
  className?: string;
  doc?: boolean;
}

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <span>{children}</span>;
  const text = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '';
  const isRaw = text.trim() === href.trim();
  const domain = domainOf(href);
  return (
    <a href={href} target="_blank" rel="noreferrer" className="srclink">
      <span>{isRaw ? domain : children}</span>
      {!isRaw && <span className="srclink__domain">{domain}</span>}
      <ExternalIcon size={12} />
    </a>
  );
}

const components = { a: MarkdownLink };

/** Closed blocks render as markdown; the open tail renders as plain text until it closes. */
export function StreamingMarkdown({ text, streaming = false, className = '', doc = false }: Props) {
  const { closed, tail } = useMemo(() => {
    if (!streaming) return { closed: text, tail: '' };
    const idx = text.lastIndexOf('\n\n');
    if (idx < 0) return { closed: '', tail: text };
    return { closed: text.slice(0, idx), tail: text.slice(idx + 2) };
  }, [text, streaming]);
  const rendered = useMemo(
    () =>
      closed ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {closed}
        </ReactMarkdown>
      ) : null,
    [closed],
  );
  return (
    <div className={`prose${doc ? ' prose--doc' : ''} ${className}`}>
      {rendered}
      {streaming ? <p className="tail caret">{tail}</p> : null}
    </div>
  );
}
