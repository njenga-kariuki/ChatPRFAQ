import React from 'react';
import Markdown from 'react-markdown';
import { StepData } from '../types'; // Assuming StepData is in types.ts at src/types.ts
import { ContentProcessor } from '../utils/contentProcessor';
import CopyButton from './CopyButton';
import CopyToast from './CopyToast';

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
  
  // State for copy toast
  const [showToast, setShowToast] = React.useState(false);

  const handleCopySuccess = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Success Header */}
      <div className="text-center py-8 px-6 border-b border-gray-100 bg-gray-50">
        <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-semibold text-gray-900 mb-2" style={{fontSize: '22px'}}>Your Documents Are Ready</h2>
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
          <div className="relative">
            {/* Copy button positioned at top-right */}
            <div className="absolute -top-10 right-0">
              <CopyButton 
                content={ContentProcessor.processContent(finalPrfaq)}
                variant="icon"
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                iconSize="sm"
                onCopySuccess={handleCopySuccess}
              />
            </div>
            <article className="prose-custom">
              <Markdown 
                components={{
                  p: ({children}) => <p style={{marginBottom: '2rem', lineHeight: '1.7'}}>{children}</p>
                }}
              >
                {ContentProcessor.processContent(finalPrfaq)}
              </Markdown>
            </article>
          </div>
        )}
        
        {activeTab === 'mlp' && (
          <div className="relative">
            {/* Copy button positioned at top-right */}
            <div className="absolute -top-10 right-0">
              <CopyButton 
                content={ContentProcessor.processContent(finalMlpPlan)}
                variant="icon"
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                iconSize="sm"
                onCopySuccess={handleCopySuccess}
              />
            </div>
            <article className="prose-custom">
              <Markdown 
                components={{
                  p: ({children}) => <p style={{marginBottom: '2rem', lineHeight: '1.7'}}>{children}</p>
                }}
              >
                {ContentProcessor.processContent(finalMlpPlan)}
              </Markdown>
            </article>
          </div>
        )}
      </div>

      {/* Copy Toast */}
      <CopyToast show={showToast} />
    </div>
  );
};

export default ModernResults; 