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
  icon: string;
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
          icon: '👥',
          key: 'customer' as keyof FeedbackData
        },
        {
          title: 'Customer Problem',
          content: problemMatch ? problemMatch[1].trim() : 'Analysis section not found',
          icon: '🎯',
          key: 'problem' as keyof FeedbackData
        },
        {
          title: 'Product Scope',
          content: scopeMatch ? scopeMatch[1].trim() : 'Analysis section not found',
          icon: '🛠️',
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
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-2xl z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mb-4 shadow-lg shadow-blue-500/25">
              <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Refining Analysis</h3>
            <p className="text-slate-400">Incorporating your feedback to improve the analysis...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mb-4 shadow-lg shadow-blue-500/25">
          <span className="text-2xl">🔍</span>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Concept Analysis Complete</h3>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Review the breakdown of your product concept that will inform the brief. You can proceed with this analysis or refine it based on your feedback.
        </p>
      </div>

      {/* Analysis Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {sections.map((section) => (
          <div key={section.key} className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/10 rounded-2xl blur-xl"></div>
            <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-xl">
                  <span className="text-xl">{section.icon}</span>
                </div>
                <h4 className="text-lg font-semibold text-sky-300">{section.title}</h4>
              </div>
              <div className="prose prose-slate prose-invert prose-sm max-w-none">
                <div className="text-slate-300 leading-relaxed">
                  <Markdown>{section.content}</Markdown>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 bg-amber-500/20 rounded-xl">
                <span className="text-amber-400">✏️</span>
              </div>
              <h4 className="text-lg font-semibold text-sky-300">Provide Feedback</h4>
            </div>
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {section.title} Feedback
                  </label>
                  <textarea
                    value={feedback[section.key]}
                    onChange={(e) => handleFeedbackChange(section.key, e.target.value)}
                    placeholder={`Provide specific feedback for the ${section.title} section...`}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors resize-none"
                    rows={3}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleRefineSubmit}
                  disabled={isRefining}
                  className="flex-1 flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                    <>
                      <span className="mr-2">🔄</span>
                      Apply Refinements
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowFeedbackForm(false)}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleConfirm}
          disabled={isCreatingBrief}
          className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-green-800 disabled:to-emerald-800 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-green-500/25 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500/50"
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
            <>
              <span className="mr-2">✅</span>
              Looks Good - Continue
            </>
          )}
        </button>
        <button
          onClick={() => setShowFeedbackForm(!showFeedbackForm)}
          disabled={isRefining || isCreatingBrief}
          className="flex items-center justify-center px-8 py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50"
        >
          <span className="mr-2">✏️</span>
          {showFeedbackForm ? 'Hide Feedback' : 'Refine Analysis'}
        </button>
      </div>
    </div>
  );
};

export default ProductAnalysisReview; 