import React from 'react';
import { MergedAstNode } from '../types';

interface AstDiffRendererProps {
  nodes: MergedAstNode[];
}

interface AstDiffRendererNodeProps {
  node: MergedAstNode;
}

/**
 * Helper to render text with inline formatting, applying charDiff.
 */
function renderTextWithInlineFormattingAndDiff(
  inlineChildren: MergedAstNode[] | undefined,
  charDiffInput: Array<[number, string]> | undefined
): React.ReactNode[] {
  if (!charDiffInput || !inlineChildren || inlineChildren.length === 0) {
    // If no charDiff or no inline children, render charDiff directly or nothing
    return charDiffInput ? charDiffInput.map(([op, text], i) => {
      let style: React.CSSProperties = {};
      if (op === 1) style = { backgroundColor: '#ddfadd', textDecoration: 'none' };
      if (op === -1) style = { backgroundColor: '#fadddd', textDecoration: 'line-through' };
      return <span key={`char-direct-${i}`} style={style}>{text}</span>;
    }) : [];
  }

  const resultElements: React.ReactNode[] = [];
  let charDiff = [...charDiffInput]; // Clone to allow modification (consuming segments)
  let keyCounter = 0;

  function getAstNodeTextContent(node: MergedAstNode): string {
    let text = '';
    if (node.value) text += node.value;
    if (node.children) {
      for (const child of node.children) {
        text += getAstNodeTextContent(child);
      }
    }
    return text;
  }

  for (const astNode of inlineChildren) {
    let astNodeText = getAstNodeTextContent(astNode);
    if (astNode.diffStatus === 'removed') { // If the inline AST node itself was part of a removal (e.g. whole bold section removed)
        // This case should be handled by parent marking it removed. 
        // If charDiff is being processed, it implies the parent paragraph is 'changed', not fully removed.
        // However, if we want to show removed inline elements distinctly:
        // resultElements.push(<span key={keyCounter++} style={{textDecoration: 'line-through', backgroundColor: '#fadddd'}}>{renderNodeRecursive(astNode)}</span>);
        // continue;
    }

    const processNode = (currentNode: MergedAstNode, currentTextContent: string, activeStyles: string[] = []) => {
        if (currentNode.type === 'text' || !currentNode.children || currentNode.children.length === 0) {
            let remainingNodeText = currentTextContent;
            while (remainingNodeText.length > 0 && charDiff.length > 0) {
                const [op, diffText] = charDiff[0];
                const currentStyle: React.CSSProperties = {};
                if (op === 1) currentStyle.backgroundColor = '#ddfadd';
                if (op === -1) currentStyle.backgroundColor = '#fadddd'; 
                                
                let element = <span key={keyCounter++} style={currentStyle}>{/* placeholder */}</span>;
                
                // Apply active styles (strong, em)
                let styledElement = <>{diffText}</>; // Default to just text
                if (op !== -1) { // Don't show content for purely removed segments in this model yet for simplicity
                    activeStyles.forEach(styleType => {
                        if (styleType === 'strong') styledElement = <strong>{styledElement}</strong>;
                        if (styleType === 'emphasis') styledElement = <em>{styledElement}</em>;
                    });
                }
                if (op === -1) {
                     activeStyles.forEach(styleType => {
                        if (styleType === 'strong') styledElement = <strong>{styledElement}</strong>;
                        if (styleType === 'emphasis') styledElement = <em>{styledElement}</em>;
                    });
                    styledElement = <span style={{textDecoration: 'line-through'}}>{styledElement}</span>
                }

                if (diffText.length <= remainingNodeText.length) {
                    resultElements.push(React.cloneElement(element, {style: currentStyle}, styledElement));
                    remainingNodeText = remainingNodeText.substring(diffText.length);
                    charDiff.shift(); // Consumed this diff segment
                } else { // Diff segment is longer than current text node part
                    resultElements.push(React.cloneElement(element, {style: currentStyle}, React.cloneElement(styledElement, {}, diffText.substring(0, remainingNodeText.length))));
                    charDiff[0][1] = diffText.substring(remainingNodeText.length); // Update current diff segment
                    remainingNodeText = '';
                }
            }
        } else if (currentNode.children) { // e.g. strong, emphasis
            const newActiveStyles = [...activeStyles];
            if (currentNode.type === 'strong' || currentNode.type === 'emphasis') {
                newActiveStyles.push(currentNode.type);
            }
            for (const child of currentNode.children) {
                processNode(child, getAstNodeTextContent(child), newActiveStyles);
            }
        }
    };
    processNode(astNode, astNodeText);
  }
  
  // If any charDiff segments remain (e.g. trailing additions not part of any inline node), render them.
  while(charDiff.length > 0){
    const [op, text] = charDiff.shift()!;
    let style: React.CSSProperties = {};
    if (op === 1) style = { backgroundColor: '#ddfadd', textDecoration: 'none' };
    if (op === -1) style = { backgroundColor: '#fadddd', textDecoration: 'line-through' }; 
    resultElements.push(<span key={`trailing-char-${keyCounter++}`} style={style}>{text}</span>);
  }

  return resultElements;
}

const AstDiffRendererNode: React.FC<AstDiffRendererNodeProps> = ({ node }) => {
  const { type, diffStatus, charDiff, children, value, originalValue, ordered, spread } = node;
  let content: React.ReactNode = null;

  if (diffStatus === 'removed') {
    if (value !== undefined) { 
      content = originalValue || value;
    } else if (children && children.length > 0) {
      content = children.map((child, idx) => <AstDiffRendererNode key={idx} node={child} />);
    } else {
      content = originalValue || ''; 
    }
  } else if (type === 'paragraph' && diffStatus === 'changed' && charDiff) {
    content = renderTextWithInlineFormattingAndDiff(children, charDiff);
  } else if (children && children.length > 0) {
    content = children.map((child, idx) => <AstDiffRendererNode key={idx} node={child} />);
  } else if (value !== undefined) {
    if (diffStatus === 'changed' && charDiff) { // For non-paragraph nodes with charDiff
        content = charDiff.map(([op, text], i) => {
            let style: React.CSSProperties = {};
            if (op === 1) style = { backgroundColor: '#ddfadd', textDecoration: 'none' };
            if (op === -1) style = { backgroundColor: '#fadddd', textDecoration: 'line-through' };
            return <span key={i} style={style}>{text}</span>;
        });
    } else {
        content = value;
    }
  }

  const wrapperStyle: React.CSSProperties = {};
  if (diffStatus === 'added') wrapperStyle.backgroundColor = '#e6ffed';
  if (diffStatus === 'removed') {
    wrapperStyle.backgroundColor = '#ffebe9';
    wrapperStyle.textDecoration = 'line-through';
    wrapperStyle.color = '#990000'; 
  }

  switch (type) {
    case 'root':
      return <div style={wrapperStyle}>{content}</div>;
    case 'paragraph':
      return <p style={wrapperStyle}>{content}</p>;
    case 'text':
      // Text node content is handled by its parent (if parent has charDiff) or directly if it has its own value.
      // If it's part of a removed block, it gets styled by parent. Standalone text shouldn't have wrapperStyle here unless it itself is added/removed.
      return <span style={diffStatus === 'removed' && !children ? wrapperStyle : undefined}>{content}</span>;
    case 'list':
      const ListTag = ordered ? 'ol' : 'ul';
      const listStyle = spread ? { marginBottom: '1em' } : {}; 
      return <ListTag style={{...wrapperStyle, ...listStyle}}>{content}</ListTag>;
    case 'listItem':
      return <li style={wrapperStyle}>{content}</li>;
    case 'strong': 
      return <strong style={wrapperStyle}>{content}</strong>;
    case 'emphasis': 
      return <em style={wrapperStyle}>{content}</em>;
    default:
      console.warn('Unknown AST node type in AstDiffRendererNode:', type, node);
      let defaultDisplay: React.ReactNode = type;
      if (children && children.length > 0) {
        defaultDisplay = children.map((child, idx) => <AstDiffRendererNode key={idx} node={child} />);
      } else if (value !== undefined) {
        defaultDisplay = diffStatus === 'removed' ? (originalValue || value) : value;
      }
      return <div className="unsupported-ast-node" style={{...wrapperStyle, border: '1px solid red'}}>Unsupported: {type} - {defaultDisplay}</div>;
  }
};

const AstDiffRenderer: React.FC<AstDiffRendererProps> = ({ nodes }) => {
  return <>{nodes.map((node, index) => <AstDiffRendererNode key={index} node={node} />)}</>;
};

export default AstDiffRenderer; 