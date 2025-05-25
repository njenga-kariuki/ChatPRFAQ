import { useState, useEffect, useRef } from 'react';
import './index.css'; // Ensure Tailwind styles are imported
import ProductIdeaForm from './components/ProductIdeaForm';
import ProcessingStatus from './components/ProcessingStatus'; // Import ProcessingStatus
import StepsDisplay from './components/StepsDisplay'; // Import StepsDisplay
import ProductAnalysisReview from './components/ProductAnalysisReview'; // Import new component
import LandingPage from './components/LandingPage'; // Import LandingPage
import { StepData } from './types'; // Import StepData
import Markdown from 'react-markdown'; // Import react-markdown
import ModernResults from './components/ModernResults'; // Added import for ModernResults
import { ContentProcessor } from './utils/contentProcessor';

// Interface for feedback data
interface FeedbackData {
  customer: string;
  problem: string;
  scope: string;
}

// Unified scroll management hook
const useSmartScroll = () => {
  const lastUserInteractionRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<number>();
  
  // Track user interactions to prevent interrupting reading
  useEffect(() => {
    const updateInteraction = () => {
      lastUserInteractionRef.current = Date.now();
    };
    
    // Listen for user interactions
    window.addEventListener('scroll', updateInteraction);
    window.addEventListener('mousedown', updateInteraction);
    window.addEventListener('touchstart', updateInteraction);
    window.addEventListener('keydown', updateInteraction);
    
    return () => {
      window.removeEventListener('scroll', updateInteraction);
      window.removeEventListener('mousedown', updateInteraction);
      window.removeEventListener('touchstart', updateInteraction);
      window.removeEventListener('keydown', updateInteraction);
    };
  }, []);
  
  const smartScroll = (targetId: string, options: {
    block?: ScrollLogicalPosition;
    delay?: number;
    forceScroll?: boolean;
    priority?: 'low' | 'medium' | 'high';
  } = {}) => {
    const {
      block = 'nearest',
      delay = 300,
      forceScroll = false,
      priority = 'medium'
    } = options;
    
    // Clear any pending scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const element = document.getElementById(targetId);
      if (!element) return;
      
      // Check if user has interacted recently (unless forced or high priority)
      const timeSinceInteraction = Date.now() - lastUserInteractionRef.current;
      const interactionCooldown = priority === 'high' ? 1000 : 3000;
      
      if (!forceScroll && timeSinceInteraction < interactionCooldown) {
        console.log(`Skipping scroll to ${targetId} - user interaction detected`);
        return;
      }
      
      // Check if element is already visible (unless forced)
      if (!forceScroll) {
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const isInView = rect.top >= 0 && rect.bottom <= viewportHeight + 100;
        
        if (isInView) {
          console.log(`Skipping scroll to ${targetId} - already in view`);
          return;
        }
      }
      
      console.log(`Smart scrolling to ${targetId}`);
      element.scrollIntoView({
        behavior: 'smooth',
        block,
        inline: 'nearest'
      });
    }, delay) as unknown as number;
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  return { smartScroll };
};

// Initial step definitions - will be updated by API stream
const initialStepsData: StepData[] = [
  { id: 1, name: 'Market Research & Analysis', persona: 'Expert Market Research Analyst Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 2, name: 'Drafting Press Release', persona: 'Principal Product Manager Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 3, name: 'Refining Press Release', persona: 'VP Product Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 4, name: 'Drafting External FAQ', persona: 'User Research & Behavior Expert Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 5, name: 'Drafting Internal FAQ', persona: 'VP Business Lead & Principal Engineer Personas', status: 'pending', isActive: false, input: null, output: null },
  { id: 6, name: 'Synthesizing PRFAQ Document', persona: 'Senior Editor/Writer Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 7, name: 'Defining MLP Plan', persona: 'SVP Product & VP Engineering Personas', status: 'pending', isActive: false, input: null, output: null },
];

function App() {
  // App State Management
  const [appState, setAppState] = useState<'landing' | 'app' | 'processing'>('landing');
  
  const [productIdea, setProductIdea] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('Enter a product idea to begin.');
  const [stepsData, setStepsData] = useState<StepData[]>(initialStepsData);
  const [finalPrfaq, setFinalPrfaq] = useState<string | null>(null);
  const [finalMlpPlan, setFinalMlpPlan] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Track if we're auto-submitting from landing page
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);

  // Product Analysis State
  const [analysisPhase, setAnalysisPhase] = useState<'none' | 'analyzing' | 'reviewing' | 'refining' | 'complete'>('none');
  const [productAnalysis, setProductAnalysis] = useState<string | null>(null);
  const [isRefiningAnalysis, setIsRefiningAnalysis] = useState(false);
  const [originalProductIdea, setOriginalProductIdea] = useState<string>('');
  const [showWorkingBackwards, setShowWorkingBackwards] = useState(false);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<'process' | 'final'>('process');
  const [showFinalTab, setShowFinalTab] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [lastCompletedStepId, setLastCompletedStepId] = useState<number | null>(null);

  // Initialize smart scroll hook
  const { smartScroll } = useSmartScroll();

  const resetState = () => {
    setAppState('app'); // Return to app view, not landing
    setProductIdea('');
    setIsProcessing(false);
    setProgress(0);
    setCurrentStepText('Enter a product idea to begin.');
    setStepsData(initialStepsData.map(s => ({ ...s, status: 'pending', isActive: false, input: null, output: null, error: null })));
    setFinalPrfaq(null);
    setFinalMlpPlan(null);
    setGeneralError(null);
    setIsAutoSubmitting(false); // Reset auto-submit flag
    // Reset analysis state
    setAnalysisPhase('none');
    setProductAnalysis(null);
    setIsRefiningAnalysis(false);
    setOriginalProductIdea('');
    setShowWorkingBackwards(false);
    // Reset tab state
    setActiveTab('process');
    setShowFinalTab(false);
    setShowNotification(false);
    setLastCompletedStepId(null);
    // Optionally, close all accordions or open the first one
    // setStepsData(prev => prev.map(s => s.id === 1 ? { ...s, isActive: true } : { ...s, isActive: false }));
  };

  const handleStartEvaluation = (productIdea?: string) => {
    setAppState('app');
    // If a product idea was provided from the landing page, automatically submit it
    if (productIdea && productIdea.trim().length >= 10) {
      setIsAutoSubmitting(true);
      setProductIdea(productIdea); // Store the idea for pre-population
      // Small delay to ensure the UI has transitioned before starting the form submission
      setTimeout(() => {
        handleFormSubmit(productIdea); // Pass original value - handleFormSubmit will handle any needed trimming
      }, 100);
    }
  };

  const handleToggleStep = (stepId: number) => {
    setStepsData(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, isActive: !step.isActive } : step
      )
    );
  };

  const handleFormSubmit = async (idea: string) => {
    resetState();
    setAppState('processing'); // Set processing state
    setProductIdea(idea);
    setOriginalProductIdea(idea);
    setAnalysisPhase('analyzing');
    setIsProcessing(true); // Set processing immediately for UI feedback
    setProgress(5); // Set initial progress for visual feedback
    setCurrentStepText('Analyzing product concept...');

    try {
      // Step 0: Analyze Product Idea
      const analysisResponse = await fetch('/api/analyze_product_idea', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_idea: idea }),
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json().catch(() => ({ error: "Failed to analyze product idea." }));
        throw new Error(errorData.error || "Analysis failed.");
      }

      const analysisResult = await analysisResponse.json();
      
      if (analysisResult.error) {
        throw new Error(analysisResult.error);
      }

      setProductAnalysis(analysisResult.analysis);
      setAnalysisPhase('reviewing');
      setIsProcessing(false); // Stop processing when analysis complete
      setProgress(15); // Set progress to 15% when analysis is done
      setCurrentStepText('Review your product analysis below.');
      
    } catch (error) {
      console.error('Product analysis error:', error);
      setGeneralError(error instanceof Error ? error.message : "Analysis failed. Proceeding with original idea.");
      setIsProcessing(false); // Stop processing on error
      // Fallback: proceed directly to main workflow
      proceedToMainWorkflow(idea);
    }
  };

  const handleAnalysisConfirm = (enrichedBrief: string) => {
    setAnalysisPhase('complete');
    setShowWorkingBackwards(true);
    setIsProcessing(true); // Provide immediate feedback
    setCurrentStepText('Starting process...');
    proceedToMainWorkflow(enrichedBrief);
  };

  const handleAnalysisRefine = async (feedback: FeedbackData) => {
    if (!productAnalysis || !originalProductIdea) return;
    
    setIsRefiningAnalysis(true);
    setCurrentStepText('Refining analysis...');
    setIsProcessing(true); // Show global processing state
    setProgress(10); // Show some progress during refinement
    
    try {
      const refineResponse = await fetch('/api/refine_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_input: originalProductIdea,
          current_analysis: productAnalysis,
          feedback: feedback
        }),
      });

      if (!refineResponse.ok) {
        throw new Error("Failed to refine analysis.");
      }

      const refineResult = await refineResponse.json();
      
      if (refineResult.error) {
        throw new Error(refineResult.error);
      }

      setProductAnalysis(refineResult.analysis);
      setCurrentStepText('Analysis refined successfully! Review the update below.');
      setProgress(15); // Reset to analysis complete state
      
    } catch (error) {
      console.error('Analysis refinement error:', error);
      setGeneralError(error instanceof Error ? error.message : "Failed to refine analysis.");
      setCurrentStepText('Refinement failed. Please try again or proceed with current analysis.');
    } finally {
      setIsRefiningAnalysis(false);
      setIsProcessing(false); // Stop global processing
    }
  };

  const proceedToMainWorkflow = async (inputIdea: string) => {
    setIsProcessing(true);
    setGeneralError(null);
    setCurrentStepText('Initializing process...');
    setProgress(15); // Start from 15% since analysis is complete
    
    // Set first step as active and its input as the (possibly enriched) product idea
    setStepsData(initialStepsData.map(s => ({ ...s, status: 'pending', isActive: s.id === 1, input: s.id === 1 ? inputIdea : null })));

    try {
      const response = await fetch('/api/process_stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_idea: inputIdea }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "An unknown error occurred during processing." }));
        throw new Error(errorData.error || "Failed to start processing stream.");
      }

      if (!response.body) {
        throw new Error("Response body is missing.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) { // Loop to read stream
        const { done, value } = await reader.read();
        if (done) {
          // Check if processing wasn't marked complete by a final SSE event
          if (isProcessing) { // isProcessing should be a local var or check a ref
            setCurrentStepText('Stream ended, finalizing...');
            // Potentially mark all as complete if not already done
            setIsProcessing(false); 
            if (progress < 100) setProgress(100); // Ensure progress is full if stream ends early but successfully
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last partial line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(5));
              console.log('SSE Data:', eventData); // For debugging

              if (eventData.error) {
                setGeneralError(eventData.error);
                if (eventData.step) {
                    setStepsData(prev => prev.map(s => s.id === eventData.step ? { ...s, status: 'error', error: eventData.error, isActive: true } : s));
                }
                continue;
              }

              if (eventData.progress !== undefined) {
                // Adjust progress to account for analysis phase (15-100% for main workflow)
                const adjustedProgress = 15 + (eventData.progress * 0.85);
                setProgress(Math.round(adjustedProgress));
              }

              if (eventData.message) {
                setCurrentStepText(eventData.message);
              }

              if (eventData.step && eventData.status) {
                const stepId = eventData.step;
                setStepsData(prev => prev.map(s => {
                  if (s.id === stepId) {
                    let updatedStep: Partial<StepData> = { status: eventData.status, isActive: true };
                    if (eventData.input) updatedStep.input = eventData.input;
                    if (eventData.output) updatedStep.output = eventData.output;
                    if (eventData.status === 'completed') updatedStep.isActive = false;
                    return { ...s, ...updatedStep };
                  }
                  return s;
                }));

                if (eventData.status === 'completed') {
                    const currentIndex = initialStepsData.findIndex(s => s.id === stepId);
                    if (currentIndex !== -1 && currentIndex < initialStepsData.length - 1) {
                        const nextStepId = initialStepsData[currentIndex + 1].id;
                        setStepsData(prev => prev.map(s => s.id === nextStepId ? { ...s, isActive: true } : s));
                    }
                }
              }

              if (eventData.complete && eventData.result) {
                setCurrentStepText('Evaluation Complete! All steps processed.');
                setFinalPrfaq(eventData.result.prfaq || 'Not available');
                setFinalMlpPlan(eventData.result.mlp_plan || 'Not available');
                setStepsData(prev => prev.map(s => ({...s, status: (s.status === 'pending' || s.status === 'processing') ? 'completed' : s.status, isActive: s.id === initialStepsData[initialStepsData.length -1].id })));
                setIsProcessing(false);
                setProgress(100);
                setShowFinalTab(true);
                // Delay notification for smoother experience
                setTimeout(() => {
                  setShowNotification(true);
                }, 1000);
                return; // Exit function as processing is fully complete
              }
            } catch (e) {
              console.error('Failed to parse SSE event or update state:', e, line);
              setGeneralError('Error processing stream data. Check console for details.');
            }
          }
        }
      } // End of while loop for stream reading
    } catch (error) {
      console.error('Main workflow error:', error);
      setGeneralError(error instanceof Error ? error.message : "An unexpected error occurred.");
      setIsProcessing(false);
      setProgress(0);
      setCurrentStepText('Evaluation failed. Please try again.');
      setStepsData(prev => prev.map(s => ({ ...s, status: 'error', error: (error instanceof Error ? error.message : "Request failed"), isActive: true })));
    }
  };

  useEffect(() => {
    // Logic to open the first step if it's the beginning or after a reset
    if (!isProcessing && progress === 0 && stepsData.every(s => s.status === 'pending')) {
        // setStepsData(prev => prev.map(s => s.id === 1 ? { ...s, isActive: true } : { ...s, isActive: false }));
    }
  }, [isProcessing, progress, stepsData]);

  // Unified scroll management with smart behavior
  useEffect(() => {
    // Auto-scroll to analysis section when it appears
    if (analysisPhase === 'reviewing') {
      smartScroll('analysis-review-section', { 
        block: 'center', 
        delay: 100, 
        priority: 'high' 
      });
    }
  }, [analysisPhase, smartScroll]);

  useEffect(() => {
    // Auto-scroll to Working Backwards section when it appears
    if (showWorkingBackwards) {
      smartScroll('steps-display-section', { 
        block: 'start', 
        delay: 200, 
        priority: 'medium' 
      });
    }
  }, [showWorkingBackwards, smartScroll]);

  useEffect(() => {
    // Smart scroll for completed steps
    const newlyCompletedSteps = stepsData.filter(s => s.status === 'completed');
    
    if (newlyCompletedSteps.length > 0) {
      const latestCompleted = newlyCompletedSteps[newlyCompletedSteps.length - 1];
      
      // Only scroll if this is a newly completed step and we're on the process tab
      if (latestCompleted.id !== lastCompletedStepId && activeTab === 'process') {
        setLastCompletedStepId(latestCompleted.id);
        
        // Use smart scroll with conservative settings
        smartScroll(`step-${latestCompleted.id}`, {
          block: 'nearest',
          delay: 500,
          priority: 'low'
        });
      }
    }
  }, [stepsData, lastCompletedStepId, activeTab, smartScroll]);

  useEffect(() => {
    // Scroll to top when switching to Documents tab (only if user initiated)
    if (activeTab === 'final' && showFinalTab) {
      smartScroll('steps-display-section', { 
        block: 'start', 
        delay: 100, 
        forceScroll: true, 
        priority: 'medium' 
      });
    }
  }, [activeTab, showFinalTab, smartScroll]);

  // Auto-dismiss notification banner
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 10000); // Auto-dismiss after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  // Dismiss notification on tab change
  useEffect(() => {
    if (activeTab === 'final') {
      setShowNotification(false);
    }
  }, [activeTab]);

  const generateReportText = () => {
    let report = `Product Concept Evaluation Report\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    report += `Product Idea:\n${productIdea}\n\n`;
    
    report += `${'='.repeat(60)}\nFINAL DOCUMENTS\n${'='.repeat(60)}\n\n`;
    
    if (finalPrfaq) {
      report += `PRFAQ DOCUMENT\n${'-'.repeat(40)}\n`;
      report += `${ContentProcessor.formatForExport(finalPrfaq)}\n\n`;
    }
    
    if (finalMlpPlan) {
      report += `MLP PLAN\n${'-'.repeat(40)}\n`;
      report += `${ContentProcessor.formatForExport(finalMlpPlan)}\n\n`;
    }
    
    // Only include detailed steps if user specifically wants them
    const includeSteps = window.confirm("Include detailed process steps in export?");
    if (includeSteps) {
      report += `${'='.repeat(60)}\nPROCESS STEPS\n${'='.repeat(60)}\n\n`;
      stepsData.forEach(step => {
        if (step.status === 'completed' && step.output) {
          report += `${step.name}\n${'-'.repeat(step.name.length)}\n`;
          report += `${ContentProcessor.formatForExport(step.output)}\n\n`;
        }
      });
    }
    
    return report;
  };

  const handleExportResults = () => {
    if (!productIdea && !finalPrfaq && !finalMlpPlan && stepsData.every(s => s.status === 'pending')) {
      alert("No results to export yet.");
      return;
    }
    const reportText = generateReportText();
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Product_Concept_Evaluation_Report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {appState === 'landing' ? (
        // Landing Page Experience
        <LandingPage onStartEvaluation={handleStartEvaluation} />
      ) : (
        // App Experience (both 'app' and 'processing' states)
        <div className="flex flex-col items-center p-4 md:p-8">
          <header className="w-full max-w-6xl mb-12 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
              <span className="text-black">
                Working Backwards AI
              </span>
            </h1>
            
            <p className="subheadline">
              Turn product ideas into C-Suite ready PRFAQs in 3 minutes
            </p>
            <p className="text-sm text-gray-500 mt-2">Powered by 10 specialized AI agents</p>
          </header>

          {generalError && (
            <div className="w-full max-w-6xl mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
              <h3 className="text-xl font-semibold text-red-700 mb-2">An Error Occurred</h3>
              <p className="text-red-600 whitespace-pre-wrap">{generalError}</p>
              <button 
                onClick={resetState} 
                className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Try Again / Reset
              </button>
            </div>
          )}

          <main className="w-full max-w-6xl space-y-8">
            <section id="product-idea-section" className="py-12 md:py-16">
              <div className="bg-white rounded-2xl p-8 border border-gray-100">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Describe your product idea</h2>
                <ProductIdeaForm 
                  onSubmit={handleFormSubmit} 
                  isProcessing={isProcessing}
                  initialValue={isAutoSubmitting ? productIdea : undefined}
                />
              </div>
            </section>

            {/* Product Analysis Review Section */}
            {analysisPhase === 'reviewing' && productAnalysis && (
              <section id="analysis-review-section" className="py-12 md:py-16">
                <div className="bg-white rounded-2xl p-8 border border-gray-100">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-6">Refine Your Concept</h2>
                  <ProductAnalysisReview
                    productIdea={originalProductIdea}
                    analysis={productAnalysis}
                    onConfirm={handleAnalysisConfirm}
                    onRefine={handleAnalysisRefine}
                    isRefining={isRefiningAnalysis}
                  />
                </div>
              </section>
            )}

            {(showWorkingBackwards || analysisPhase === 'complete') && (
            <section id="steps-display-section" className="py-12 md:py-16">
              <div className="bg-white rounded-2xl p-8 border border-gray-100">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Working Backwards Process</h2>
                
                {/* Progress Section - Always visible above tabs */}
                {(isProcessing || progress > 0 || stepsData.some(s => s.status !== 'pending') || !!generalError || analysisPhase === 'analyzing') && (
                  <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {isProcessing || analysisPhase === 'analyzing' ? (
                          <div className="flex items-center justify-center w-6 h-6">
                            <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        ) : progress === 100 ? (
                          <div className="flex items-center justify-center w-6 h-6">
                            <svg className="h-5 w-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-6 h-6">
                            <div className="w-3 h-3 bg-black rounded-full"></div>
                          </div>
                        )}
                        <span className="text-gray-700 font-medium">{currentStepText}</span>
                      </div>
                      <span className="text-sm text-gray-500 font-mono">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-0.5">
                      <div 
                        className="bg-black h-0.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Tab Navigation - Show when final tab is available */}
                {showFinalTab && (
                  <div className="flex border-b border-gray-200 mb-6 -mx-2 md:mx-0">
                    <button
                      onClick={() => setActiveTab('final')}
                      className={`flex-1 md:flex-none md:px-6 py-3 px-4 font-medium transition-colors ${
                        activeTab === 'final' 
                          ? 'text-black border-b-2 border-black' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Documents
                    </button>
                    <button
                      onClick={() => setActiveTab('process')}
                      className={`flex-1 md:flex-none md:px-6 py-3 px-4 font-medium transition-colors ${
                        activeTab === 'process' 
                          ? 'text-black border-b-2 border-black' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Process
                    </button>
                  </div>
                )}

                {/* Conditional Content Rendering */}
                {activeTab === 'process' || !showFinalTab ? (
                  <StepsDisplay 
                    steps={stepsData} 
                    onToggleStep={handleToggleStep} 
                    isVisible={stepsData.some(s => s.status !== 'pending') || isProcessing || !!generalError}
                  />
                ) : (
                  /* Final Documents Display */
                  finalPrfaq || finalMlpPlan ? (
                    <ModernResults 
                      finalPrfaq={finalPrfaq || ''}
                      finalMlpPlan={finalMlpPlan || ''}
                      productIdea={productIdea}
                      stepsData={stepsData}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No documents available yet.
                    </div>
                  )
                )}
              </div>
            </section>
            )}

            {/* Notification Banner - Show when documents complete and still on process tab */}
            {showNotification && activeTab === 'process' && (
              <div className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:transform md:-translate-x-1/2 md:w-auto bg-black text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3">
                <span>✓</span>
                <span className="hidden sm:inline">Documents ready</span>
                <span className="sm:hidden">Ready</span>
                <button 
                  onClick={() => setActiveTab('final')}
                  className="underline hover:no-underline"
                >
                  <span className="hidden sm:inline">View final output</span>
                  <span className="sm:hidden">View</span>
                </button>
                <button 
                  onClick={() => setShowNotification(false)}
                  className="ml-2 text-white hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            )}

            {(finalPrfaq || finalMlpPlan) && !isProcessing && !generalError && (
              <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
                <button 
                  onClick={resetState} 
                  className="flex items-center justify-center px-6 py-3 bg-white hover:bg-gray-50 text-black border border-gray-300 font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Analyze New Idea
                </button>
                <button 
                  onClick={handleExportResults} 
                  className="flex items-center justify-center px-6 py-3 bg-black hover:bg-gray-800 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Report
                </button>
              </div>
            )}

          </main>

          <footer className="w-full max-w-6xl mt-12 text-center text-gray-500">
            <p>&copy; {new Date().getFullYear()} Njenga Vibe Code LLC. All rights reserved.</p>
          </footer>
        </div>
      )}
    </div>
  );
}

export default App; 