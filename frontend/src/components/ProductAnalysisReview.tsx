import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';

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
          key: 'customer' as keyof FeedbackData
        },
        {
          title: 'Customer Problem',
          content: problemMatch ? problemMatch[1].trim() : 'Analysis section not found',
          key: 'problem' as keyof FeedbackData
        },
        {
          title: 'Product Scope',
          content: scopeMatch ? scopeMatch[1].trim() : 'Analysis section not found',
          key: 'scope' as keyof FeedbackData
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg className="animate-spin h-8 w-8 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Refining Analysis</h3>
            <p className="text-gray-600">Incorporating your feedback to improve the analysis...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Review Your Input Brief</h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Here's how we've framed your target customer, problem, and scope. These inputs will guide the team's work. Refine or continue to build your PRFAQ.
        </p>
      </div>

      {/* Analysis Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {sections.map((section) => (
          <div key={section.key} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{section.title}</h4>
            <div className="prose-custom">
              <Markdown>{section.content}</Markdown>
            </div>
          </div>
        ))}
      </div>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-6">Provide Feedback</h4>
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {section.title} Feedback
                </label>
                <textarea
                  value={feedback[section.key]}
                  onChange={(e) => handleFeedbackChange(section.key, e.target.value)}
                  placeholder={`Provide specific feedback for the ${section.title} section...`}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 transition-colors resize-none"
                  rows={3}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleRefineSubmit}
                disabled={isRefining}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-400 disabled:opacity-50 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {isRefining ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refining...
                  </>
                ) : (
                  'Apply Refinements'
                )}
              </button>
              <button
                onClick={() => setShowFeedbackForm(false)}
                className="px-4 py-3 bg-white hover:bg-gray-50 text-black border border-gray-300 font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleConfirm}
          disabled={isCreatingBrief}
          className="flex items-center justify-center px-8 py-4 bg-black hover:bg-gray-800 disabled:bg-gray-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          {isCreatingBrief ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Brief...
            </>
          ) : (
            'Continue'
          )}
        </button>
        <button
          onClick={() => setShowFeedbackForm(!showFeedbackForm)}
          disabled={isRefining || isCreatingBrief}
          className="flex items-center justify-center px-8 py-4 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:opacity-50 text-black border border-gray-300 font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          {showFeedbackForm ? 'Hide Feedback' : 'Refine'}
        </button>
      </div>
    </div>
  );
};

export default ProductAnalysisReview; 