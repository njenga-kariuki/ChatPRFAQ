import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';

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
      {/* Header - exactly matches How It Works page */}
      <header className="w-full px-4 py-4 md:px-6">
        <div className="max-w-6xl mx-auto relative">
          <Navigation className="absolute top-0 right-0" />
          <Link to="/" className="text-base font-semibold" style={{display: 'block'}}>ChatPRFAQ</Link>
        </div>
      </header>

      {/* Hero Section - optimized spacing */}
      <section className="w-full px-4 py-4 md:px-8 md:py-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Headline */}
          <h1 className="font-bold mb-5 leading-tight" style={{fontSize: '28px'}}>
            <span className="text-black">C-Suite Ready PRFAQs in 5 Minutes</span>
          </h1>
          
          {/* First Subheadline - Tighter spacing */}
          <p className="subheadline mb-12">
            You know the pain: Draft. Review. Politics. Rewrite. Repeat. ChatGPT, Claude, docs, Slack, and back. There's <em>gotta</em> be a better way.
          </p>
          
          {/* NEW ENHANCED SOLUTION PILL - This is the main visual change */}
          <div className="inline-flex items-center gap-3 bg-gray-900 text-white px-7 py-3.5 rounded-full font-semibold text-base shadow-lg mt-8 mb-8 hover:shadow-xl hover:shadow-gray-900/20 hover:transform hover:-translate-y-0.5 transition-all duration-200">
            <span>Idea</span>
            <span className="text-lg" style={{color: 'var(--primary-blue)'}}>→</span>
            <span>AI Team</span>
            <span className="text-lg" style={{color: 'var(--primary-blue)'}}>→</span>
            <span>C-Suite PRFAQ</span>
          </div>
          
          {/* Second Subheadline */}
          <p className="subheadline">
            Amazon's Working Backwards methodology, automated by 10 specialized AI agents. 
            One input, straight to approval. Built by a 10-year Amazon PM & Stanford GSB alum.
          </p>
        </div>
      </section>

      {/* Agent Framework Section */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl pt-6 px-8 pb-8 mt-4 mb-6 border border-gray-100">
          
          {/* Framework Header */}
          <div style={{textAlign: 'center', marginBottom: '32px'}}>
            <h2 className="font-semibold mb-2 text-gray-900" style={{fontSize: '22px'}}>
              Your AI Team
            </h2>
            <p className="text-base text-gray-500 leading-relaxed">
              Elite perspective from every role—minus the ego.
            </p>
          </div>

          {/* Working Group Section */}
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 relative inline-block group">
              Working Group
              <span className="absolute bottom-0 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300" style={{background: 'var(--primary-blue)'}}></span>
            </h4>
            <div className="flex flex-wrap justify-center items-center gap-2 text-gray-900" style={{fontSize: '16px'}}>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>Market Analyst</span>
              <span style={{color: 'var(--primary-blue)'}}>•</span>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>User Researcher</span>
              <span style={{color: 'var(--primary-blue)'}}>•</span>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>PM</span>
              <span style={{color: 'var(--primary-blue)'}}>•</span>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>Tech Lead</span>
              <span style={{color: 'var(--primary-blue)'}}>•</span>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>Editor</span>
            </div>
          </div>

          {/* Visual Separator */}
          <div className="w-16 h-px bg-gray-200 mx-auto mt-6 mb-6"></div>

          {/* Functional Input Section */}
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 relative inline-block group">
              Functional Input
              <span className="absolute bottom-0 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300" style={{background: 'var(--primary-blue)'}}></span>
            </h4>
            <div className="flex justify-center items-center gap-2 text-gray-900" style={{fontSize: '16px'}}>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>Marketing</span>
              <span style={{color: 'var(--primary-blue)'}}>•</span>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>Finance</span>
              <span style={{color: 'var(--primary-blue)'}}>•</span>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>Legal</span>
            </div>
          </div>

          {/* Visual Separator */}
          <div className="w-16 h-px bg-gray-200 mx-auto mt-6 mb-6"></div>

          {/* Exec Reviewers Section */}
          <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 relative inline-block group">
              Exec Reviewers
              <span className="absolute bottom-0 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300" style={{background: 'var(--primary-blue)'}}></span>
            </h4>
            <div className="flex justify-center items-center gap-2 text-gray-900" style={{fontSize: '16px'}}>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>VP Product</span>
              <span style={{color: 'var(--primary-blue)'}}>•</span>
              <span className="font-medium whitespace-nowrap transition-colors duration-200 cursor-default" onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--primary-blue)'} onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}>VP Engineering</span>
            </div>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <section className="w-full px-4 py-8 md:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Input Section - Simplified */}
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="font-semibold mb-4 text-gray-900" style={{fontSize: '22px'}}>
              Describe your product idea
            </h3>
            <div className="mb-4">
              <textarea
                className="w-full p-6 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-gray-900 transition-all duration-200 placeholder-gray-500"
                rows={6}
                placeholder="A mobile app that helps small business owners..."
                value={productIdea}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              {error && <p className="mt-2 text-sm text-red-600 text-left">{error}</p>}
            </div>
            <button
              onClick={handleStartClick}
              className="w-full button-premium"
              style={{fontSize: '15px'}}
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
            &copy; {new Date().getFullYear()} Kilele LLC
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 