import React, { useState } from 'react';

interface ProductIdeaFormProps {
  onSubmit: (productIdea: string) => void;
  isProcessing: boolean;
}

const ProductIdeaForm: React.FC<ProductIdeaFormProps> = ({ onSubmit, isProcessing }) => {
  const [productIdea, setProductIdea] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productIdea.trim().length < 10) {
      setError('Please provide more details about your product idea (at least 10 characters).');
      return;
    }
    setError('');
    onSubmit(productIdea);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="productIdeaInput" className="block text-sm font-medium text-slate-300 mb-2">
          Describe your product idea:
        </label>
        <textarea
          id="productIdeaInput"
          value={productIdea}
          onChange={(e) => setProductIdea(e.target.value)}
          rows={6}
          className="w-full h-32 px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all shadow-sm"
          placeholder="What problem does it solve? Who is it for? What makes it unique? Example: A mobile app for Kenyan small businesses that integrates M-Pesa, WhatsApp, and inventory management..."
          disabled={isProcessing}
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={isProcessing}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          <>
            <i className="bi bi-play-circle-fill me-2"></i> Start Evaluation
          </>
        )}
      </button>
    </form>
  );
};

export default ProductIdeaForm; 