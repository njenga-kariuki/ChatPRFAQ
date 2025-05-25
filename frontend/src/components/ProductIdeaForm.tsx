import React, { useState, useEffect } from 'react';

interface ProductIdeaFormProps {
  onSubmit: (productIdea: string) => void;
  isProcessing: boolean;
  initialValue?: string; // Optional prop for pre-populating the textarea
}

const ProductIdeaForm: React.FC<ProductIdeaFormProps> = ({ onSubmit, isProcessing, initialValue }) => {
  const [productIdea, setProductIdea] = useState(initialValue || '');
  const [error, setError] = useState('');

  // Update productIdea if initialValue changes (for auto-submit scenarios)
  useEffect(() => {
    if (initialValue !== undefined) {
      setProductIdea(initialValue);
    }
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productIdea.trim().length < 10) {
      setError('Please provide more details about your product idea (at least 10 characters).');
      return;
    }
    setError('');
    onSubmit(productIdea);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <textarea
          id="productIdeaInput"
          value={productIdea}
          onChange={(e) => setProductIdea(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={6}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none transition-all"
          placeholder="What problem does your product solve? Who is it for? Example: A WhatsApp-based inventory system for small retailers..."
          disabled={isProcessing}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={isProcessing}
        className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            <span>Get My PRFAQ</span>
            <span className="ml-1">→</span>
          </>
        )}
      </button>
    </form>
  );
};

export default ProductIdeaForm; 