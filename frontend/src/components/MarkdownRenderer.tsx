import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ContentProcessor } from '../utils/contentProcessor';

interface MarkdownRendererProps {
  content: string;
  variant?: 'standard' | 'document' | 'diff-clean';
  processContent?: boolean;
  className?: string;
}

/**
 * Shared MarkdownRenderer component that provides consistent Markdown rendering
 * across the application with different variants for different use cases.
 * 
 * Variants:
 * - 'standard': Full-featured rendering with ContentProcessor, remarkGfm, and prose-custom styling
 *   Used by: StepCard, ModernResults, ProductAnalysisReview
 * - 'document': Simpler prose styling for document views
 *   Used by: EnhancedResults, ResearchArtifactsView
 * - 'diff-clean': For DocumentDiffViewer non-diff mode with document styling
 *   Used by: DocumentDiffViewer (showRedlines=false case only)
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  variant = 'standard',
  processContent = true,
  className
}) => {
  // Process content based on variant and processContent flag
  const processedContent = processContent ? ContentProcessor.processContent(content) : content;

  // Standard variant: Full-featured with ContentProcessor, remarkGfm, and custom components
  if (variant === 'standard') {
    return (
      <div className={`prose-custom ${className || ''}`}>
        <Markdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({children}) => <p style={{marginBottom: '1.5rem', lineHeight: '1.7'}}>{children}</p>,
            table: ({children}) => (
              <div className="overflow-x-auto my-6">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  {children}
                </table>
              </div>
            ),
            thead: ({children}) => (
              <thead className="bg-gray-50">{children}</thead>
            ),
            th: ({children}) => (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r last:border-r-0">
                {children}
              </th>
            ),
            td: ({children}) => (
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r last:border-r-0">
                {children}
              </td>
            ),
            tr: ({children}) => (
              <tr className="border-b hover:bg-gray-50">{children}</tr>
            )
          }}
        >
          {processedContent}
        </Markdown>
      </div>
    );
  }

  // Document variant: Simpler prose styling for document views
  if (variant === 'document') {
    return (
      <article className={`prose prose-lg max-w-none ${className || ''}`}>
        <Markdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({children}) => <p style={{marginBottom: '2rem', lineHeight: '1.7'}}>{children}</p>
          }}
        >
          {processedContent}
        </Markdown>
      </article>
    );
  }

  // Diff-clean variant: For DocumentDiffViewer non-diff mode
  if (variant === 'diff-clean') {
    return (
      <div className="prose-custom">
        <Markdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({children}) => <p style={{marginBottom: '1.5rem', lineHeight: '1.7'}}>{children}</p>,
            table: ({children}) => (
              <div className="overflow-x-auto my-6">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  {children}
                </table>
              </div>
            ),
            thead: ({children}) => (
              <thead className="bg-gray-50">{children}</thead>
            ),
            th: ({children}) => (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r last:border-r-0">
                {children}
              </th>
            ),
            td: ({children}) => (
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r last:border-r-0">
                {children}
              </td>
            ),
            tr: ({children}) => (
              <tr className="border-b hover:bg-gray-50">{children}</tr>
            )
          }}
        >
          {processedContent}
        </Markdown>
      </div>
    );
  }

  // Fallback to standard variant
  return (
    <div className={`prose-custom ${className || ''}`}>
      <Markdown 
        remarkPlugins={[remarkGfm]}
      >
        {processedContent}
      </Markdown>
    </div>
  );
};

export default MarkdownRenderer; 