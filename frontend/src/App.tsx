import { useState, useEffect } from 'react';
import './index.css'; // Ensure Tailwind styles are imported
import ProductIdeaForm from './components/ProductIdeaForm';
import ProcessingStatus from './components/ProcessingStatus'; // Import ProcessingStatus
import StepsDisplay from './components/StepsDisplay'; // Import StepsDisplay
import ProductAnalysisReview from './components/ProductAnalysisReview'; // Import new component
import { StepData } from './types'; // Import StepData
import Markdown from 'react-markdown'; // Import react-markdown
import ModernResults from './components/ModernResults'; // Added import for ModernResults

// Interface for feedback data
interface FeedbackData {
  customer: string;
  problem: string;
  scope: string;
}

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
  const [productIdea, setProductIdea] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('Enter a product idea to begin.');
  const [stepsData, setStepsData] = useState<StepData[]>(initialStepsData);
  const [finalPrfaq, setFinalPrfaq] = useState<string | null>(null);
  const [finalMlpPlan, setFinalMlpPlan] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Product Analysis State
  const [analysisPhase, setAnalysisPhase] = useState<'none' | 'analyzing' | 'reviewing' | 'refining' | 'complete'>('none');
  const [productAnalysis, setProductAnalysis] = useState<string | null>(null);
  const [isRefiningAnalysis, setIsRefiningAnalysis] = useState(false);
  const [originalProductIdea, setOriginalProductIdea] = useState<string>('');
  const [showWorkingBackwards, setShowWorkingBackwards] = useState(false);

  const resetState = () => {
    setProductIdea('');
    setIsProcessing(false);
    setProgress(0);
    setCurrentStepText('Enter a product idea to begin.');
    setStepsData(initialStepsData.map(s => ({ ...s, status: 'pending', isActive: false, input: null, output: null, error: null })));
    setFinalPrfaq(null);
    setFinalMlpPlan(null);
    setGeneralError(null);
    // Reset analysis state
    setAnalysisPhase('none');
    setProductAnalysis(null);
    setIsRefiningAnalysis(false);
    setOriginalProductIdea('');
    setShowWorkingBackwards(false);
    // Optionally, close all accordions or open the first one
    // setStepsData(prev => prev.map(s => s.id === 1 ? { ...s, isActive: true } : { ...s, isActive: false }));
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
    setCurrentStepText('Starting Working Backwards process...');
    proceedToMainWorkflow(enrichedBrief);
  };

  const handleAnalysisRefine = async (feedback: FeedbackData) => {
    if (!productAnalysis || !originalProductIdea) return;
    
    setIsRefiningAnalysis(true);
    setCurrentStepText('Refining analysis based on your feedback...');
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
      setCurrentStepText('Analysis refined successfully! Review the updated breakdown below.');
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
    setCurrentStepText('Initializing Working Backwards process...');
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

  // Auto-scroll to analysis section when it appears
  useEffect(() => {
    if (analysisPhase === 'reviewing') {
      setTimeout(() => {
        document.getElementById('analysis-review-section')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [analysisPhase]);

  // Auto-scroll to Working Backwards section when it appears
  useEffect(() => {
    if (showWorkingBackwards) {
      setTimeout(() => {
        document.getElementById('steps-display-section')?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 200);
    }
  }, [showWorkingBackwards]);

  const generateReportText = () => {
    let report = `Product Idea:\n${productIdea}\n\n`;
    report += `-------------------------------------\nPROCESS STEPS\n-------------------------------------\n\n`;
    stepsData.forEach(step => {
      report += `Step ${step.id}: ${step.name} (${step.persona})\n`;
      report += `Status: ${step.status}\n`;
      if (step.input) {
        report += `Input:\n${step.input}\n\n`;
      }
      if (step.output) {
        report += `Output:\n${step.output}\n\n`;
      }
      if (step.error) {
        report += `Error: ${step.error}\n\n`;
      }
      report += `----------\n\n`;
    });

    if (finalPrfaq) {
      report += `-------------------------------------\nFINAL PRFAQ\n-------------------------------------\n${finalPrfaq}\n\n`;
    }
    if (finalMlpPlan) {
      report += `-------------------------------------\nFINAL MLP PLAN\n-------------------------------------\n${finalMlpPlan}\n\n`;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center p-4 md:p-8">
      <header className="w-full max-w-4xl mb-8 text-center">
        {/* Enhanced title with gradient text */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent leading-tight">
          <i className="bi bi-lightbulb-fill me-2"></i> 
          Work Backwards
          <br />
          <span className="text-blue-400">Agent</span>
        </h1>
        
        <p className="text-xl text-slate-400 mt-2 max-w-2xl mx-auto leading-relaxed">
          Transform product ideas into comprehensive PRFAQs using Amazon's proven Working Backwards methodology
        </p>
      </header>

      {generalError && (
        <div className="w-full max-w-4xl mb-4 p-4 bg-red-800 border border-red-600 rounded-lg shadow-xl text-center">
          <h3 className="text-xl font-semibold text-red-200"><i className="bi bi-exclamation-triangle-fill me-2"></i> An Error Occurred</h3>
          <p className="text-red-300 whitespace-pre-wrap">{generalError}</p>
          <button 
            onClick={resetState} 
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md"
          >
            Try Again / Reset
          </button>
        </div>
      )}

      <main className="w-full max-w-4xl space-y-8">
        <section id="product-idea-section" className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-xl">
                <span className="text-blue-400 font-bold">1</span>
              </div>
              <h2 className="text-2xl font-semibold text-sky-300">Enter Your Product Idea</h2>
            </div>
            <ProductIdeaForm onSubmit={handleFormSubmit} isProcessing={isProcessing} />
          </div>
        </section>

        {/* Product Analysis Review Section */}
        {analysisPhase === 'reviewing' && productAnalysis && (
          <section id="analysis-review-section" className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/10 rounded-2xl blur-xl"></div>
            <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-xl">
                  <span className="text-blue-400 font-bold">2</span>
                </div>
                <h2 className="text-2xl font-semibold text-sky-300">Refine Your Concept</h2>
              </div>
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
        <section id="steps-display-section" className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-xl">
                <span className="text-blue-400 font-bold">3</span>
              </div>
              <h2 className="text-2xl font-semibold text-sky-300">Working Backwards Process</h2>
            </div>
            
            {/* Integrated Progress Section - Only show when processing */}
            {(isProcessing || progress > 0 || stepsData.some(s => s.status !== 'pending') || !!generalError || analysisPhase === 'analyzing') && (
              <div className="mb-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {isProcessing || analysisPhase === 'analyzing' ? (
                      <div className="flex items-center justify-center w-6 h-6">
                        <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : progress === 100 ? (
                      <div className="flex items-center justify-center w-6 h-6">
                        <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-6 h-6">
                        <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      </div>
                    )}
                    <span className="text-slate-300 font-medium">{currentStepText}</span>
                  </div>
                  <span className="text-sm text-slate-400 font-mono">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <StepsDisplay 
              steps={stepsData} 
              onToggleStep={handleToggleStep} 
              isVisible={stepsData.some(s => s.status !== 'pending') || isProcessing || !!generalError}
            />
          </div>
        </section>
        )}

        {(finalPrfaq || finalMlpPlan) && !isProcessing && !generalError && (
          <section id="results-section" className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/10 rounded-2xl blur-xl"></div>
            <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-500/20 rounded-xl">
                  <span className="text-blue-400 font-bold">4</span>
                </div>
                <h2 className="text-2xl font-semibold text-sky-300">Final Report</h2>
              </div>
              {finalPrfaq && (
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-sky-400 mb-2">Press Release & FAQ (PRFAQ)</h3>
                  <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl prose-invert max-w-none p-4 bg-slate-950 rounded-md"><Markdown>{finalPrfaq}</Markdown></div>
                </div>
              )}
              {finalMlpPlan && (
                <div>
                  <h3 className="text-xl font-semibold text-sky-400 mb-2">Minimum Lovable Product (MLP) Plan</h3>
                  <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl prose-invert max-w-none p-4 bg-slate-950 rounded-md"><Markdown>{finalMlpPlan}</Markdown></div>
                </div>
              )}
            </div>
          </section>
        )}

        {(finalPrfaq || finalMlpPlan) && !isProcessing && !generalError && (
          <section id="enhanced-results-section" className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-blue-500/10 rounded-2xl blur-xl"></div>
            <div className="relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
              <ModernResults 
                finalPrfaq={finalPrfaq || ''}
                finalMlpPlan={finalMlpPlan || ''}
                productIdea={productIdea}
                stepsData={stepsData}
              />
            </div>
          </section>
        )}

        {/* Contextual Actions - Only show when there are results */}
        {(finalPrfaq || finalMlpPlan || (progress === 100 && !isProcessing)) && (
          <div className="flex justify-center space-x-4 mt-8">
            <button 
              onClick={resetState} 
              className="flex items-center justify-center px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50"
            >
              <i className="bi bi-arrow-clockwise me-2"></i>Analyze New Idea
            </button>
            <button 
              onClick={handleExportResults} 
              className="flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50"
            >
              <i className="bi bi-download me-2"></i>Export Report
            </button>
          </div>
        )}

      </main>

      <footer className="w-full max-w-4xl mt-12 text-center text-slate-500">
        <p>&copy; {new Date().getFullYear()} Njenga Vibe Code LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App; 