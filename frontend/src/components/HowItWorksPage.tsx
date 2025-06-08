import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';

// Subcomponents
interface ComparisonRowProps {
  label: string;
  oneShot: string;
  chatPrfaq: string;
  highlight?: string;
}

const ComparisonRow: React.FC<ComparisonRowProps> = ({ label, oneShot, chatPrfaq, highlight }) => (
  <>
    <div className="py-2.5 px-4 border-r border-b border-gray-100">
      <p className="font-medium text-gray-900" style={{fontSize: '15px'}}>{label}</p>
    </div>
    <div className="py-2.5 px-4 border-r border-b border-gray-100 bg-gray-50">
      <p className="text-gray-600" style={{fontSize: '15px'}}>{oneShot}</p>
    </div>
    <div className="py-2.5 px-4 border-b border-gray-100 bg-gray-50">
      <p className="font-semibold text-gray-900" style={{fontSize: '15px'}}>{chatPrfaq}</p>
      {highlight && (
        <p className="text-sm text-gray-600 mt-1">{highlight}</p>
      )}
    </div>
  </>
);



const WorkingBackwardsFlow: React.FC = () => {
  const stages = [
    {
      phase: "Research",
      steps: ["Idea Framing", "Market Analysis", "Problem Discovery"],
      color: "bg-blue-50 border-blue-200",
      icon: "🔍"
    },
    {
      phase: "Creation",
      steps: ["Initial Draft", "Exec Refinement", "FAQ Deep Dive"],
      color: "bg-purple-50 border-purple-200",
      icon: "✏️"
    },
    {
      phase: "Validation",
      steps: ["User Testing", "Solution Refinement", "FAQ Iteration"],
      color: "bg-green-50 border-green-200",
      icon: "✓"
    },
    {
      phase: "Synthesis",
      steps: ["Final Edit", "PRFAQ Synthesis", "MLP Plan"],
      color: "bg-gray-900 text-white",
      icon: "📄"
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.phase}>
            <div className="flex-1">
              <div className={`rounded-xl p-6 border-2 ${stage.color} transition-all duration-300 hover:shadow-lg`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{stage.icon}</span>
                  <h4 className="font-semibold" style={{fontSize: '16px'}}>{stage.phase}</h4>
                </div>
                <div className="space-y-2">
                  {stage.steps.map(step => (
                    <p key={step} className="text-sm">{step}</p>
                  ))}
                </div>
              </div>
            </div>
            {index < stages.length - 1 && (
              <svg className="w-8 h-8 text-gray-400 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>
      
      {/* Feedback loops */}
      <div className="flex justify-center mt-4">
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Continuous feedback and refinement
        </div>
      </div>
    </div>
  );
};

const HowItWorksPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header with Navigation */}
      <header className="w-full px-4 py-4 md:px-6">
        <div className="max-w-6xl mx-auto relative">
          <Navigation className="absolute top-0 right-0" />
          <Link to="/" className="text-base font-semibold" style={{display: 'block'}}>ChatPRFAQ</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-bold mb-6 leading-tight tracking-tight" style={{fontSize: '28px'}}>
            <span className="text-black">"Can't I just ask any LLM for a PRFAQ?"</span>
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed" style={{fontSize: '15px'}}>
            Yes. You'll get a document that looks like a PRFAQ in 30 seconds.
            <br />
            <span className="text-gray-900 font-semibold mt-2 inline-block">
              We give you one that you can actually use.
            </span>
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="w-full px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-3 gap-0 min-w-[500px]">
              {/* Header Row */}
              <div className="py-3 px-4 border-b border-r border-gray-100">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Comparison</p>
                </div>
              </div>
              <div className="py-3 px-4 border-b border-r border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-600" style={{fontSize: '16px'}}>One-Shot PRFAQ</h3>
                <p className="text-sm text-gray-400 mt-1">Any LLM</p>
              </div>
              <div className="py-3 px-4 border-b border-gray-100 text-gray-900" style={{background: 'var(--primary-blue-light)'}}>
                <h3 className="font-semibold flex items-center gap-2" style={{fontSize: '16px'}}>
                  ChatPRFAQ
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{background: 'var(--primary-blue)'}}></span>
                </h3>
              </div>

              {/* Comparison Rows */}
              <ComparisonRow 
                label="Research"
                oneShot="Static training data"
                chatPrfaq="Live market intel"
                highlight="Real-time research"
              />
              <ComparisonRow 
                label="Perspectives"
                oneShot="1"
                chatPrfaq="10"
                highlight="Actual functional roles"
              />
              <ComparisonRow 
                label="Refinement"
                oneShot="What you type"
                chatPrfaq="4 cycles"
                highlight="Idea → Feedback → Refine > Finalize"
              />
              <ComparisonRow 
                label="Time"
                oneShot="30 seconds"
                chatPrfaq="5 minutes"
                highlight="= 50+ hours of work"
              />
              <ComparisonRow 
                label="Depth"
                oneShot="Template filling"
                chatPrfaq="Evidence-based narrative"
                highlight="Market data, user insights, validation"
              />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bezos Quote - Bridge Section */}
      <section className="w-full px-4 py-14 pb-12 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="font-medium text-gray-900 leading-relaxed italic" style={{fontSize: '16px'}}>
            "Great memos are written and re-written, shared with colleagues who are asked to improve the work, set aside for a couple of days, 
            and then edited again with a fresh mind. 
            They simply can’t be done in a day or two."
          </blockquote>
          <cite className="block mt-3 text-gray-600" style={{fontSize: '14px'}}>
            — Jeff Bezos, 2017 Amazon Shareholder Letter
          </cite>
        </div>
      </section>

      {/* Process Visualization */}
      <section className="w-full px-4 py-8 md:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center mb-6 text-gray-900" style={{fontSize: '22px'}}>
            The Working Backwards Simulation
          </h2>        
            {/*Simulation Visualization*/}
            <div className="mt-8 relative">
              <WorkingBackwardsFlow />
            </div>
          {/* Key Differentiators */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 group">
              <div className="text-3xl mb-3">🎭</div>
              <h4 className="font-semibold text-gray-900 mb-2" style={{fontSize: '16px'}}>True Specialization</h4>
              <p className="text-sm text-gray-600">10 roles, 10 optimized AI configurations using role-specific benchmarks.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 group">
              <div className="text-3xl mb-3">🔄</div>
              <h4 className="font-semibold text-gray-900 mb-2" style={{fontSize: '16px'}}>Iterative Depth</h4>
              <p className="text-sm text-gray-600">Each step informed by the last. Like a real team building on each other's work.</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 group">
              <div className="text-3xl mb-3">🎯</div>
              <h4 className="font-semibold text-gray-900 mb-2" style={{fontSize: '16px'}}>Battle-Tested Patterns</h4>
              <p className="text-sm text-gray-600">Built on 10 years of Amazon PRFAQs. Not theory—proven patterns.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full px-4 py-16 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="font-bold mb-6 text-gray-900" style={{fontSize: '22px'}}>
            See the difference in your first document.
          </h3>
          <Link 
            to="/app"
            className="inline-flex items-center justify-center button-premium"
          >
            Get My PRFAQ
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            No sign-up. Just paste your idea.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full px-4 py-6 md:px-8 text-center bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Work Back AI LLC
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HowItWorksPage; 