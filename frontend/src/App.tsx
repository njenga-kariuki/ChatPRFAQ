import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import './index.css'; // Ensure Tailwind styles are imported
import ProductIdeaForm from './components/ProductIdeaForm';
import ProcessingStatus from './components/ProcessingStatus'; // Import ProcessingStatus
import StepsDisplay from './components/StepsDisplay'; // Import StepsDisplay
import ProductAnalysisReview from './components/ProductAnalysisReview'; // Import new component
import LandingPage from './components/LandingPage'; // Import LandingPage
import { StepData, PRVersions, ResearchArtifacts } from './types'; // Import StepData and new types
import Markdown from 'react-markdown'; // Import react-markdown
import ModernResults from './components/ModernResults'; // Added import for ModernResults
import EnhancedResults from './components/EnhancedResults'; // Import new enhanced results component
import { ContentProcessor } from './utils/contentProcessor';

// Interface for feedback data
interface FeedbackData {
  customer: string;
  problem: string;
  scope: string;
}

// Unified scroll management hook
const useSmartScroll = () => {
  const userIsInteracting = useRef(false);
  const updateInteraction = () => {
    userIsInteracting.current = true;
    setTimeout(() => {
      userIsInteracting.current = false;
    }, 30000); // Extended from 2000 to 30000 (30 seconds)
  };

  useEffect(() => {
    ['mousedown', 'wheel', 'keydown', 'touchstart'].forEach(event => {
      document.addEventListener(event, updateInteraction, { passive: true });
    });

    return () => {
      ['mousedown', 'wheel', 'keydown', 'touchstart'].forEach(event => {
        document.removeEventListener(event, updateInteraction);
      });
    };
  }, []);

  const smartScroll = (targetId: string, options: {
    block?: ScrollLogicalPosition;
    delay?: number;
    forceScroll?: boolean;
    priority?: 'low' | 'medium' | 'high';
  } = {}) => {
    const { block = 'nearest', delay = 0, forceScroll = false, priority = 'low' } = options;
    
    // Block ALL scrolling when user is active (removed priority checks)
    if (!forceScroll && userIsInteracting.current) {
      return;
    }

    setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block,
          inline: 'nearest'
        });
      }
    }, delay);
  };

  return { smartScroll };
};

// Initial step definitions - will be updated by API stream
const initialStepsData: StepData[] = [
  { id: 1, name: 'Market Research & Analysis', persona: 'Market Analyst + PM', status: 'pending', isActive: false, input: null, output: null },
  { id: 2, name: 'Problem Validation Research', persona: 'User Researcher + Customers', status: 'pending', isActive: false, input: null, output: null },
  { id: 3, name: 'Drafting Press Release', persona: 'PM + Team', status: 'pending', isActive: false, input: null, output: null },
  { id: 4, name: 'Refining Press Release', persona: 'PM incorporating VP feedback', status: 'pending', isActive: false, input: null, output: null },
  { id: 5, name: 'Drafting Internal FAQ', persona: 'Finance + Legal + Engineering', status: 'pending', isActive: false, input: null, output: null },
  { id: 6, name: 'Concept Validation Research', persona: 'User Researcher + Customers', status: 'pending', isActive: false, input: null, output: null },
  { id: 7, name: 'Solution Refinement', persona: 'PM + Tech Lead', status: 'pending', isActive: false, input: null, output: null },
  { id: 8, name: 'Drafting External FAQ', persona: 'Marketing', status: 'pending', isActive: false, input: null, output: null },
  { id: 9, name: 'Synthesizing PRFAQ Document', persona: 'Editor + Team', status: 'pending', isActive: false, input: null, output: null },
  { id: 10, name: 'Defining MLP Plan', persona: 'PM + Tech Lead', status: 'pending', isActive: false, input: null, output: null },
];

function App() {
  // Router hooks for URL synchronization - must be at the top
  const navigate = useNavigate();
  const location = useLocation();

  // App State Management - initialize based on current URL
  const [appState, setAppState] = useState<'landing' | 'app' | 'processing'>(() => {
    const initialState = location.pathname === '/app' ? 'app' : 'landing';
    return initialState;
  });
  
  // Add logging wrapper for setAppState
  const setAppStateWithLogging = (newState: 'landing' | 'app' | 'processing' | ((prev: 'landing' | 'app' | 'processing') => 'landing' | 'app' | 'processing')) => {
    if (typeof newState === 'function') {
      setAppState(prev => {
        const result = newState(prev);
        if (prev !== result) {
          logToStorage('info', '📱 STATE CHANGE', { from: prev, to: result });
        }
        return result;
      });
    } else {
      if (appState !== newState) {
        logToStorage('info', '📱 STATE CHANGE', { from: appState, to: newState });
      }
      setAppState(newState);
    }
  };
  
  const [productIdea, setProductIdea] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('Enter a product idea to begin.');
  const [stepsData, setStepsData] = useState<StepData[]>(initialStepsData);
  const [finalPrfaq, setFinalPrfaq] = useState<string | null>(null);
  const [finalMlpPlan, setFinalMlpPlan] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Add new state for PR versions and research artifacts
  const [prVersions, setPRVersions] = useState<PRVersions>({});
  const [researchArtifacts, setResearchArtifacts] = useState<ResearchArtifacts>({});
  const [resultId, setResultId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'input' | 'processing' | 'results'>('input');
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

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

  // Add state for recovery mechanism
  const [canResumeFromFailure, setCanResumeFromFailure] = useState(false);
  const [savedProgress, setSavedProgress] = useState<any>(null);

  // Save progress to localStorage for recovery
  const saveProgressToStorage = (currentStepsData: StepData[], currentProgress: number, currentIdea: string) => {
    try {
      const progressData = {
        stepsData: currentStepsData,
        progress: currentProgress,
        productIdea: currentIdea,
        timestamp: Date.now()
      };
      localStorage.setItem('workingBackwardsProgress', JSON.stringify(progressData));
    } catch (error) {
      console.warn('Failed to save progress to localStorage:', error);
    }
  };

  // Load progress from localStorage
  const loadProgressFromStorage = () => {
    try {
      const saved = localStorage.getItem('workingBackwardsProgress');
      if (saved) {
        const progressData = JSON.parse(saved);
        // Only load if it's recent (within last hour)
        if (Date.now() - progressData.timestamp < 3600000) {
          return progressData;
        }
      }
    } catch (error) {
      console.warn('Failed to load progress from localStorage:', error);
    }
    return null;
  };

  // Clear saved progress
  const clearSavedProgress = () => {
    try {
      localStorage.removeItem('workingBackwardsProgress');
      setCanResumeFromFailure(false);
      setSavedProgress(null);
    } catch (error) {
      console.warn('Failed to clear saved progress:', error);
    }
  };

  // Check for saved progress on component mount
  useEffect(() => {
    const saved = loadProgressFromStorage();
    if (saved && saved.stepsData.some((s: StepData) => s.status === 'completed')) {
      setSavedProgress(saved);
      setCanResumeFromFailure(true);
    }
  }, []);

  // Save progress whenever steps are updated
  useEffect(() => {
    if (stepsData.some(s => s.status === 'completed') && productIdea) {
      saveProgressToStorage(stepsData, progress, productIdea);
    }
  }, [stepsData, progress, productIdea]);

  // Handle browser back/forward navigation - ONLY update state to match URL
  useEffect(() => {
    // Simplified logging - only log actual state changes
    if (location.pathname === '/' && appState !== 'landing') {
      setAppStateWithLogging('landing');
    } else if (location.pathname === '/app' && appState === 'landing') {
      setAppStateWithLogging('app');
    }
  }, [location.pathname, appState]);

  const resetState = () => {
    logToStorage('info', '🔄 RESET STATE CALLED');
    // Clear saved progress when explicitly resetting
    clearSavedProgress();
    setCurrentRequestId(null);
    
    // Don't change appState here - let the navigation handle it
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
    // Reset new state variables
    setPRVersions({});
    setResearchArtifacts({});
    setResultId(null);
    setViewMode('input');
    // Optionally, close all accordions or open the first one
    // setStepsData(prev => prev.map(s => s.id === 1 ? { ...s, isActive: true } : { ...s, isActive: false }));
  };

  const resumeFromSavedProgress = () => {
    if (!savedProgress) return;
    
    logToStorage('info', '🔄 RESUMING FROM SAVED PROGRESS', { 
      completedSteps: savedProgress.stepsData.filter((s: StepData) => s.status === 'completed').length 
    });
    
    // Restore the saved state
    setProductIdea(savedProgress.productIdea);
    setOriginalProductIdea(savedProgress.productIdea);
    setStepsData(savedProgress.stepsData);
    setProgress(savedProgress.progress);
    setShowWorkingBackwards(true);
    setAnalysisPhase('complete');
    
    // Find the last completed step and try to resume from the next one
    const completedSteps = savedProgress.stepsData.filter((s: StepData) => s.status === 'completed');
    const lastCompletedStep = completedSteps[completedSteps.length - 1];
    
    if (lastCompletedStep && lastCompletedStep.id < 10) {
      setCurrentStepText(`Resuming from Step ${lastCompletedStep.id + 1}...`);
      // Try to continue the process from where it left off
      proceedToMainWorkflow(savedProgress.productIdea);
    } else {
      setCurrentStepText('Review your previous progress below.');
    }
    
    // Clear the saved progress since we're resuming
    clearSavedProgress();
  };

  const handleStartEvaluation = (productIdea?: string) => {
    logToStorage('info', '🚀 HANDLE START EVALUATION CALLED', { hasProductIdea: !!productIdea });
    // Navigate to app route first
    navigate('/app');
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
    logToStorage('info', '📝 HANDLE FORM SUBMIT CALLED', { ideaLength: idea.length });
    resetState();
    setAppStateWithLogging('processing'); // Set processing state
    setViewMode('processing'); // Set view mode to processing
    setProductIdea(idea);
    setOriginalProductIdea(idea);
    setAnalysisPhase('analyzing');
    setIsProcessing(true); // Set processing immediately for UI feedback
    setProgress(2); // Set initial progress for visual feedback (reduced from 5% to 2%)
    setCurrentStepText('PM analyzing concept...'); // Set immediate feedback message

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

      if (analysisResult.request_id) {
        setCurrentRequestId(analysisResult.request_id);
        console.log("LLM Analysis Request ID:", analysisResult.request_id);
        logToStorage('info', '🔍 LLM ANALYSIS REQUEST ID', { requestId: analysisResult.request_id });
      }

      setProductAnalysis(analysisResult.analysis);
      setAnalysisPhase('reviewing');
      setIsProcessing(false); // Stop processing when analysis complete
      setProgress(8); // Set progress to 8% when analysis is done (reduced from 15% to 8%)
      setCurrentStepText('Review your product analysis below.');
      
    } catch (error) {
      console.error('Product analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : "Product analysis failed. Please try again or proceed with the original idea.";
      setGeneralError(errorMessage);
      setAnalysisPhase('reviewing'); // Keep user on review phase to see error
      setIsProcessing(false); // Stop processing on error
      setCurrentStepText(errorMessage); // Show error
      // REMOVED: proceedToMainWorkflow(idea); 
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
    setProgress(5); // Show some progress during refinement (keeping this at 5% as intermediate)
    
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

      if (refineResult.request_id) {
        setCurrentRequestId(refineResult.request_id);
        console.log("LLM Refinement Request ID:", refineResult.request_id);
        logToStorage('info', '🔄 LLM REFINEMENT REQUEST ID', { requestId: refineResult.request_id });
      }

      setProductAnalysis(refineResult.analysis);
      setCurrentStepText('Analysis refined successfully! Review the update below.');
      setProgress(8); // Reset to analysis complete state (reduced from 15% to 8%)
      
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
    setAnalysisPhase('complete'); // Ensure analysis phase effects are deactivated
    setIsProcessing(true);
    setGeneralError(null);
    setCurrentStepText('Initializing process...');
    setProgress(8); // Start from 8% since analysis is complete (reduced from 15% to 8%)
    
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
          if (isProcessing) {
            const errorData = {
              currentStep: stepsData.find(s => s.status === 'processing')?.id || 'unknown',
              completedSteps: stepsData.filter(s => s.status === 'completed').length,
              progress: progress,
              timestamp: new Date().toISOString()
            };
            
            logToStorage('error', '🚨 STREAM ENDED UNEXPECTEDLY', errorData);
            
            // Provide better user feedback about what happened
            const currentStep = stepsData.find(s => s.status === 'processing');
            if (currentStep) {
              const errorMsg = `Connection lost during Step ${currentStep.id} (${currentStep.name}). This might be due to a network issue or server timeout. Please try again.`;
              logToStorage('error', 'Step-specific connection loss', { step: currentStep.id, stepName: currentStep.name });
              setGeneralError(errorMsg);
              setStepsData(prev => prev.map(s => 
                s.id === currentStep.id 
                  ? { ...s, status: 'error', error: 'Connection lost', isActive: true }
                  : s
              ));
            } else {
              logToStorage('error', 'General connection loss - no active step found');
              setGeneralError('Connection lost during processing. Please try again.');
            }
            
            setCurrentStepText('Connection lost - please try again');
            setIsProcessing(false);
            // Don't set progress to 100 if we failed
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

              if (eventData.request_id && !currentRequestId) {
                setCurrentRequestId(eventData.request_id);
                console.log("LLM Stream Request ID:", eventData.request_id);
                logToStorage('info', '🌊 LLM STREAM REQUEST ID', { requestId: eventData.request_id });
              }

              if (eventData.error) {
                const errorDataLog = {
                  step: eventData.step,
                  error: eventData.error,
                  timestamp: new Date().toISOString(),
                  currentProgress: progress
                };
                
                logToStorage('error', '🚨 STEP ERROR RECEIVED', errorDataLog);
                
                setGeneralError(eventData.error);
                if (eventData.step) {
                    setStepsData(prev => prev.map(s => s.id === eventData.step ? { ...s, status: 'error', error: eventData.error, isActive: true } : s));
                    setCurrentStepText(`Error in Step ${eventData.step}: ${(eventData.error || 'Unknown error').substring(0,100)}...`);
                } else {
                    setCurrentStepText(`An error occurred: ${(eventData.error || 'Unknown error').substring(0,100)}...`);
                }
                setIsProcessing(false); // Stop processing on error
                break; // Exit SSE loop on definitive error
              }

              if (eventData.progress !== undefined) {
                // Backend now handles full progress range (8-100%), just cap at 99%
                const cappedProgress = Math.min(Math.round(eventData.progress), 99);
                setProgress(cappedProgress);
              }

              if (eventData.message) {
                setCurrentStepText(eventData.message);
              }

              if (eventData.step && eventData.status) {
                const stepId = eventData.step;
                
                // Log step progress for debugging (only important transitions)
                if (eventData.status === 'processing' || eventData.status === 'completed' || eventData.status === 'error') {
                  logToStorage('info', `📊 STEP ${eventData.status.toUpperCase()}`, {
                    stepId: stepId,
                    stepName: initialStepsData.find(s => s.id === stepId)?.name,
                    status: eventData.status,
                    progress: progress
                  });
                }
                
                setStepsData(prev => prev.map(s => {
                  if (s.id === stepId) {
                    let updatedStep: Partial<StepData> = { status: eventData.status, isActive: true };
                    if (eventData.input) updatedStep.input = eventData.input;
                    if (eventData.output) {
                      updatedStep.output = eventData.output;
                    }
                    if (eventData.status === 'completed') updatedStep.isActive = false;
                    return { ...s, ...updatedStep };
                  }
                  return s;
                }));

                if (eventData.status === 'completed') {
                    logToStorage('info', '✅ STEP COMPLETED - ACTIVATING NEXT', {
                      completedStepId: stepId,
                      completedStepName: initialStepsData.find(s => s.id === stepId)?.name
                    });
                    
                    // Capture PR versions and research artifacts
                    if (eventData.output) {
                      switch (stepId) {
                        case 1:
                          setResearchArtifacts(prev => ({ ...prev, marketResearch: eventData.output }));
                          logToStorage('info', '📊 CAPTURED MARKET RESEARCH', { length: eventData.output.length });
                          break;
                        case 2:
                          setResearchArtifacts(prev => ({ ...prev, problemValidation: eventData.output }));
                          logToStorage('info', '🔍 CAPTURED PROBLEM VALIDATION', { length: eventData.output.length });
                          break;
                        case 3:
                          setPRVersions(prev => ({ ...prev, v1_draft: eventData.output }));
                          logToStorage('info', '📝 CAPTURED PR V1 DRAFT', { length: eventData.output.length });
                          break;
                        case 4:
                          setPRVersions(prev => ({ ...prev, v2_refined: eventData.output }));
                          logToStorage('info', '📝 CAPTURED PR V2 REFINED', { length: eventData.output.length });
                          break;
                        case 5:
                          // Step 5 is Internal FAQ, not concept validation
                          // No PR version or research artifact to capture from this step
                          break;
                        case 6:
                          setResearchArtifacts(prev => ({ ...prev, conceptValidation: eventData.output }));
                          logToStorage('info', '✅ CAPTURED CONCEPT VALIDATION', { length: eventData.output.length });
                          break;
                        case 7:
                          // Extract press release from Solution Refinement output
                          const solutionRefinementContent = eventData.output;
                          // Try multiple patterns to extract the updated press release
                          let prUpdateMatch = solutionRefinementContent.match(/### Updated Press Release[\s\S]*?(?=###|$)/);
                          if (!prUpdateMatch) {
                            // Try alternative patterns
                            prUpdateMatch = solutionRefinementContent.match(/##\s*Updated Press Release[\s\S]*?(?=##|$)/);
                          }
                          if (!prUpdateMatch) {
                            // Try more flexible pattern
                            prUpdateMatch = solutionRefinementContent.match(/Updated Press Release[\s\S]*?(?=###|##|What We Intentionally|$)/);
                          }
                          
                          if (prUpdateMatch) {
                            // Clean up the extracted content by removing the header
                            let cleanedPR = prUpdateMatch[0]
                              .replace(/^#{1,3}\s*Updated Press Release\s*\n?/i, '')
                              .trim();
                            
                            setPRVersions(prev => ({ ...prev, v3_validated: cleanedPR }));
                            logToStorage('info', '📝 CAPTURED PR V3 VALIDATED FROM SOLUTION REFINEMENT', { 
                              solutionRefinementLength: solutionRefinementContent.length,
                              extractedLength: cleanedPR.length,
                              pattern: 'found'
                            });
                          } else {
                            logToStorage('warn', '⚠️ COULD NOT EXTRACT UPDATED PR FROM SOLUTION REFINEMENT', { 
                              solutionRefinementLength: solutionRefinementContent.length,
                              searchPatterns: ['### Updated Press Release', '## Updated Press Release', 'Updated Press Release'],
                              preview: solutionRefinementContent.substring(0, 500)
                            });
                            // Fallback: use the entire solution refinement output as v3_validated
                            setPRVersions(prev => ({ ...prev, v3_validated: solutionRefinementContent }));
                            logToStorage('info', '📝 USING FULL SOLUTION REFINEMENT AS V3 VALIDATED (FALLBACK)', { 
                              solutionRefinementLength: solutionRefinementContent.length
                            });
                          }
                          break;
                        case 8:
                          // Step 8 is External FAQ, not a PR version
                          // No PR version to capture from this step
                          break;
                        case 9:
                          // Extract press release from PRFAQ document
                          const prfaqContent = eventData.output;
                          // Try multiple patterns to extract press release
                          let prMatch = prfaqContent.match(/## Press Release[\s\S]*?(?=##|$)/);
                          if (!prMatch) {
                            // Try alternative patterns
                            prMatch = prfaqContent.match(/Section 2: Press Release[\s\S]*?(?=Section \d+|##|$)/);
                          }
                          if (!prMatch) {
                            // Try more flexible pattern
                            prMatch = prfaqContent.match(/Press Release[\s\S]*?(?=##|Section \d+|Customer FAQ|Internal FAQ|$)/);
                          }
                          
                          if (prMatch) {
                            setPRVersions(prev => ({ ...prev, v4_final: prMatch[0] }));
                            logToStorage('info', '📝 CAPTURED PR V4 FINAL FROM PRFAQ', { 
                              prfaqLength: prfaqContent.length,
                              extractedLength: prMatch[0].length,
                              pattern: 'found'
                            });
                          } else {
                            logToStorage('warn', '⚠️ COULD NOT EXTRACT PR FROM PRFAQ', { 
                              prfaqLength: prfaqContent.length,
                              searchPatterns: ['## Press Release', 'Section 2: Press Release', 'Press Release'],
                              preview: prfaqContent.substring(0, 500)
                            });
                            // Fallback: use the entire PRFAQ as v4_final
                            setPRVersions(prev => ({ ...prev, v4_final: prfaqContent }));
                            logToStorage('info', '📝 USING FULL PRFAQ AS V4 FINAL (FALLBACK)', { 
                              prfaqLength: prfaqContent.length
                            });
                          }
                          break;
                      }
                    }
                    
                    const currentIndex = initialStepsData.findIndex(s => s.id === stepId);
                    if (currentIndex !== -1 && currentIndex < initialStepsData.length - 1) {
                        const nextStepId = initialStepsData[currentIndex + 1].id;
                        logToStorage('info', '🔄 ACTIVATING NEXT STEP', {
                          nextStepId: nextStepId,
                          nextStepName: initialStepsData.find(s => s.id === nextStepId)?.name
                        });
                        setStepsData(prev => prev.map(s => s.id === nextStepId ? { ...s, isActive: true } : s));
                    }
                }
              }

              // ADD THIS NEW HANDLER for insight-only updates
              if (eventData.keyInsight && eventData.step && !eventData.status) {
                setStepsData(prev => prev.map(s => 
                  s.id === eventData.step 
                    ? { ...s, keyInsight: eventData.keyInsight, insightLabel: eventData.insightLabel || null }
                    : s
                ));
              }

              if (eventData.complete && eventData.result) {
                setCurrentStepText('Evaluation Complete! All steps processed.');
                setFinalPrfaq(eventData.result.prfaq || 'Not available');
                setFinalMlpPlan(eventData.result.mlp_plan || 'Not available');
                setStepsData(prev => prev.map(s => ({...s, status: (s.status === 'pending' || s.status === 'processing') ? 'completed' : s.status, isActive: s.id === initialStepsData[initialStepsData.length -1].id })));
                setIsProcessing(false);
                
                // Smooth transition to 100% on true completion
                setProgress(100);
                
                // Generate result ID and switch to results view
                const newResultId = Date.now().toString(36) + Math.random().toString(36).substr(2);
                setResultId(newResultId);
                setViewMode('results');
                
                logToStorage('info', '🎉 PROCESSING COMPLETE - SWITCHING TO RESULTS VIEW', {
                  resultId: newResultId,
                  requestId: currentRequestId,
                  prVersionsCount: Object.keys(prVersions).length,
                  researchArtifactsCount: Object.keys(researchArtifacts).length
                });
                
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

  // Team dynamics progression for Step 0 analysis
  useEffect(() => {
    if (analysisPhase === 'analyzing' && isProcessing) {
      const step0Messages = [
        "PM reviewing idea...",
        "Preparing initial brief for alignment..."
      ];
      
      let messageIndex = 0;
      setCurrentStepText(step0Messages[0]);
      
      const messageTimer = setInterval(() => {
        messageIndex = (messageIndex + 1) % step0Messages.length;
        setCurrentStepText(step0Messages[messageIndex]);
      }, 3000); // Change message every 3 seconds
      
      return () => clearInterval(messageTimer);
    }
  }, [analysisPhase, isProcessing]);

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

  // Completion auto-scroll: scroll to top when results are ready
  useEffect(() => {
    if (viewMode === 'results') {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [viewMode]);

  // Fetch late insights when viewing process steps after completion
  useEffect(() => {
    if (currentRequestId && viewMode === 'results' && (activeTab === 'process' || !showFinalTab)) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        fetchLateInsights();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentRequestId, viewMode, activeTab, showFinalTab]);

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

  // Fetch late insights that may have been generated after stream completion
  const fetchLateInsights = async () => {
    if (!currentRequestId) {
      console.log('No request ID available for insight fetching');
      return;
    }

    try {
      logToStorage('info', '🔍 FETCHING LATE INSIGHTS', { requestId: currentRequestId });
      
      const response = await fetch(`/api/insights?request_id=${currentRequestId}`);
      const data = await response.json();
      
      if (data.success && data.insights && Object.keys(data.insights).length > 0) {
        logToStorage('info', '✨ FOUND LATE INSIGHTS', { 
          requestId: currentRequestId, 
          insightCount: Object.keys(data.insights).length,
          steps: Object.keys(data.insights).join(', ')
        });
        
        // Update stepsData with the found insights
        setStepsData(prev => prev.map(step => {
          const stepInsight = data.insights[step.id];
          if (stepInsight) {
            return {
              ...step,
              keyInsight: stepInsight.insight,
              insightLabel: stepInsight.insight_label
            };
          }
          return step;
        }));
        
        console.log('Updated steps with late insights:', data.insights);
      } else {
        logToStorage('info', '📭 NO LATE INSIGHTS FOUND', { requestId: currentRequestId });
      }
    } catch (error) {
      console.warn('Failed to fetch late insights:', error);
      logToStorage('error', '❌ INSIGHT FETCH FAILED', { 
        requestId: currentRequestId, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // Add persistent logging system
  const logToStorage = (level: 'info' | 'error' | 'warn', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data) : undefined
    };
    
    try {
      const existingLogs = JSON.parse(localStorage.getItem('debugLogs') || '[]');
      
      // Clean up logs older than 24 hours
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentLogs = existingLogs.filter((log: any) => 
        new Date(log.timestamp).getTime() > oneDayAgo
      );
      
      recentLogs.push(logEntry);
      
      // Keep only last 100 entries to prevent storage bloat
      if (recentLogs.length > 100) {
        recentLogs.splice(0, recentLogs.length - 100);
      }
      
      localStorage.setItem('debugLogs', JSON.stringify(recentLogs));
      
      // Also log to console for immediate viewing
      console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    } catch (error) {
      console.warn('Failed to save debug log:', error);
    }
  };

  // Function to download debug logs
  const downloadDebugLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('debugLogs') || '[]');
      const logText = logs.map((log: any) => 
        `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${log.data ? '\nData: ' + log.data : ''}`
      ).join('\n\n');
      
      const blob = new Blob([logText], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `debug-logs-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Failed to download logs:', error);
    }
  };

  // Function to clear debug logs
  const clearDebugLogs = () => {
    localStorage.removeItem('debugLogs');
    console.clear();
    logToStorage('info', 'Debug logs cleared');
  };

  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Add keyboard shortcut to toggle debug panel (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <LandingPage onStartEvaluation={handleStartEvaluation} />
        </div>
      } />
      <Route path="/app" element={
        <div className="min-h-screen bg-gray-50 text-gray-900">
          {viewMode === 'input' && (
            <div className="flex flex-col items-center p-4 md:p-8">
              <header className="w-full max-w-6xl mb-12 text-center">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight text-gray-900">
                  ChatPRFAQ
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  Turn product ideas into C-Suite ready PRFAQs in 3 minutes.
                  <br />
                  <span className="text-gray-600">Powered by 10 specialized AI agents.</span>
                </p>
              </header>

              {generalError && (
                <div className="w-full max-w-6xl mb-6 p-6 bg-red-50 border border-red-100 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-900 mb-1">An Error Occurred</h3>
                      <p className="text-red-700 whitespace-pre-wrap text-sm">{generalError}</p>
                      
                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={resetState} 
                          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all duration-200 hover:shadow-md"
                        >
                          Try Again
                        </button>
                        
                        {canResumeFromFailure && savedProgress && (
                          <button 
                            onClick={resumeFromSavedProgress}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 hover:shadow-md"
                          >
                            Resume from Step {savedProgress.stepsData.filter((s: StepData) => s.status === 'completed').length + 1}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recovery Banner - Show when saved progress is available but no error */}
              {canResumeFromFailure && savedProgress && !generalError && !isProcessing && (
                <div className="w-full max-w-6xl mb-6 p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-1">Previous Session Found</h3>
                      <p className="text-blue-700 text-sm">
                        We found a previous session with {savedProgress.stepsData.filter((s: StepData) => s.status === 'completed').length} completed steps. 
                        Would you like to resume where you left off?
                      </p>
                      
                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={resumeFromSavedProgress}
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 hover:shadow-md"
                        >
                          Resume Previous Session
                        </button>
                        
                        <button 
                          onClick={clearSavedProgress}
                          className="px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium rounded-lg transition-all duration-200"
                        >
                          Start Fresh
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <main className="w-full max-w-6xl space-y-8">
                <section id="product-idea-section" className="py-8 md:py-12">
                  <div className="bg-white rounded-2xl p-8 md:p-10 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Describe your product idea</h2>
                    <p className="text-gray-600 mb-6">What problem does your product solve? Who is it for?</p>
                    <ProductIdeaForm 
                      onSubmit={handleFormSubmit} 
                      isProcessing={isProcessing}
                      initialValue={isAutoSubmitting ? productIdea : undefined}
                    />
                  </div>
                </section>
              </main>
              
              <footer className="w-full max-w-6xl mt-16 pt-8 border-t border-gray-100 text-center">
                <p className="text-gray-500 text-sm">
                  &copy; {new Date().getFullYear()} Work Back AI LLC. All rights reserved.
                </p>
              </footer>
            </div>
          )}
          
          {viewMode === 'processing' && (
            <div className="flex flex-col items-center p-4 md:p-8">
              <header className="w-full max-w-6xl mb-6 text-center relative">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                  <span className="text-black">
                    ChatPRFAQ
                  </span>
                </h1>
                
                <p className="subheadline">
                  Turn product ideas into C-Suite ready PRFAQs in 3 minutes.<br />Powered by 10 specialized AI agents.
                </p>
                
                {/* Subtle exit button in top-right corner */}
                <button
                  onClick={() => {
                    resetState();
                    navigate('/app');
                  }}
                  className="absolute top-0 right-0 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  New Idea
                </button>
              </header>

              {generalError && (
                <div className="w-full max-w-6xl mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <h3 className="text-xl font-semibold text-red-700 mb-2">An Error Occurred</h3>
                  <p className="text-red-600 whitespace-pre-wrap">{generalError}</p>
                  
                  <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                    <button 
                      onClick={resetState} 
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Try Again / Reset
                    </button>
                  </div>
                </div>
              )}

              <main className="w-full max-w-6xl space-y-8">
                {/* Standalone Progress Section - Show during analysis phase */}
                {analysisPhase === 'analyzing' && (
                  <section className="py-12 md:py-16">
                    <div className="bg-white rounded-2xl p-8 border border-gray-100">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Working Backwards Process</h2>
                      
                      {/* Progress Section */}
                      <div className="mb-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        {/* Status Row */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {/* Animated status indicator */}
                            <div className="relative">
                              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              </div>
                              {/* Pulse effect when processing */}
                              <div className="absolute inset-0 bg-blue-400 rounded-xl animate-ping opacity-20" />
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-900">{currentStepText}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Analyzing product concept...
                              </p>
                            </div>
                          </div>
                          
                          {/* Percentage with modern mono font */}
                          <div className="text-2xl font-mono font-semibold text-gray-900">
                            {Math.round(progress)}%
                          </div>
                        </div>
                        
                        {/* Premium progress bar */}
                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.round(progress)}%` }}
                          >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                          </div>
                        </div>
                        
                        {/* Step indicators - Linear style */}
                        <div className="flex items-center justify-between mt-6 relative px-2">
                          {/* Connecting line */}
                          <div className="absolute top-2 left-2 right-2 h-px bg-gray-200" />
                          
                          {stepsData.map((step) => (
                            <div key={step.id} className="relative group">
                              {/* Step dot */}
                              <div className="w-4 h-4 rounded-full border-2 transition-all duration-300 cursor-pointer relative z-10 bg-white border-gray-300 hover:border-gray-400" />
                              
                              {/* Hover tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
                                  {step.name}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Product Analysis Review Section */}
                {analysisPhase === 'reviewing' && productAnalysis && (
                  <section id="analysis-review-section" className="py-8 md:py-12">
                    <div className="bg-white rounded-2xl p-8 md:p-10 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
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
                  <section id="steps-display-section" className="py-8 md:py-12">
                    <div className="bg-white rounded-2xl p-8 md:p-10 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-8">Working Backwards Process</h2>
                      
                      {/* Progress Section - Always visible above tabs */}
                      {(isProcessing || progress > 0 || stepsData.some(s => s.status !== 'pending') || !!generalError || analysisPhase === 'analyzing') && (
                        <div className="mb-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                          {/* Status Row */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {/* Animated status indicator */}
                              <div className="relative">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                  {isProcessing || analysisPhase === 'analyzing' ? (
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  ) : progress === 100 ? (
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <div className="w-3 h-3 bg-blue-600 rounded-full" />
                                  )}
                                </div>
                                {/* Pulse effect when processing */}
                                {(isProcessing || analysisPhase === 'analyzing') && (
                                  <div className="absolute inset-0 bg-blue-400 rounded-xl animate-ping opacity-20" />
                                )}
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-gray-900">{currentStepText}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Step {stepsData.filter(s => s.status !== 'pending').length} of {stepsData.length}
                                </p>
                              </div>
                            </div>
                            
                            {/* Percentage with modern mono font */}
                            <div className="text-2xl font-mono font-semibold text-gray-900">
                              {Math.round(progress)}%
                            </div>
                          </div>
                          
                          {/* Premium progress bar */}
                          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${Math.round(progress)}%` }}
                            >
                              {/* Shimmer effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                            </div>
                          </div>
                          
                          {/* Step indicators - Linear style */}
                          <div className="flex items-center justify-between mt-6 relative px-2">
                            {/* Connecting line */}
                            <div className="absolute top-2 left-2 right-2 h-px bg-gray-200" />
                            
                            {stepsData.map((step) => (
                              <div key={step.id} className="relative group">
                                {/* Step dot */}
                                <div className={`
                                  w-4 h-4 rounded-full border-2 transition-all duration-300 cursor-pointer relative z-10 bg-white
                                  ${step.status === 'completed' ? 'bg-blue-500 border-blue-500 scale-110' :
                                    step.status === 'processing' ? 'border-blue-500 animate-pulse' :
                                    step.status === 'error' ? 'bg-red-500 border-red-500' :
                                    'border-gray-300 hover:border-gray-400'}
                                `} />
                                
                                {/* Hover tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                  <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
                                    {step.name}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tab Navigation - Show when final tab is available */}
                      {showFinalTab && (
                        <div className="relative bg-gray-50 p-1 rounded-xl mb-6">
                          <div className="relative flex gap-1">
                            {/* Sliding background pill */}
                            <div 
                              className="absolute inset-y-0 bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
                              style={{
                                left: activeTab === 'final' ? '0%' : '50%',
                                width: 'calc(50% - 4px)'
                              }}
                            />
                            
                            {/* Tab buttons */}
                            <button
                              onClick={() => setActiveTab('final')}
                              className={`relative flex-1 px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 z-10 ${
                                activeTab === 'final' 
                                  ? 'text-gray-900' 
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              Documents
                            </button>
                            <button
                              onClick={() => setActiveTab('process')}
                              className={`relative flex-1 px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 z-10 ${
                                activeTab === 'process' 
                                  ? 'text-gray-900' 
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              Process
                            </button>
                          </div>
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
                  <div className="fixed top-6 right-6 animate-slideIn z-50">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 min-w-[320px]">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">Documents Ready</h3>
                          <p className="text-sm text-gray-600 mt-1">Your PRFAQ and MLP plan are complete</p>
                          <button 
                            onClick={() => setActiveTab('final')}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-3 transition-colors"
                          >
                            View Documents →
                          </button>
                        </div>
                        <button 
                          onClick={() => setShowNotification(false)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(finalPrfaq || finalMlpPlan) && !isProcessing && !generalError && (
                  <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                    <button 
                      onClick={resetState} 
                      className="group flex items-center justify-center px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 font-medium rounded-xl transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500/20"
                    >
                      <svg className="w-5 h-5 mr-2 transition-transform group-hover:rotate-180 duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Analyze New Idea
                    </button>
                    <button 
                      onClick={handleExportResults} 
                      className="group flex items-center justify-center px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500/20"
                    >
                      <svg className="w-5 h-5 mr-2 transition-transform group-hover:translate-y-0.5 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export Report
                    </button>
                  </div>
                )}
              </main>
            </div>
          )}
          
          {viewMode === 'results' && (
            <EnhancedResults
              finalPrfaq={finalPrfaq || ''}
              finalMlpPlan={finalMlpPlan || ''}
              productIdea={productIdea}
              stepsData={stepsData}
              prVersions={prVersions}
              researchArtifacts={researchArtifacts}
              onNewIdea={() => {
                resetState();
                navigate('/app');
              }}
            />
          )}

          {/* Debug Panel - Toggle with Ctrl+Shift+D */}
          {showDebugPanel && (
            <div className="fixed top-4 right-4 bg-gray-900 text-white p-5 rounded-2xl shadow-2xl z-50 max-w-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Debug Panel</h3>
                <button 
                  onClick={() => setShowDebugPanel(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3 text-sm">
                <p className="text-gray-300">Logs are automatically saved to localStorage</p>
                
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={clearDebugLogs}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Clear Console & Logs
                  </button>
                  
                  <button 
                    onClick={downloadDebugLogs}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Download Debug Logs
                  </button>
                  
                  {currentRequestId && (
                    <div className="mt-3 pt-3 border-t border-gray-700 text-xs">
                      <p className="text-gray-400">Current Request ID (for raw LLM output):</p>
                      <p className="text-sky-400 break-all">{currentRequestId}</p>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700">
                    Logs persist across page reloads.<br/>
                    Press Ctrl+Shift+D to toggle this panel.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      } />
    </Routes>
  );
}

export default App; 