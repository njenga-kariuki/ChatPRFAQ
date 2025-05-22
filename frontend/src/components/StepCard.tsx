import React from 'react';
import { StepData } from '../types'; // Assuming types.ts is in src/
import Markdown from 'react-markdown'; // We'll add this dependency later

interface StepCardProps {
  step: StepData;
  onToggle: () => void;
  // We might add isInitiallyOpen or similar props if needed for accordion logic
}

const StepCard: React.FC<StepCardProps> = ({ step, onToggle }) => {
  const getStatusColor = () => {
    switch (step.status) {
      case 'completed':
        return 'border-green-500';
      case 'processing':
        return 'border-yellow-500';
      case 'error':
        return 'border-red-500';
      default:
        return 'border-gray-600';
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg shadow-md overflow-hidden border-l-4 ${getStatusColor()}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-700 focus:outline-none focus:bg-gray-700 transition duration-150 ease-in-out"
      >
        <div className="flex items-center">
          <span 
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full mr-3 text-sm font-semibold 
              ${step.status === 'completed' ? 'bg-green-500 text-white' : 
                step.status === 'processing' ? 'bg-yellow-500 text-gray-800' : 
                step.status === 'error' ? 'bg-red-500 text-white' : 'bg-gray-600 text-gray-300'}
            `}
          >
            {step.status === 'processing' && (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {step.status === 'completed' && <i className="bi bi-check-lg"></i>}
            {step.status === 'error' && <i className="bi bi-exclamation-triangle"></i>}
            {(step.status === 'pending' || !step.status) && step.id}
          </span>
          <div>
            <h3 className="text-lg font-semibold text-sky-300">{step.name}</h3>
            <p className="text-sm text-gray-400">{step.persona}</p>
          </div>
        </div>
        <i className={`bi ${step.isActive ? 'bi-chevron-up' : 'bi-chevron-down'} text-gray-400`}></i>
      </button>

      {step.isActive && (
        <div className="p-4 border-t border-gray-700">
          {step.status === 'error' && step.error && (
            <div className="mb-3 p-3 bg-red-900 border border-red-700 rounded-md">
              <h5 className="font-semibold text-red-300 mb-1">Error:</h5>
              <p className="text-red-300 text-sm whitespace-pre-wrap">{step.error}</p>
            </div>
          )}
          {(step.status === 'completed' || step.status === 'processing') && (
            <>
              {step.input && (
                <div className="mb-3">
                  <h5 className="font-semibold text-gray-300 mb-1">Input:</h5>
                  {/* Using a div for now, replace with Markdown renderer later */}
                  <div className="prose prose-sm prose-invert max-w-none p-3 bg-gray-900 rounded-md text-gray-300 whitespace-pre-wrap">
                    <Markdown>{step.input}</Markdown>
                  </div>
                </div>
              )}
              {step.output && (
                <div>
                  <h5 className="font-semibold text-gray-300 mb-1">Output:</h5>
                   {/* Using a div for now, replace with Markdown renderer later */}
                  <div className="prose prose-sm prose-invert max-w-none p-3 bg-gray-900 rounded-md text-gray-300 whitespace-pre-wrap">
                     <Markdown>{step.output}</Markdown>
                  </div>
                </div>
              )}
              {step.status === 'processing' && !step.output && (
                <p className="text-sm text-yellow-400">Processing, output will appear here...</p>
              )}
            </>
          )}
          {step.status === 'pending' && (
             <p className="text-sm text-gray-500">This step is pending.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StepCard; 