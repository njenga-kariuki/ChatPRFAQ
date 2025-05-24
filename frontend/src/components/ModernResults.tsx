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
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Success Header */}
      <div className="text-center py-8 px-6 border-b border-gray-100 bg-gray-50">
        <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your Documents Are Ready</h2>
        <p className="text-gray-600">Review your PRFAQ and MLP plan below</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('prfaq')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'prfaq'
                ? 'text-black border-b-2 border-black bg-gray-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            PRFAQ Document
          </button>
          <button
            onClick={() => setActiveTab('mlp')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'mlp'
                ? 'text-black border-b-2 border-black bg-gray-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            MLP Plan
          </button>
        </nav>
      </div>

      {/* Tab Content with Optimal Reading Layout */}
      <div className="px-8 py-12 md:px-16 md:py-16 max-w-4xl mx-auto">
        {activeTab === 'prfaq' && (
          <article className="prose-custom">
            <Markdown>{finalPrfaq}</Markdown>
          </article>
        )}
        
        {activeTab === 'mlp' && (
          <article className="prose-custom">
            <Markdown>{finalMlpPlan}</Markdown>
          </article>
        )}
      </div>
    </div>
  );
};

export default ModernResults; 