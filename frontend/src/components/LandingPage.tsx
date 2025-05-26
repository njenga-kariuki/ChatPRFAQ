import React, { useState } from 'react';

interface LandingPageProps {
  onStartEvaluation: (productIdea?: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartEvaluation }) => {
  const [productIdea, setProductIdea] = useState('');
  const [error, setError] = useState('');

  const handleStartClick = () => {
    if (productIdea.trim().length < 10) {
      setError('Please provide more details about your product idea (at least 10 characters).');
      return;
    }
    setError('');
    onStartEvaluation(productIdea);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProductIdea(e.target.value);
    if (error) setError(''); // Clear error when user starts typing
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStartClick();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hero Section */}
      <section className="w-full px-4 py-8 md:px-8 md:py-12">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Headline */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
            <span className="text-black">C-Suite Ready PRFAQs in 3 Minutes</span><br />
            {/* <span className="text-gray-500 strikethrough">Not 6 Weeks</span> */}
          </h1>
          {/* Extended Subheadline */}
          <p className="subheadline">
            You know the pain: Draft. Review. Politics. Rewrite. Repeat. Your AI toolkit helps, but orchestrating them is a job itself. There's <em>gotta</em> be a better way.<br /><br />Amazon's Working Backwards methodology, automated by 10 specialized AI agents. 
            One input, straight to approval. Built by a 10-year Amazon PM & Stanford GSB alum.
          </p>
        </div>
      </section>

      {/* Agent Framework Section */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl pt-6 px-8 pb-8 my-6 border border-gray-100">
          
          {/* Framework Header */}
          <div style={{textAlign: 'center', marginBottom: '32px'}}>
            <h2 className="text-2xl md:text-3xl font-semibold mb-2 text-gray-900">
              Your AI Team
            </h2>
            <p className="text-base text-gray-500 leading-relaxed">
              Elite perspective from every role—minus the ego.
            </p>
          </div>

          {/* Working Group Section */}
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Working Group
            </h4>
            <div className="flex flex-wrap justify-center items-center gap-2 text-gray-900 text-lg">
              <span className="font-medium">Market Analyst</span>
              <span className="text-gray-400">•</span>
              <span className="font-medium">User Researcher</span>
              <span className="text-gray-400">•</span>
              <span className="font-medium">PM</span>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-2 text-gray-900 text-lg mt-2">
              <span className="font-medium">Tech Lead</span>
              <span className="text-gray-400">•</span>
              <span className="font-medium">Editor</span>
            </div>
          </div>

          {/* Visual Separator */}
          <div className="w-16 h-px bg-gray-200 mx-auto mt-6 mb-6"></div>

          {/* Functional Input Section */}
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Functional Input
            </h4>
            <div className="flex justify-center items-center gap-2 text-gray-900 text-lg">
              <span className="font-medium">Marketing</span>
              <span className="text-gray-400">•</span>
              <span className="font-medium">Finance</span>
              <span className="text-gray-400">•</span>
              <span className="font-medium">Legal</span>
            </div>
          </div>

          {/* Visual Separator */}
          <div className="w-16 h-px bg-gray-200 mx-auto mt-6 mb-6"></div>

          {/* Exec Reviewers Section */}
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
              Exec Reviewers
            </h4>
            <div className="flex justify-center items-center gap-2 text-gray-900 text-lg">
              <span className="font-medium">VP Product</span>
              <span className="text-gray-400">•</span>
              <span className="font-medium">VP Engineering</span>
            </div>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <section className="w-full px-4 py-8 md:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Input Section - Simplified */}
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl md:text-3xl font-semibold mb-4 text-gray-900">
              Describe your product idea
            </h3>
            <div className="mb-4">
              <textarea
                className="w-full p-6 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white text-gray-900"
                rows={6}
                placeholder="Example: A WhatsApp-based inventory system that lets small retailers track stock levels and automatically reorder from suppliers when running low..."
                value={productIdea}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              {error && <p className="mt-2 text-sm text-red-600 text-left">{error}</p>}
            </div>
            <button
              onClick={handleStartClick}
              className="w-full px-8 py-4 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors text-lg"
            >
              Get My PRFAQ
            </button>
          </div>
        </div>
      </section>

      {/* Simplified Footer */}
      <footer className="w-full px-4 py-6 md:px-8 text-center bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-600 text-sm mb-2">
            Used by PMs at OpenAI, Anthropic, Meta, Google, and Stripe.
          </p>
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Nj Vibe Code LLC
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 