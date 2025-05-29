import React from 'react';
import { MergedAstNode } from '../types';

interface AstDiffRendererProps {
  nodes: MergedAstNode[];
}

interface AstDiffRendererNodeProps {
  node: MergedAstNode;
}

// Helper to get plain text from a single AST node, including its children if any (for inline elements)
function getUnistNodeTextContent(node: MergedAstNode): string {
  if (node.type === 'text' && node.value) {
    return node.value;
  }
  let text = '';
  if (node.children) {
    for (const child of node.children) {
      text += getUnistNodeTextContent(child);
    }
  }
  return text;
}

interface StyleStackEntry {
  type: string; // 'strong', 'emphasis'
  // Potentially add other style attributes if needed
}

function renderTextWithInlineFormattingAndDiff(
  inlineChildrenOfParent: MergedAstNode[] | undefined,
  charDiffInput: Array<[number, string]> | undefined
): React.ReactNode[] {
  if (!charDiffInput || !inlineChildrenOfParent || inlineChildrenOfParent.length === 0) {
    return charDiffInput ? charDiffInput.map(([op, text], i) => {
      let style: React.CSSProperties = {};
      if (op === 1) style = { backgroundColor: '#ddfadd', textDecoration: 'none' };
      if (op === -1) style = { backgroundColor: '#fadddd', textDecoration: 'line-through' };
      return <span key={`char-direct-${i}`} style={style}>{text}</span>;
    }) : [];
  }

  const outputNodes: React.ReactNode[] = [];
  let charDiff = [...charDiffInput]; // Consumable copy
  let keyCounter = 0;

  // Function to apply styles from the stack to a piece of text
  const applyStyles = (text: string, styleStack: StyleStackEntry[], diffOp: number) => {
    let element: React.ReactNode = text;
    if (diffOp === -1 && text.trim() !== '') { // Don't wrap empty removed spaces in strikethrough
        // For removed text, apply inline styles first, then strikethrough for the whole segment
        // This ensures bold/italic removed text looks right.
        for (let i = styleStack.length - 1; i >= 0; i--) {
            const style = styleStack[i];
            if (style.type === 'strong') element = <strong>{element}</strong>;
            if (style.type === 'emphasis') element = <em>{element}</em>;
        }
        return <span style={{ textDecoration: 'line-through' }}>{element}</span>;
    } else if (diffOp === -1 && text.trim() === '') { // Empty removed text (e.g. space)
        return <span style={{ textDecoration: 'line-through' }}>{text}</span>; // Still show it was there
    }
    
    // For added or unchanged text, apply styles from innermost to outermost
    for (let i = styleStack.length - 1; i >= 0; i--) {
      const style = styleStack[i];
      if (style.type === 'strong') element = <strong>{element}</strong>;
      if (style.type === 'emphasis') element = <em>{element}</em>;
      // Add other styles if necessary
    }
    return element;
  };

  // Recursive function to traverse inline AST nodes and consume charDiff segments
  function processInlineNode(node: MergedAstNode, styleStack: StyleStackEntry[]) {
    const nodeType = node.type;
    let newStyleStack = [...styleStack];

    if (nodeType === 'strong' || nodeType === 'emphasis') {
      newStyleStack.push({ type: nodeType });
    }

    if (nodeType === 'text' && node.value) {
      let remainingNodeText = node.value;
      while (remainingNodeText.length > 0 && charDiff.length > 0) {
        const [op, diffText] = charDiff[0];
        const currentDiffStyle: React.CSSProperties = {};
        if (op === 1) currentDiffStyle.backgroundColor = '#ddfadd';
        // For op === -1 (removed), background is less important than strikethrough applied by applyStyles
        // For op === 0 (unchanged), no background needed.

        if (diffText.length <= remainingNodeText.length) {
          const styledSegment = applyStyles(diffText, newStyleStack, op);
          outputNodes.push(<span key={keyCounter++} style={currentDiffStyle}>{styledSegment}</span>);
          remainingNodeText = remainingNodeText.substring(diffText.length);
          charDiff.shift(); // Consumed this diff segment
        } else {
          const part = diffText.substring(0, remainingNodeText.length);
          const styledSegment = applyStyles(part, newStyleStack, op);
          outputNodes.push(<span key={keyCounter++} style={currentDiffStyle}>{styledSegment}</span>);
          charDiff[0][1] = diffText.substring(remainingNodeText.length); // Update current diff segment
          remainingNodeText = ''; // This text node is fully processed
        }
      }
      // If nodeText remains but charDiff is exhausted (shouldn't typically happen if diff is complete)
      if (remainingNodeText.length > 0) {
        const styledSegment = applyStyles(remainingNodeText, newStyleStack, 0); // Treat as unchanged
        outputNodes.push(<span key={keyCounter++}>{styledSegment}</span>);
      }
    } else if (node.children) {
      for (const child of node.children) {
        processInlineNode(child, newStyleStack);
      }
    }
  }

  for (const childNode of inlineChildrenOfParent) {
    processInlineNode(childNode, []);
  }
  
  // Render any remaining charDiff segments (e.g., pure additions at the end)
  while (charDiff.length > 0) {
    const [op, text] = charDiff.shift()!;
    const style: React.CSSProperties = {};
    let styledText: React.ReactNode = text;
    if (op === 1) style.backgroundColor = '#ddfadd';
    if (op === -1) {
        style.backgroundColor = '#fadddd'; // Can add background for purely removed sections if desired
        styledText = <span style={{textDecoration: 'line-through'}}>{text}</span>
    }
    outputNodes.push(<span key={`trailing-${keyCounter++}`} style={style}>{styledText}</span>);
  }

  return outputNodes;
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
  } else if ((type === 'paragraph' || type === 'heading' || type ==='listItem') && diffStatus === 'changed' && charDiff) {
    // Pass direct children of the block to the renderer, it will handle inline structures.
    content = renderTextWithInlineFormattingAndDiff(children, charDiff);
  } else if (children && children.length > 0) {
    content = children.map((child, idx) => <AstDiffRendererNode key={idx} node={child} />);
  } else if (value !== undefined) {
    // This handles text nodes that are part of an unchanged block, or simple added/removed value nodes.
    // Or text nodes whose parent block was changed but this specific text child doesn't have its own charDiff.
    content = value;
  }

  const wrapperStyle: React.CSSProperties = {};
  if (diffStatus === 'added') wrapperStyle.backgroundColor = '#e6ffed';
  if (diffStatus === 'removed') {
    wrapperStyle.backgroundColor = '#ffebe9';
    // Strikethrough for removed blocks is applied here. 
    // Text content within will just be the originalValue or its children rendered (already marked removed).
    if (!children || children.length === 0) { // Only apply strikethrough to leaf-like removed nodes or text values
         wrapperStyle.textDecoration = 'line-through';
    }
    wrapperStyle.color = '#990000'; 
  }

  switch (type) {
    case 'root':
      return <div style={wrapperStyle}>{content}</div>;
    case 'paragraph':
    case 'heading': // Add heading tags later
      return <p style={wrapperStyle}>{content}</p>; // Using <p> for headings for now
    case 'text':
      // If a text node is part of a 'removed' parent, it gets styled by parent.
      // If rendered via renderTextWithInlineFormattingAndDiff, it won't be wrapped by this case directly.
      // This handles text nodes that are direct children of unchanged or added blocks.
      return <span style={diffStatus === 'removed' && !children ? wrapperStyle : {}}>{content}</span>;
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