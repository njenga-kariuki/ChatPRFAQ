import React from 'react';
import { StepData } from '../types'; // Assuming types.ts is in src/
import Markdown from 'react-markdown'; // We'll add this dependency later
import { ContentProcessor } from '../utils/contentProcessor';

interface StepCardProps {
  step: StepData;
  onToggle: () => void;
}

const StepCard: React.FC<StepCardProps> = ({ step, onToggle }) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>;
      case 'processing':
        return <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>;
      case 'error':
        return <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>;
      default:
        return <span className="text-gray-400 font-medium">{step.id}</span>;
    }
  };

  // Debugging function to check applied styles
  const debugStyles = React.useCallback(() => {
    if (step.output && step.isActive) {
      setTimeout(() => {
        const container = document.querySelector(`#step-${step.id} .prose-custom`);
        if (container) {
          console.log(`🔍 StepCard ${step.id} CSS Debug:`);
          console.log('- Container classes:', container.className);
          
          const paragraphs = container.querySelectorAll('p');
          paragraphs.forEach((p, index) => {
            const styles = window.getComputedStyle(p);
            console.log(`  📝 Paragraph ${index + 1}:`);
            console.log(`    - margin-bottom: ${styles.marginBottom}`);
            console.log(`    - margin-top: ${styles.marginTop}`);
            console.log(`    - line-height: ${styles.lineHeight}`);
            console.log(`    - text content: "${p.textContent?.substring(0, 50)}..."`);
          });
          
          console.log('=====================================');
        }
      }, 100);
    }
  }, [step.id, step.output, step.isActive]);

  React.useEffect(() => {
    debugStyles();
  }, [debugStyles]);

  // Test content for spacing verification
  const testContent = `# Test Document

This is the first paragraph of test content. It should have proper spacing below it to improve readability in professional business documents.

This is the second paragraph. There should be significant visual separation between this paragraph and the one above to make scanning easier.

This is the third paragraph. The spacing should be consistent throughout the document to maintain professional appearance.

## Section Header

Content under headers should also have proper spacing. This paragraph follows a header.

The final paragraph should demonstrate that our spacing solution works consistently across all content types.`;

  if (step.status === 'pending') return null;

  return (
    <div id={`step-${step.id}`} className="bg-white rounded-xl border border-gray-100 mb-8 overflow-hidden">
      {/* Header - Fully Clickable */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">{step.name}</h3>
              <p className="text-sm text-gray-500">{step.persona}</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${step.isActive ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content - Collapsible with improved spacing */}
      {step.isActive && (
        <div className="p-8 md:p-12">
          {step.output ? (
            <div>
              <div className="prose-custom">
                <Markdown 
                  components={{
                    p: ({children}) => <p style={{marginBottom: '2rem', lineHeight: '1.7'}}>{children}</p>
                  }}
                >
                  {ContentProcessor.processContent(step.output)}
                </Markdown>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {step.status === 'processing' ? 
                'Working on this step...' : 
                'No output available yet'
              }
            </div>
          )}
          
          {step.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{step.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StepCard; 