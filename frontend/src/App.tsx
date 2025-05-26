import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
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

const extractKeyInsight = (output: string, stepId: number): string | null => {
  if (stepId === 2) { // Problem validation
    // Look specifically for "High Priority Pain Points" under Severity Assessment
    const match = output.match(/#### Severity Assessment[\s\S]*?- High Priority Pain Points[^\n]*\n\s*- (.+?)(?:\n|$)/i);
    if (match) return match[1].trim().substring(0, 100) + '...';
    
    // Fallback: look for any bullet under "High Priority Pain Points"
    const fallback = output.match(/High Priority Pain Points[^\n]*\n\s*- (.+?)(?:\n|$)/i);
    return fallback ? fallback[1].trim().substring(0, 100) + '...' : null;
  } else if (stepId === 6) { // Concept validation
    // Look specifically for "What Resonated Most" section
    const match = output.match(/### What Resonated Most[^\n]*\n[\s\S]*?[-•*]\s*(.+?)(?:\n|$)/i);
    if (match) return match[1].trim().substring(0, 100) + '...';
    
    // Fallback: look for any bullet under resonated/insights
    const fallback = output.match(/(?:resonated|insights)[\s\S]*?[-•*]\s*(.+?)(?:\n|$)/i);
    return fallback ? fallback[1].trim().substring(0, 100) + '...' : null;
  }
  return null;
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
    setProductIdea(idea);
    setOriginalProductIdea(idea);
    setAnalysisPhase('analyzing');
    setIsProcessing(true); // Set processing immediately for UI feedback
    setProgress(5); // Set initial progress for visual feedback

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

              if (eventData.error) {
                const errorData = {
                  step: eventData.step,
                  error: eventData.error,
                  timestamp: new Date().toISOString(),
                  currentProgress: progress
                };
                
                logToStorage('error', '🚨 STEP ERROR RECEIVED', errorData);
                
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
                      // Extract key insights for research steps
                      if (eventData.status === 'completed') {
                        const insight = extractKeyInsight(eventData.output, stepId);
                        if (insight) updatedStep.keyInsight = insight;
                      }
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
          <div className="flex flex-col items-center p-4 md:p-8">
            <header className="w-full max-w-6xl mb-12 text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
                <span className="text-black">
                  Working Backwards AI
                </span>
              </h1>
              
              <p className="subheadline">
                Turn product ideas into C-Suite ready PRFAQs in 3 minutes.<br />Powered by 10 specialized AI agents.
              </p>
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
                  
                  {canResumeFromFailure && savedProgress && (
                    <button 
                      onClick={resumeFromSavedProgress}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Resume from Step {savedProgress.stepsData.filter((s: StepData) => s.status === 'completed').length + 1}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Recovery Banner - Show when saved progress is available but no error */}
            {canResumeFromFailure && savedProgress && !generalError && !isProcessing && (
              <div className="w-full max-w-6xl mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <h3 className="text-xl font-semibold text-blue-700 mb-2">Previous Session Found</h3>
                <p className="text-blue-600 mb-3">
                  We found a previous session with {savedProgress.stepsData.filter((s: StepData) => s.status === 'completed').length} completed steps. 
                  Would you like to resume where you left off?
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button 
                    onClick={resumeFromSavedProgress}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Resume Previous Session
                  </button>
                  
                  <button 
                    onClick={clearSavedProgress}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Start Fresh
                  </button>
                </div>
              </div>
            )}

            {/* Debug Panel - Toggle with Ctrl+Shift+D */}
            {showDebugPanel && (
              <div className="fixed top-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">Debug Panel</h3>
                  <button 
                    onClick={() => setShowDebugPanel(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-2 text-sm">
                  <p className="text-gray-300">Logs are automatically saved to localStorage</p>
                  
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={clearDebugLogs}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      Clear Console & Logs
                    </button>
                    
                    <button 
                      onClick={downloadDebugLogs}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      Download Debug Logs
                    </button>
                    
                    <div className="text-xs text-gray-400 mt-2">
                      Logs persist across page reloads.<br/>
                      Press Ctrl+Shift+D to toggle this panel.
                    </div>
                  </div>
                </div>
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
                        <span className="text-sm text-gray-500 font-mono">{Math.min(Math.round(progress), 100)}%</span>
                      </div>
                      
                      {/* Main progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-0.5 mb-3">
                        <div 
                          className="bg-black h-0.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        ></div>
                      </div>
                      
                      {/* Step indicators - NEW */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Step {stepsData.filter(s => s.status !== 'pending').length} of {stepsData.length}
                        </span>
                        <div className="flex space-x-1.5">
                          {stepsData.map((step) => (
                            <div
                              key={step.id}
                              className={`group relative`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full transition-all ${
                                  step.status === 'completed' ? 'bg-black' :
                                  step.status === 'processing' ? 'bg-black animate-pulse' :
                                  step.status === 'error' ? 'bg-red-500' :
                                  'bg-gray-300'
                                }`}
                              />
                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                {step.name}
                              </div>
                            </div>
                          ))}
                        </div>
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
        </div>
      } />
    </Routes>
  );
}

export default App; 