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
        return <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>;
      case 'processing':
        return <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>;
      case 'error':
        return <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>;
      default:
        return <span className="text-gray-400 font-medium">{step.id}</span>;
    }
  };

  if (step.status === 'pending') return null;

  return (
    <div id={`step-${step.id}`} className="bg-white rounded-xl border border-gray-100 mb-8 overflow-hidden">
      {/* Header - Fully Clickable */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">{step.name}</h3>
              <p className="text-sm text-gray-500">{step.persona}</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${step.isActive ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content - Collapsible with improved spacing */}
      {step.isActive && (
        <div className="p-8 md:p-12">
          {/* Key Insight for research steps */}
          {step.status === 'completed' && [2, 6].includes(step.id) && step.keyInsight && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600">💡</span>
                <span className="text-sm font-medium text-green-800">Key Insight</span>
              </div>
              <p className="text-sm text-green-700">
                {step.keyInsight}
              </p>
            </div>
          )}
          
          {step.output ? (
            <div>
              <div className="prose-custom">
                <Markdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({children}) => <p style={{marginBottom: '1.5rem', lineHeight: '1.7'}}>{children}</p>,
                    table: ({children}) => (
                      <div className="overflow-x-auto my-6">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
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
                      <tr className="border-b hover:bg-gray-50">{children}</tr>
                    )
                  }}
                >
                  {ContentProcessor.processContent(step.output)}
                </Markdown>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {step.status === 'processing' ? 
                'Working on this step...' : 
                'No output available yet'
              }
            </div>
          )}
          
          {step.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{step.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StepCard; 