import type { CSSProperties } from 'react';
import type { PersonaRecord } from '../api/model';
import { isPair } from '../lib/council';

interface Props {
  persona: PersonaRecord | undefined;
  size?: 20 | 24 | 28 | 36;
  working?: boolean;
  muted?: boolean;
  className?: string;
}

export function personaVars(persona: PersonaRecord | undefined): CSSProperties {
  const hue = persona?.hue ?? 0;
  return { '--hue': `var(--persona-${hue})`, '--hue-bg': `var(--persona-${hue}-bg)` } as CSSProperties;
}

export function PersonaMonogram({ persona, size = 28, working = false, muted = false, className = '' }: Props) {
  const initials = persona?.initials ?? '··';
  const pair = persona ? isPair(persona) : false;
  const cls = `monogram monogram--${size}${working ? ' is-working' : ''}${muted ? ' is-muted' : ''}${pair ? ' monogram--pair' : ''} ${className}`;
  const title = persona ? `${persona.name} — ${persona.title}` : undefined;
  if (pair) {
    return (
      <span className={cls} style={personaVars(persona)} title={title} aria-label={persona?.name}>
        <span className="monogram__disc">{initials.slice(0, 1)}</span>
        <span className="monogram__disc monogram__disc--second">{initials.slice(1, 2)}</span>
      </span>
    );
  }
  return (
    <span className={cls} style={personaVars(persona)} title={title} aria-label={persona?.name}>
      <span className="monogram__disc">{initials}</span>
    </span>
  );
}
