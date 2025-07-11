import React, { useState, useEffect, useRef } from 'react';
import { StepData } from '../types'; // Assuming types.ts is in src/
import Markdown from 'react-markdown'; // We'll add this dependency later
import remarkGfm from 'remark-gfm';
import { ContentProcessor } from '../utils/contentProcessor';
import CopyButton from './CopyButton';

interface StepCardProps {
  step: StepData;
  onToggle: () => void;
}

// FAQ Fix Wrapper - Only for Step 8 External FAQ
const FAQFixWrapper: React.FC<{ children: React.ReactNode; stepId: number; content: string }> = ({ 
  children, 
  stepId, 
  content 
}) => {
  const [isFixed, setIsFixed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only apply to Step 8 with broken FAQ patterns
    const shouldApplyFix = stepId === 8 && 
                          content.includes('**Question:**') &&
                          content.includes('**Answer:**');

    if (!shouldApplyFix) {
      setIsFixed(true); // Show immediately if no fix needed
      return;
    }

    // Apply FAQ fix after render
    const applyFix = () => {
      if (!containerRef.current) return;

      try {
        const container = containerRef.current;
        
        // Find broken FAQ patterns in rendered DOM
        const paragraphs = container.querySelectorAll('p');
        let fixesApplied = false;

        paragraphs.forEach(p => {
          const text = p.textContent || '';
          
          // Look for "Question:" without bold formatting
          if (text.includes('Question:') && !p.querySelector('strong')) {
            // Fix broken question formatting
            const questionMatch = text.match(/(\d+\.\s+)(Question:)\s*(.+?)\s*(Answer:)\s*(.+)/);
            if (questionMatch) {
              const [, number, questionLabel, questionText, answerLabel, answerText] = questionMatch;
              
              // Reconstruct with proper formatting
              p.innerHTML = `
                ${number}<strong>${questionLabel}</strong> ${questionText.trim()}
                <br><br>
                <strong>${answerLabel}</strong> ${answerText.trim()}
              `;
              fixesApplied = true;
            }
          }
        });

        if (fixesApplied) {
          console.log('FAQ fixes applied to Step 8');
        }
        
        setIsFixed(true);
      } catch (error) {
        console.warn('FAQ fix failed, showing original content:', error);
        setIsFixed(true); // Show original content if fix fails
      }
    };

    // Apply fix after DOM renders
    const timeoutId = setTimeout(applyFix, 50);
    
    // Safety timeout: always show content within 200ms
    const safetyTimeoutId = setTimeout(() => setIsFixed(true), 200);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(safetyTimeoutId);
    };
  }, [stepId, content]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        opacity: isFixed ? 1 : 0,
        transition: 'opacity 150ms ease-in-out'
      }}
    >
      {children}
    </div>
  );
};

const StepCard: React.FC<StepCardProps> = ({ step, onToggle }) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>;
      case 'processing':
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>;
      default:
        return <span className="text-gray-400 font-medium text-sm">{step.id}</span>;
    }
  };

  if (step.status === 'pending') return null;

  return (
    <div id={`step-${step.id}`} className={`
      step-card group relative bg-white rounded-2xl border transition-all duration-200
      ${step.status === 'processing' ? 'border-blue-200 shadow-lg shadow-blue-100/50' :
        step.status === 'completed' ? 'border-gray-200 hover:border-gray-300 hover:shadow-lg' :
        step.status === 'error' ? 'border-red-200' :
        'border-gray-200 opacity-60'}
    `}>
      {/* Status indicator bar */}
      <div className={`
        absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300
        ${step.status === 'completed' ? 'bg-green-500' :
          step.status === 'processing' ? 'bg-blue-500 animate-pulse' :
          step.status === 'error' ? 'bg-red-500' :
          'bg-gray-200'}
      `} />
      
      {/* Header with hover effect */}
      <button
        onClick={onToggle}
        className="w-full px-8 py-6 relative overflow-hidden group/header group/insight-hover focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-gray-50/50 rounded-t-2xl"
      >
        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/0 via-gray-50/50 to-gray-50/0 opacity-0 group-hover/header:opacity-100 transition-opacity duration-300" />
        
        <div className="step-card-header relative">
          <div className="step-info-section flex items-center gap-4">
            {/* Modern status icon */}
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
              ${step.status === 'completed' ? 'bg-green-100' :
                step.status === 'processing' ? 'bg-blue-100' :
                step.status === 'error' ? 'bg-red-100' :
                'bg-gray-100'}
            `}>
              {getStatusIcon()}
            </div>
            
            <div className="text-left">
              <h3 className="font-semibold text-gray-900" style={{fontSize: '16px'}}>{step.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{step.persona}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Key insight display - updated with inline expansion */}
            {step.status === 'completed' && step.keyInsight && !step.isActive && (
              <div className="step-insight-container">
                {/* Normal truncated insight - hidden on hover */}
                <span className="step-insight group-hover/insight-hover:opacity-0 transition-opacity duration-200">
                  {step.insightLabel && (
                    <span className="insight-label">{step.insightLabel}</span>
                  )}
                  {step.keyInsight}
                </span>
              </div>
            )}
            
            {/* Expanded insight overlay - shows on hover */}
            {step.status === 'completed' && step.keyInsight && !step.isActive && (
              <div className="absolute inset-y-0 right-16 w-102 opacity-0 group-hover/insight-hover:opacity-100 transition-opacity duration-200 flex items-center pointer-events-none">
                <div className="text-gray-600 text-sm font-semibold leading-tight whitespace-normal pr-4 text-center">
                  {step.insightLabel && (
                    <span className="text-gray-500 font-medium text-xs mr-1.5">{step.insightLabel}</span>
                  )}
                  {step.keyInsight}
                </div>
              </div>
            )}
            
            {/* Animated chevron */}
            <svg className={`w-5 h-5 text-gray-400 transition-all duration-300 ${step.isActive ? 'rotate-180' : 'group-hover/header:translate-y-0.5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Content - Collapsible with smooth transition */}
      <div className={`step-card-content overflow-hidden transition-all duration-300 ease-in-out ${step.isActive ? 'max-h-none' : 'max-h-0'}`}>
        <div className="px-8 pb-8 pt-4 border-t border-gray-100">
          {step.output ? (
            <div className="relative">
              {/* Copy button positioned at top-right of content */}
              {step.status === 'completed' && (
                <div className="absolute top-0 right-0">
                  <CopyButton 
                    content={step.output}
                    variant="icon"
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                    iconSize="sm"
                  />
                </div>
              )}
              
              {/* Existing content with responsive padding to accommodate copy button */}
              <div className="pr-12">
                <FAQFixWrapper stepId={step.id} content={step.output}>
                  <div className="prose-custom">
                    <Markdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({children}) => <p style={{marginBottom: '1.5rem', lineHeight: '1.7'}}>{children}</p>,
                        table: ({children}) => (
                          <div className="overflow-x-auto my-6">
                            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({children}) => (
                          <thead className="bg-gray-50">{children}</thead>
                        ),
                        th: ({children}) => (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r last:border-r-0">
                            {children}
                          </th>
                        ),
                        td: ({children}) => (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r last:border-r-0">
                            {children}
                          </td>
                        ),
                        tr: ({children}) => (
                          <tr className="border-b hover:bg-gray-50 transition-colors">{children}</tr>
                        )
                      }}
                    >
                      {ContentProcessor.processContent(step.output)}
                    </Markdown>
                  </div>
                </FAQFixWrapper>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              {step.status === 'processing' ? (
                <div>
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-gray-500">Working on this step...</p>
                </div>
              ) : (
                <p className="text-gray-500">No output available yet</p>
              )}
            </div>
          )}
          
          {step.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{step.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepCard; 