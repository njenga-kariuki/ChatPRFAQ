import React, { useState } from 'react';
import { StepData } from '../types'; // Assuming types.ts is in src/
import Markdown from 'react-markdown'; // We'll add this dependency later

interface StepCardProps {
  step: StepData;
  onToggle: () => void;
  // We might add isInitiallyOpen or similar props if needed for accordion logic
}

const StepCard: React.FC<StepCardProps> = ({ step, onToggle }) => {
  const [activeTab, setActiveTab] = useState('output');

  const getStatusStyles = () => {
    let badgeClasses = 'bg-slate-700/50 border-slate-600/50 text-slate-400';
    let cardHoverClass = 'hover:shadow-slate-500/10'; // Default hover
    let statusIndicatorLineClass = 'from-blue-400'; // Default for active/processing

    switch (step.status) {
      case 'completed':
        badgeClasses = 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400';
        cardHoverClass = 'hover:shadow-green-500/10';
        statusIndicatorLineClass = 'from-green-400';
        break;
      case 'processing':
        badgeClasses = 'bg-amber-500/20 border-amber-500/30 text-amber-400';
        cardHoverClass = 'hover:shadow-amber-500/10';
        // statusIndicatorLineClass remains blue for processing (or could be amber)
        break;
      case 'error':
        badgeClasses = 'bg-red-500/20 border-red-500/30 text-red-400';
        cardHoverClass = 'hover:shadow-red-500/10';
        statusIndicatorLineClass = 'from-red-400'; // Error line color
        break;
      default: // pending
        break;
    }
    return { badgeClasses, cardHoverClass, statusIndicatorLineClass };
  };

  const { badgeClasses, cardHoverClass, statusIndicatorLineClass } = getStatusStyles();

  return (
    <div className="relative group">
      {/* Status indicator line */}
      {(step.isActive || step.status === 'completed' || step.status === 'processing' || step.status === 'error') && (
         <div className={`absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b ${statusIndicatorLineClass} to-transparent opacity-30`}></div>
      )}
      
      <div className={`relative bg-gradient-to-r from-slate-800/50 to-slate-700/30 backdrop-blur-sm border border-slate-600/30 rounded-2xl overflow-hidden shadow-xl ${cardHoverClass} transition-all duration-300`}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-5 text-left focus:outline-none transition duration-150 ease-in-out"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`flex items-center justify-center w-12 h-12 border-2 rounded-xl transition-all ${badgeClasses}`}>
                {step.status === 'processing' && (
                  <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {step.status === 'completed' && <i className="bi bi-check-lg text-lg"></i>}
                {step.status === 'error' && <i className="bi bi-exclamation-triangle text-lg"></i>}
                {(step.status === 'pending' || !step.status) && <span className="font-bold text-lg">{step.id}</span>}
              </div>
              {step.status === 'processing' && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-slate-800 animate-pulse"></div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-sky-300">{step.name}</h3>
              <p className="text-sm text-slate-400">{step.persona}</p>
            </div>
          </div>
          <i className={`bi ${step.isActive ? 'bi-chevron-up' : 'bi-chevron-down'} text-slate-400 text-xl`}></i>
        </button>

        {step.isActive && (
          <div className="border-t border-slate-700/50 bg-slate-800/30">
            <div className="flex border-b border-slate-700/20">
              {[
                { id: 'output', label: 'Output', icon: '📄' },
                { id: 'input', label: 'Input', icon: '📝' },
                { id: 'details', label: 'Details', icon: '⚙️' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors focus:outline-none ${ 
                    activeTab === tab.id 
                      ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="p-6">
              {activeTab === 'output' && (
                step.output ? (
                  <div className="prose prose-slate prose-invert max-w-none">
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-600/20">
                      <Markdown>{step.output}</Markdown>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {step.status === 'processing' ? 'Processing, output will appear here...' : 'No output available for this step.'}
                  </p>
                )
              )}
              
              {activeTab === 'input' && (
                step.input ? (
                  <div className="prose prose-slate prose-invert max-w-none">
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-600/20">
                      <Markdown>{step.input}</Markdown>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No input available for this step.</p>
                )
              )}
              
              {activeTab === 'details' && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-lg font-medium text-white mb-1">Step Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-400">Status</span>
                        <span className="text-white capitalize">{step.status}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-400">Persona</span>
                        <span className="text-white">{step.persona}</span>
                      </div>
                      {step.output && (
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400">Word Count (Output)</span>
                          <span className="text-white">{step.output.split(' ').length} words</span>
                        </div>
                      )}
                      {step.input && (
                        <div className="flex justify-between py-2 border-t border-slate-700/50 pt-2">
                          <span className="text-slate-400">Word Count (Input)</span>
                          <span className="text-white">{step.input.split(' ').length} words</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {step.status === 'error' && step.error && (
                    <div className="space-y-3">
                        <h4 className="text-lg font-medium text-red-400 mb-1">Error Details</h4>
                        <div className="bg-red-900/30 rounded-xl p-4 border border-red-700/50">
                             <p className="text-red-300 text-sm whitespace-pre-wrap">{step.error}</p>
                        </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepCard; 