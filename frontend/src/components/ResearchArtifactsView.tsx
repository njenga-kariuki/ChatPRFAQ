import React, { useState } from 'react';
import { ResearchArtifacts } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface ResearchArtifactsViewProps {
  artifacts: ResearchArtifacts;
}

const ResearchArtifactsView: React.FC<ResearchArtifactsViewProps> = ({ artifacts }) => {
  const [selectedReport, setSelectedReport] = useState<keyof ResearchArtifacts | null>(null);
  
  const reports = [
    {
      key: 'marketResearch' as keyof ResearchArtifacts,
      title: 'Market Research',
      icon: '📊',
      description: 'Competitive analysis, market sizing, and industry trends',
      stats: {
        label: 'Industry Size',
        value: artifacts.marketResearch?.match(/\$[\d.]+[BMK]/)?.[0] || 'Analyzed'
      }
    },
    {
      key: 'problemValidation' as keyof ResearchArtifacts,
      title: 'Problem Validation',
      icon: '🔍',
      description: 'Customer interviews and pain point analysis',
      stats: {
        label: 'Interviews',
        value: '10 Customers'
      }
    },
    {
      key: 'conceptValidation' as keyof ResearchArtifacts,
      title: 'Concept Testing',
      icon: '✅',
      description: 'Solution validation with target users',
      stats: {
        label: 'Participants',
        value: '10 Users'
      }
    }
  ];
  
  return (
    <div className="bg-white rounded-xl p-8">
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-2">Research & Validation Reports</h3>
        <p className="text-gray-600">
          These comprehensive reports informed your PRFAQ. Each represents real analysis specific to your product idea.
        </p>
      </div>
      
      {/* Report Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {reports.map(report => {
          const isAvailable = !!artifacts[report.key];
          
          return (
            <button
              key={report.key}
              onClick={() => isAvailable && setSelectedReport(report.key)}
              disabled={!isAvailable}
              className={`
                p-6 rounded-xl border-2 text-left transition-all
                ${isAvailable 
                  ? 'border-gray-200 hover:border-black hover:shadow-lg cursor-pointer' 
                  : 'border-gray-100 opacity-50 cursor-not-allowed'
                }
              `}
            >
              <div className="text-3xl mb-3">{report.icon}</div>
              <h4 className="font-semibold text-lg mb-2">{report.title}</h4>
              <p className="text-sm text-gray-600 mb-4">{report.description}</p>
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-gray-500">{report.stats.label}</span>
                  <p className="font-semibold">{report.stats.value}</p>
                </div>
                {isAvailable && (
                  <span className="text-sm text-black font-medium">
                    View Report →
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Report Modal */}
      {selectedReport && artifacts[selectedReport] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl max-h-[90vh] w-full overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-semibold">
                {reports.find(r => r.key === selectedReport)?.title}
              </h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <MarkdownRenderer 
                content={artifacts[selectedReport]} 
                variant="standard"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchArtifactsView; 