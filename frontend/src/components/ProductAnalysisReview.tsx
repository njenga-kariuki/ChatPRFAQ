import React, { useState, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface ProductAnalysisReviewProps {
  productIdea: string;
  analysis: string;
  onConfirm: (enrichedBrief: string) => void;
  onRefine: (feedback: FeedbackData) => void;
  isRefining: boolean;
}

interface FeedbackData {
  customer: string;
  problem: string;
  scope: string;
}

interface AnalysisSection {
  title: string;
  content: string;
  key: keyof FeedbackData;
  icon: string;
}

const ProductAnalysisReview: React.FC<ProductAnalysisReviewProps> = ({
  productIdea,
  analysis,
  onConfirm,
  onRefine,
  isRefining
}) => {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData>({
    customer: '',
    problem: '',
    scope: ''
  });
  const [sections, setSections] = useState<AnalysisSection[]>([]);
  const [isCreatingBrief, setIsCreatingBrief] = useState(false);

  // Parse analysis into sections
  useEffect(() => {
    const parseAnalysis = () => {
      const customerMatch = analysis.match(/\*\*Target Customer:\*\*(.*?)(?=\*\*|$)/s);
      const problemMatch = analysis.match(/\*\*Customer Problem:\*\*(.*?)(?=\*\*|$)/s);
      const scopeMatch = analysis.match(/\*\*Product Scope:\*\*(.*?)(?=\*\*|$)/s);

      return [
        {
          title: 'Target Customer',
          content: customerMatch ? customerMatch[1].trim() : 'Analysis section not found',
          key: 'customer' as keyof FeedbackData,
          icon: '👥'
        },
        {
          title: 'Customer Problem',
          content: problemMatch ? problemMatch[1].trim() : 'Analysis section not found',
          key: 'problem' as keyof FeedbackData,
          icon: '⚡'
        },
        {
          title: 'Product Scope',
          content: scopeMatch ? scopeMatch[1].trim() : 'Analysis section not found',
          key: 'scope' as keyof FeedbackData,
          icon: '🎯'
        }
      ];
    };

    setSections(parseAnalysis());
  }, [analysis]);

  const handleFeedbackChange = (key: keyof FeedbackData, value: string) => {
    setFeedback(prev => ({ ...prev, [key]: value }));
  };

  const handleRefineSubmit = () => {
    onRefine(feedback);
    setShowFeedbackForm(false);
    setFeedback({ customer: '', problem: '', scope: '' });
  };

  const handleConfirm = async () => {
    setIsCreatingBrief(true);
    try {
      // Create enriched brief by calling the backend
      const response = await fetch('/api/create_enriched_brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_idea: productIdea,
          analysis: analysis
        }),
      });

      let enrichedBrief = productIdea; // Fallback to original
      if (response.ok) {
        const result = await response.json();
        enrichedBrief = result.brief || productIdea;
      }

      onConfirm(enrichedBrief);
    } catch (error) {
      console.error('Failed to create enriched brief:', error);
      onConfirm(productIdea); // Fallback to original
    } finally {
      setIsCreatingBrief(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Loading Overlay for Refinement */}
      {isRefining && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Refining Analysis</h3>
            <p className="text-gray-600">Incorporating your feedback to improve the analysis...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10">
        <h3 className="text-3xl font-bold text-gray-900 mb-3">Review Your Input Brief</h3>
        <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
          We've framed your target customer, problem, and scope. These inputs will guide the team's work. Refine or continue to build your PRFAQ.
        </p>
      </div>

      {/* Analysis Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {sections.map((section) => (
          <div key={section.key} className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">{section.icon}</span>
              <span>{section.title}</span>
            </h4>
            <div className="prose-custom text-gray-600 text-sm leading-relaxed">
              <MarkdownRenderer 
                content={section.content} 
                variant="standard"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <div className="bg-blue-50 rounded-2xl p-8 border border-blue-100 mt-8">
          <h4 className="text-xl font-semibold text-gray-900 mb-6">Provide Feedback</h4>
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {section.title} Feedback
                </label>
                <textarea
                  value={feedback[section.key]}
                  onChange={(e) => handleFeedbackChange(section.key, e.target.value)}
                  placeholder={`How can we improve the ${section.title.toLowerCase()} definition?`}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 resize-none"
                  rows={3}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleRefineSubmit}
                disabled={isRefining}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:opacity-50 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-gray-900/20 hover:transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500/20"
              >
                {isRefining ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    <span>Refining...</span>
                  </>
                ) : (
                  'Apply Refinements'
                )}
              </button>
              <button
                onClick={() => setShowFeedbackForm(false)}
                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium rounded-xl transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <button
          onClick={handleConfirm}
          disabled={isCreatingBrief}
          className="flex items-center justify-center px-8 py-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-gray-900/20 hover:transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:hover:transform-none disabled:hover:shadow-none"
        >
          {isCreatingBrief ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              <span>Creating Brief...</span>
            </>
          ) : (
            'Continue'
          )}
        </button>
        <button
          onClick={() => setShowFeedbackForm(!showFeedbackForm)}
          disabled={isRefining || isCreatingBrief}
          className="flex items-center justify-center px-8 py-4 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:opacity-50 text-gray-700 border border-gray-200 font-semibold rounded-xl transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:hover:transform-none disabled:hover:shadow-none"
        >
          {showFeedbackForm ? 'Hide Feedback' : 'Refine'}
        </button>
      </div>
    </div>
  );
};

export default ProductAnalysisReview; 