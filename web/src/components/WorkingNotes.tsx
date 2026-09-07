interface Props {
  text: string;
  personaName?: string;
  open?: boolean;
  streaming?: boolean;
}

export function WorkingNotes({ text, personaName, open = false, streaming = false }: Props) {
  if (!text) return null;
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  return (
    <details className="notes" open={open || undefined}>
      <summary className="notes__summary">Working notes{personaName ? ` · ${personaName}` : ''}</summary>
      <div className={`notes__body${streaming ? ' is-streaming' : ''}`}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </details>
  );
}
