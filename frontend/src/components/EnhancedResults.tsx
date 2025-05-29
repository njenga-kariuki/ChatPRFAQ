import React, { useState, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { StepData, PRVersions, ResearchArtifacts } from '../types';
import PressReleaseEvolution from './PressReleaseEvolution';
import ResearchArtifactsView from './ResearchArtifactsView';
import StepsDisplay from './StepsDisplay';
import { ContentProcessor } from '../utils/contentProcessor';

interface EnhancedResultsProps {
  finalPrfaq: string;
  finalMlpPlan: string;
  productIdea: string;
  stepsData: StepData[];
  prVersions: PRVersions;
  researchArtifacts: ResearchArtifacts;
  onNewIdea: () => void;
}

type TabType = 'final' | 'evolution' | 'research' | 'process';

const EnhancedResults: React.FC<EnhancedResultsProps> = ({
  finalPrfaq,
  finalMlpPlan,
  productIdea,
  stepsData,
  prVersions,
  researchArtifacts,
  onNewIdea
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('final');
  const [finalDocTab, setFinalDocTab] = useState<'prfaq' | 'mlp'>('prfaq');
  
  // Local state for step toggling in results view
  const [localStepsData, setLocalStepsData] = useState<StepData[]>([]);
  
  // Initialize local steps data when stepsData prop changes
  useEffect(() => {
    // Initialize with all steps closed for clean UX in results view
    setLocalStepsData(stepsData.map(step => ({ ...step, isActive: false })));
  }, [stepsData]);
  
  // Handle step toggling for results view
  const handleStepToggle = (stepId: number) => {
    setLocalStepsData(prev => prev.map(step => 
      step.id === stepId ? { ...step, isActive: !step.isActive } : step
    ));
  };
  
  const tabs: Array<{ id: TabType; label: string; available: boolean }> = [
    { id: 'final', label: 'Final Documents', available: true },
    { id: 'evolution', label: 'PR Evolution', available: Object.keys(prVersions).length > 0 },
    { id: 'research', label: 'Research Artifacts', available: Object.keys(researchArtifacts).length > 0 },
    { id: 'process', label: 'Process', available: true }
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-semibold">ChatPRFAQ</h1>
          <button
            onClick={onNewIdea}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            New Idea →
          </button>
        </div>
      </header>
      
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <nav className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => tab.available && setActiveTab(tab.id)}
                disabled={!tab.available}
                className={`
                  px-6 py-4 text-sm font-medium transition-colors relative
                  ${tab.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                  ${activeTab === tab.id
                    ? 'text-black border-b-2 border-black'
                    : 'text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                {tab.label}
                {!tab.available && (
                  <span className="ml-2 text-xs text-gray-400">(Not available)</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'final' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Sub-tabs for PRFAQ and MLP */}
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setFinalDocTab('prfaq')}
                  className={`
                    flex-1 py-4 px-6 text-center font-medium transition-colors
                    ${finalDocTab === 'prfaq'
                      ? 'text-black bg-gray-50 border-b-2 border-black'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  PRFAQ Document
                </button>
                <button
                  onClick={() => setFinalDocTab('mlp')}
                  className={`
                    flex-1 py-4 px-6 text-center font-medium transition-colors
                    ${finalDocTab === 'mlp'
                      ? 'text-black bg-gray-50 border-b-2 border-black'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  MLP Plan
                </button>
              </nav>
            </div>
            
            {/* Document Content */}
            <div className="p-8 md:p-16 max-w-4xl mx-auto">
              {finalDocTab === 'prfaq' ? (
                <MarkdownRenderer 
                  content={ContentProcessor.processContent(finalPrfaq)} 
                  variant="standard"
                />
              ) : (
                <MarkdownRenderer 
                  content={ContentProcessor.processContent(finalMlpPlan)} 
                  variant="standard"
                />
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'evolution' && (
          <PressReleaseEvolution versions={prVersions} />
        )}
        
        {activeTab === 'research' && (
          <ResearchArtifactsView artifacts={researchArtifacts} />
        )}
        
        {activeTab === 'process' && (
          <div className="bg-white rounded-xl p-8">
            <h3 className="text-xl font-semibold mb-6">Process Steps</h3>
            <StepsDisplay 
              steps={localStepsData} 
              onToggleStep={handleStepToggle} 
              isVisible={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedResults; 