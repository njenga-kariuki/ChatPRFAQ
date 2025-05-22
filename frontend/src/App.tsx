import { useState, useEffect } from 'react';
import './index.css'; // Ensure Tailwind styles are imported
import ProductIdeaForm from './components/ProductIdeaForm';
import ProcessingStatus from './components/ProcessingStatus'; // Import ProcessingStatus
import StepsDisplay from './components/StepsDisplay'; // Import StepsDisplay
import { StepData } from './types'; // Import StepData
import Markdown from 'react-markdown'; // Import react-markdown

// Initial step definitions - will be updated by API stream
const initialStepsData: StepData[] = [
  { id: 1, name: 'Drafting Press Release', persona: 'Product Manager Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 2, name: 'Refining Press Release', persona: 'Marketing Lead Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 3, name: 'Drafting External FAQ', persona: 'Customer Advocate & PM Personas', status: 'pending', isActive: false, input: null, output: null },
  { id: 4, name: 'Drafting Internal FAQ', persona: 'Lead Engineer & PM Personas', status: 'pending', isActive: false, input: null, output: null },
  { id: 5, name: 'Synthesizing PRFAQ Document', persona: 'Editor Persona', status: 'pending', isActive: false, input: null, output: null },
  { id: 6, name: 'Defining MLP Plan', persona: 'PM & Lead Engineer Persona', status: 'pending', isActive: false, input: null, output: null },
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

  const resetState = () => {
    setProductIdea('');
    setIsProcessing(false);
    setProgress(0);
    setCurrentStepText('Enter a product idea to begin.');
    setStepsData(initialStepsData.map(s => ({ ...s, status: 'pending', isActive: false, input: null, output: null, error: null })));
    setFinalPrfaq(null);
    setFinalMlpPlan(null);
    setGeneralError(null);
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
    setIsProcessing(true);
    setGeneralError(null);
    setCurrentStepText('Initializing evaluation...');
    // Set first step as active and its input as the product idea
    setStepsData(initialStepsData.map(s => ({ ...s, status: 'pending', isActive: s.id === 1, input: s.id === 1 ? idea : null })));

    try {
      const response = await fetch('/api/process_stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_idea: idea }),
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
                setProgress(Math.round(eventData.progress));
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
      console.error('Form submission or SSE error:', error);
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 md:p-8">
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-4xl font-bold text-sky-400">
          <i className="bi bi-lightbulb-fill me-2"></i> LLM-Powered Product Concept Evaluator
        </h1>
        <p className="text-lg text-gray-400 mt-2">
          Reimagined with React & Tailwind CSS
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
        <section id="product-idea-section" className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-4 text-sky-300">1. Enter Your Product Idea</h2>
          <ProductIdeaForm onSubmit={handleFormSubmit} isProcessing={isProcessing} />
        </section>

        <section id="processing-status-section" className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-4 text-sky-300">2. Evaluation Progress</h2>
          <ProcessingStatus 
            progress={progress} 
            currentStepText={currentStepText} 
            isVisible={isProcessing || progress > 0 || stepsData.some(s => s.status !== 'pending') || !!generalError}
          />
        </section>

        <section id="steps-display-section" className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-4 text-sky-300">3. Working Backwards Steps</h2>
          <StepsDisplay 
            steps={stepsData} 
            onToggleStep={handleToggleStep} 
            isVisible={stepsData.some(s => s.status !== 'pending') || isProcessing || !!generalError}
          />
        </section>

        {(finalPrfaq || finalMlpPlan) && !isProcessing && !generalError && (
          <section id="results-section" className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-4 text-sky-300">4. Final Report</h2>
            {finalPrfaq && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-sky-400 mb-2">Press Release & FAQ (PRFAQ)</h3>
                {/* Using react-markdown for proper rendering */}
                <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl prose-invert max-w-none p-4 bg-gray-900 rounded-md"><Markdown>{finalPrfaq}</Markdown></div>
              </div>
            )}
            {finalMlpPlan && (
              <div>
                <h3 className="text-xl font-semibold text-sky-400 mb-2">Minimum Lovable Product (MLP) Plan</h3>
                 {/* Using react-markdown for proper rendering */}
                <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl prose-invert max-w-none p-4 bg-gray-900 rounded-md"><Markdown>{finalMlpPlan}</Markdown></div>
              </div>
            )}
          </section>
        )}

        <section id="actions-section" className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-4 text-sky-300">Actions</h2>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <button 
              onClick={resetState} 
              className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="bi bi-arrow-clockwise me-2"></i>Reset Application
            </button>
            <button 
              onClick={handleExportResults} 
              disabled={isProcessing && stepsData.every(s => s.status === 'pending')}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="bi bi-download me-2"></i>Export Full Report
            </button>
          </div>
        </section>

      </main>

      <footer className="w-full max-w-4xl mt-12 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} Product Concept Evaluator. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App; 