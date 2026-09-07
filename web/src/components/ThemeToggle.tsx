import { useEffect, useState } from 'react';
import { applyTheme, getTheme, nextTheme, setTheme, type ThemeChoice } from '../lib/theme';
import { MoonIcon, SunIcon, SystemIcon } from './Icons';

const LABELS: Record<ThemeChoice, string> = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => getTheme());
  useEffect(() => applyTheme(choice), [choice]);
  const onClick = () => {
    const next = nextTheme(choice);
    setTheme(next);
    setChoice(next);
  };
  const Icon = choice === 'light' ? SunIcon : choice === 'dark' ? MoonIcon : SystemIcon;
  return (
    <button type="button" className="btn btn--quiet btn--sm" onClick={onClick} aria-label={`${LABELS[choice]} (click to change)`} title={LABELS[choice]}>
      <Icon size={15} />
    </button>
  );
}
