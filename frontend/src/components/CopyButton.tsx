import React, { useState } from 'react';

interface CopyButtonProps {
  content: string;
  variant?: 'icon' | 'text' | 'iconWithText';
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
  onCopySuccess?: () => void;
}

const CopyButton: React.FC<CopyButtonProps> = ({ 
  content, 
  variant = 'icon',
  className = '',
  iconSize = 'md',
  onCopySuccess
}) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopySuccess?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      onCopySuccess?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const CopyIcon = () => (
    <svg className={iconSizeClasses[iconSize]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );

  const CheckIcon = () => (
    <svg className={iconSizeClasses[iconSize]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCopy}
        className={`
          relative p-2 text-gray-500 hover:text-gray-700 
          hover:bg-gray-50 rounded-lg transition-all duration-200 
          focus:outline-none focus:ring-2 focus:ring-gray-500/20
          ${copied ? 'text-gray-900 bg-gray-50' : ''}
          ${className}
        `}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    );
  }

  if (variant === 'text') {
    return (
      <button
        onClick={handleCopy}
        className={`px-4 py-2 text-sm font-medium ${copied ? 'text-gray-900' : 'text-gray-700'} hover:bg-gray-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500/20 ${className}`}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    );
  }

  // variant === 'iconWithText'
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${copied ? 'text-gray-700' : 'text-gray-500'} hover:text-gray-700 hover:bg-gray-50/80 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500/20 focus:ring-offset-1 ${className}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
};

export default CopyButton; 