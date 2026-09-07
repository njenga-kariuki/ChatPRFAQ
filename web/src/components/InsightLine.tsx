interface Props {
  label: string;
  text: string | null | undefined;
  pending?: boolean;
  compact?: boolean;
}

export function InsightLine({ label, text, pending = false, compact = false }: Props) {
  if (!text && !pending) return null;
  return (
    <div className={`insight${compact ? ' insight--compact' : ''}`}>
      <span className="insight__label">{label}</span>
      {text ? <span className="insight__text">{text}</span> : <span className="insight__text skeleton">Distilling…</span>}
    </div>
  );
}
