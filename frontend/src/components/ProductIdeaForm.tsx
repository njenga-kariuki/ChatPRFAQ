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
          className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 resize-none"
          placeholder="Example: A WhatsApp-based inventory system that lets small retailers track stock levels and automatically reorder from suppliers when running low..."
          disabled={isProcessing}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={isProcessing}
        className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-gray-900/20 hover:transform hover:-translate-y-0.5 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none"
      >
        {isProcessing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <span>Get My PRFAQ</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
};

export default ProductIdeaForm; 