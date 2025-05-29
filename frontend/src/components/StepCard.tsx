import React from 'react';
import { StepData } from '../types'; // Assuming types.ts is in src/
import Markdown from 'react-markdown'; // We'll add this dependency later
import remarkGfm from 'remark-gfm';
import { ContentProcessor } from '../utils/contentProcessor';

interface StepCardProps {
  step: StepData;
  onToggle: () => void;
}

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
      group relative bg-white rounded-2xl border transition-all duration-200
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
        className="w-full px-8 py-6 relative overflow-hidden group/header focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-gray-50/50 rounded-t-2xl"
      >
        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/0 via-gray-50/50 to-gray-50/0 opacity-0 group-hover/header:opacity-100 transition-opacity duration-300" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
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
              <h3 className="font-semibold text-gray-900 text-lg">{step.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{step.persona}</p>
            </div>
          </div>
          
          {/* Key insight display - updated with new classes and spacing */}
          {step.status === 'completed' && step.keyInsight && !step.isActive && (
            <div className="step-insight-container">
              <span className="step-insight">
                {step.insightLabel && (
                  <span className="insight-label">{step.insightLabel}</span>
                )}
                {step.keyInsight}
              </span>
            </div>
          )}
          
          {/* Animated chevron */}
          <svg className={`w-5 h-5 text-gray-400 transition-all duration-300 ${step.isActive ? 'rotate-180' : 'group-hover/header:translate-y-0.5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content - Collapsible with smooth transition */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${step.isActive ? 'max-h-[5000px]' : 'max-h-0'}`}>
        <div className="px-8 pb-8 pt-4 border-t border-gray-100">
          {step.output ? (
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