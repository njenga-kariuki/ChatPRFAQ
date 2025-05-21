document.addEventListener('DOMContentLoaded', function() {
    // Initialize markdown parser
    const md = window.markdownit();

    // Elements
    const productIdeaForm = document.getElementById('productIdeaForm');
    const productIdeaInput = document.getElementById('productIdeaInput');
    const startButton = document.getElementById('startButton');
    const processingStatus = document.getElementById('processingStatus');
    const progressBar = document.getElementById('progressBar');
    const currentStepText = document.getElementById('currentStepText');
    const stepsContainer = document.getElementById('stepsContainer');
    const resultsContainer = document.getElementById('resultsContainer');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    const resetButton = document.getElementById('resetButton');
    const exportButton = document.getElementById('exportButton');
    
    // Step output elements
    const stepElements = {
        inputs: [],
        outputs: []
    };
    
    for (let i = 1; i <= 6; i++) {
        stepElements.inputs[i] = document.getElementById(`step${i}Input`);
        stepElements.outputs[i] = document.getElementById(`step${i}Output`);
    }
    
    // Result content elements
    const prfaqContent = document.getElementById('prfaqContent');
    const mlpContent = document.getElementById('mlpContent');
    
    // Event listeners
    productIdeaForm.addEventListener('submit', handleFormSubmit);
    resetButton.addEventListener('click', resetApplication);
    exportButton.addEventListener('click', exportResults);
    
    // Variables to store results
    let currentResults = null;
    
    /**
     * Handle form submission
     */
    function handleFormSubmit(event) {
        event.preventDefault();
        
        const productIdea = productIdeaInput.value.trim();
        
        if (productIdea.length < 10) {
            showError('Please provide more details about your product idea (at least 10 characters).');
            return;
        }
        
        // Reset UI state
        resetUIState();
        
        // Show processing status
        processingStatus.classList.remove('d-none');
        startButton.disabled = true;
        startButton.innerHTML = '<i class="bi bi-hourglass me-2"></i>Processing...';
        
        // Process the product idea
        processProductIdea(productIdea);
    }
    
    /**
     * Process product idea through the API
     */
    async function processProductIdea(productIdea) {
        try {
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ product_idea: productIdea })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process product idea');
            }
            
            const results = await response.json();
            currentResults = results;
            
            // Display results
            displayResults(results);
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
            resetUIState(true);
        }
    }
    
    /**
     * Display results from the API
     */
    function displayResults(results) {
        // Hide processing status
        processingStatus.classList.add('d-none');
        
        // Show steps container
        stepsContainer.classList.remove('d-none');
        
        // Fill in step details
        results.steps.forEach(step => {
            updateStepElement(step.id, step.input, step.output);
            updateProgressBar(Math.round((step.id / 6) * 100));
        });
        
        // Display final results
        updateResultContent(results.prfaq, results.mlp_plan);
        
        // Show results container
        resultsContainer.classList.remove('d-none');
        
        // Reset button state
        startButton.disabled = false;
        startButton.innerHTML = '<i class="bi bi-play-circle me-2"></i>Start Evaluation';
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    /**
     * Update a step element with input and output
     */
    function updateStepElement(stepId, input, output) {
        if (stepElements.inputs[stepId]) {
            stepElements.inputs[stepId].textContent = input;
        }
        
        if (stepElements.outputs[stepId]) {
            // Format the output text with markdown
            stepElements.outputs[stepId].innerHTML = formatContent(output);
        }
    }
    
    /**
     * Update the progress bar
     */
    function updateProgressBar(percentage) {
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${percentage}%`;
        
        if (percentage === 100) {
            currentStepText.textContent = 'Evaluation Complete!';
        } else {
            const currentStep = Math.ceil((percentage / 100) * 6);
            currentStepText.textContent = `Processing Step ${currentStep} of 6...`;
        }
    }
    
    /**
     * Format content with markdown and code syntax highlighting
     */
    function formatContent(content) {
        return md.render(content);
    }
    
    /**
     * Update the final result content
     */
    function updateResultContent(prfaq, mlpPlan) {
        prfaqContent.innerHTML = formatContent(prfaq);
        mlpContent.innerHTML = formatContent(mlpPlan);
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorAlert.classList.remove('d-none');
    }
    
    /**
     * Reset the UI state
     */
    function resetUIState(keepInput = false) {
        if (!keepInput) {
            productIdeaInput.value = '';
        }
        
        processingStatus.classList.add('d-none');
        stepsContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        errorAlert.classList.add('d-none');
        
        // Reset step elements
        for (let i = 1; i <= 6; i++) {
            if (stepElements.outputs[i]) {
                stepElements.outputs[i].textContent = '';
            }
        }
        
        // Reset progress
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        currentStepText.textContent = 'Initializing...';
        
        // Reset results
        prfaqContent.innerHTML = '';
        mlpContent.innerHTML = '';
        
        startButton.disabled = false;
        startButton.innerHTML = '<i class="bi bi-play-circle me-2"></i>Start Evaluation';
        
        currentResults = null;
    }
    
    /**
     * Reset the application
     */
    function resetApplication() {
        resetUIState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    /**
     * Export results as a text file
     */
    function exportResults() {
        if (!currentResults) {
            showError('No results to export.');
            return;
        }
        
        const fileName = 'working-backwards-results.txt';
        let content = `# Product Concept Evaluation - Working Backwards Results\n\n`;
        content += `## Original Product Idea\n${currentResults.product_idea}\n\n`;
        content += `## PRFAQ Document\n${currentResults.prfaq}\n\n`;
        content += `## MLP Plan\n${currentResults.mlp_plan}\n\n`;
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }
});
