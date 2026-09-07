import { useState } from 'react';
import { CheckIcon, CopyIcon } from './Icons';
import { useToast } from './Toast';

interface Props {
  text: string | (() => string);
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ text, label = 'Copy', className = '', size = 'sm' }: Props) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const onClick = async () => {
    const value = typeof text === 'function' ? text() : text;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('Could not copy to the clipboard');
    }
  };
  return (
    <button type="button" className={`btn btn--quiet ${size === 'sm' ? 'btn--sm' : ''} ${className}`} onClick={onClick} aria-label={label}>
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}
