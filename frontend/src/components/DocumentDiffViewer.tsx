import React, { useMemo } from 'react';
import { PRVersions, DiffResultType, AstDiffResult, MarkdownAwareDiff, ProcessedDiff, MergedAstNode } from '../types';
import { computeDocumentDiff, renderDiffSegment } from '../utils/diffUtils';
import { computeMarkdownAwareDiff } from '../utils/markdownAwareDiff';
import { parseMarkdownToAst, diffAsts as diffMarkdownAsts } from '../utils/markdownAstDiff';
import MarkdownRenderer from './MarkdownRenderer';
import MarkdownAwareDiffRenderer from './MarkdownAwareDiffRenderer';
import AstDiffRenderer from './AstDiffRenderer';

interface DocumentDiffViewerProps {
  versions: PRVersions;
  fromVersion: number;
  toVersion: number;
  showRedlines: boolean;
}

const DocumentDiffViewer: React.FC<DocumentDiffViewerProps> = ({
  versions,
  fromVersion,
  toVersion,
  showRedlines
}) => {
  const versionKeys = ['v1_draft', 'v2_refined', 'v3_validated', 'v4_final'];
  
  const diff: DiffResultType | null = useMemo(() => {
    const fromText = versions[versionKeys[fromVersion - 1] as keyof PRVersions] || '';
    const toText = versions[versionKeys[toVersion - 1] as keyof PRVersions] || '';
    
    if (!fromText || !toText) return null;
    
    if (!showRedlines || fromVersion === toVersion) {
      return null;
    }

    const USE_AST_DIFF = true;

    if (USE_AST_DIFF) {
      try {
        const fromAst = parseMarkdownToAst(fromText);
        const toAst = parseMarkdownToAst(toText);
        const mergedAstNodes = diffMarkdownAsts(fromAst, toAst);
        return { type: 'ast', nodes: mergedAstNodes, stats: { additions: 0, deletions: 0 } }; // Temp stats
      } catch (error) {
        console.error('AST-based diff failed, falling back to markdown-aware diff:', error);
        try {
          return computeMarkdownAwareDiff(fromText, toText); 
        } catch (error2) {
          console.warn('Markdown-aware diff failed, falling back to character diff:', error2);
          return computeDocumentDiff(fromText, toText); 
        }
      }
    } else {
      try {
        return computeMarkdownAwareDiff(fromText, toText);
      } catch (error) {
        console.warn('Markdown-aware diff failed, falling back to character diff:', error);
        return computeDocumentDiff(fromText, toText);
      }
    }
  }, [versions, fromVersion, toVersion, showRedlines]);
  
  if (!diff && showRedlines && fromVersion !== toVersion) {
    return <div className="text-gray-500 text-center py-8">No content available for comparison</div>;
  }
  
  if (!showRedlines || fromVersion === toVersion) {
    const targetText = versions[versionKeys[toVersion - 1] as keyof PRVersions] || '';
    return (
      <div className="document-viewer">
        <MarkdownRenderer 
          content={targetText} 
          variant="diff-clean"
        />
      </div>
    );
  }
  
  // Render based on diff type
  let diffContent: React.ReactNode;
  let statsBar: React.ReactNode;

  if (diff) {
    statsBar = (
      <div className="diff-stats-bar">
        <span className="diff-stat additions">
          +{diff.stats?.additions || 0} additions
        </span>
        <span className="diff-stat deletions">
          -{diff.stats?.deletions || 0} deletions
        </span>
        {diff.type === 'ast' && (
          <span className="diff-stat enhanced">✨ AST Diff Active</span>
        )}
        {diff.type === 'markdown_aware' && !(diff as MarkdownAwareDiff).fallbackUsed && (
          <span className="diff-stat enhanced">✨ Enhanced formatting</span>
        )}
        {diff.type === 'markdown_aware' && (diff as MarkdownAwareDiff).fallbackUsed && (
          <span className="diff-stat fallback">⚠️ Fallback mode (Markdown Aware)</span>
        )}
        {diff.type === 'char_diff' && (
          <span className="diff-stat fallback">⚠️ Fallback mode (Char Diff)</span>
        )}
      </div>
    );

    switch (diff.type) {
      case 'ast':
        diffContent = <AstDiffRenderer nodes={(diff as AstDiffResult).nodes} />;
        break;
      case 'markdown_aware':
        diffContent = <MarkdownAwareDiffRenderer segments={(diff as MarkdownAwareDiff).segments} />;
        break;
      case 'char_diff':
        diffContent = (
          <>
            {(diff as ProcessedDiff).segments?.map((segment, index: number) => (
              <React.Fragment key={index}>
                {renderDiffSegment(segment)}
              </React.Fragment>
            )) || 'No diff segments available'}
          </>
        );
        break;
      default:
        diffContent = 'No diff to display'; // Should not be reached
    }
  } else {
    diffContent = 'No diff information to display';
    statsBar = null; // Or a default stats bar
  }

  return (
    <div className="document-viewer">
      {statsBar}
      <div className="diff-content">
        {diffContent}
      </div>
    </div>
  );
};

export default DocumentDiffViewer; 