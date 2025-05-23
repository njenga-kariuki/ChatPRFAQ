import React from 'react';
import Markdown from 'react-markdown';
import { StepData } from '../types'; // Assuming StepData is in types.ts at src/types.ts

interface ModernResultsProps {
  finalPrfaq: string;
  finalMlpPlan: string;
  productIdea: string; // Added as per App.tsx usage, though not in original plan's interface
  stepsData: StepData[];
}

const ModernResults: React.FC<ModernResultsProps> = ({ finalPrfaq, finalMlpPlan, productIdea, stepsData }) => {
  // Calculate stats
  const wordsGenerated = (finalPrfaq + finalMlpPlan).split(' ').filter(Boolean).length;
  const stepsCompleted = stepsData.filter(s => s.status === 'completed').length;
  // const totalSteps = stepsData.length; // If you want to show X out of Y steps

  // State for tab management (similar to StepCard)
  const [activeTab, setActiveTab] = React.useState('prfaq');

  return (
    <div>
      {/* Success Header with Stats */}
      <div className="text-center mb-10"> {/* Increased mb-8 to mb-10 */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full mb-5 shadow-lg shadow-emerald-500/25"> {/* Increased mb-4 to mb-5 */}
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Analysis Complete!</h2> {/* Increased mb-2 to mb-3, added md:text-4xl */}
        <p className="text-lg text-slate-400 max-w-xl mx-auto">Your product concept has been evaluated. Review the generated documents below.</p>
        
        {/* Stats Row */}
        <div className="flex items-center justify-center gap-6 md:gap-8 mt-8 text-sm text-slate-400"> {/* Increased gap, md:gap, mt-6 to mt-8 */}
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-white">{wordsGenerated}</div>
            <div>Words Generated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-white">{stepsCompleted}</div>
            <div>Steps Completed</div>
          </div>
          {/* Optional: Product Idea Display (if needed here) */}
          {/* <div className="text-center">
            <div className="text-2xl font-bold text-white">Idea</div>
            <div className="truncate w-32">{productIdea}</div>
          </div> */}
        </div>
      </div>

      {/* Tab Navigation for Results */}
      <div className="flex border-b border-slate-700/40 mb-6">
        {[
          { id: 'prfaq', label: 'PRFAQ Document', icon: '📰' },
          { id: 'mlp', label: 'MLP Plan', icon: '🛠️' },
          // Optional: Tab for original idea or full step summary
          // { id: 'summary', label: 'Evaluation Summary', icon: '📊' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-base font-medium transition-colors focus:outline-none ${ 
              activeTab === tab.id 
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]"> {/* Added min-height to prevent layout shifts */}
        {activeTab === 'prfaq' && finalPrfaq && (
          <div className="prose prose-slate prose-invert max-w-none">
            <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-700/30 shadow-md">
              <Markdown>{finalPrfaq}</Markdown>
            </div>
          </div>
        )}
        
        {activeTab === 'mlp' && finalMlpPlan && (
          <div className="prose prose-slate prose-invert max-w-none">
            <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-700/30 shadow-md">
              <Markdown>{finalMlpPlan}</Markdown>
            </div>
          </div>
        )}
        
        {/* Placeholder for other tabs if added */}
        {/* {activeTab === 'summary' && ( ... ) } */}
      </div>
    </div>
  );
};

export default ModernResults; 