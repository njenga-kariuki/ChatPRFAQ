import { Root, Content, Parent } from 'mdast';
import { visit } from 'unist-util-visit';
import { Node as UnistNode } from 'unist';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { MergedAstNode, AstNodeStatus } from '../types';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

export function parseMarkdownToAst(markdownText: string): Root {
  return unified().use(remarkParse).parse(markdownText) as Root;
}

/**
 * Extracts all text content from a generic Unist node and its children.
 */
export function getAstNodeText(node: UnistNode | null): string {
  if (!node) return '';
  let text = '';
  visit(node, 'text', (textNode: { type: 'text'; value: string }) => {
    text += textNode.value;
  });
  return text;
}

// --- LCS Implementation ---
interface LcsMatch<T> {
  item: T;
  status: 'common' | 'added' | 'removed';
  originalIndex?: number; 
  newIndex?: number;     
}

function diffArrays<T>(
  fromArray: T[], 
  toArray: T[], 
  isEqual: (a: T, b: T) => boolean
): LcsMatch<T>[] {
  const fromLen = fromArray.length;
  const toLen = toArray.length;
  const dp = Array(fromLen + 1).fill(null).map(() => Array(toLen + 1).fill(0));

  for (let i = 1; i <= fromLen; i++) {
    for (let j = 1; j <= toLen; j++) {
      if (isEqual(fromArray[i - 1], toArray[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: LcsMatch<T>[] = [];
  let i = fromLen, j = toLen;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && isEqual(fromArray[i - 1], toArray[j - 1])) {
      result.unshift({ item: toArray[j - 1], status: 'common', originalIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ item: toArray[j - 1], status: 'added', newIndex: j - 1 });
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] > dp[i][j - 1])) {
      result.unshift({ item: fromArray[i - 1], status: 'removed', originalIndex: i - 1 });
      i--;
    } else {
      break; 
    }
  }
  return result;
}
// --- End LCS Implementation ---

function diffAstChildren( // Renamed for clarity and recursive use
  fromChildren: Content[], 
  toChildren: Content[],
  parentDiffStatus?: AstNodeStatus // Optional: status of the parent (e.g. if a list itself was added)
): MergedAstNode[] {
  const nodesAreEqual = (nodeA: Content, nodeB: Content): boolean => {
    if (nodeA.type !== nodeB.type) return false;
    if (nodeA.type === 'list' && nodeB.type === 'list') {
      return (nodeA as any).ordered === (nodeB as any).ordered; // Match lists if same ordered status
    }
    if (nodeA.type === 'paragraph' || nodeA.type === 'heading' || nodeA.type === 'listItem') {
        const textA = getAstNodeText(nodeA as Parent).trim();
        const textB = getAstNodeText(nodeB as Parent).trim();
        if (textA === textB && textA.length === 0) return true; // Both empty implies equal
        if (textA.length < 40 && textB.length < 40) return textA === textB; 
        // Heuristic based on shared start/end or overall similarity for longer texts
        const similarityThreshold = 0.8; // How similar texts should be to be considered potentially same node
        const JaroWrinkler = (s1: string, s2: string): number => { /* basic Jaro-Wrinkler placeholder, or use a lib */ 
            if (s1 === s2) return 1; if (!s1 || !s2) return 0; let m = 0;
            let r = Math.max(0, Math.floor(Math.max(s1.length, s2.length)/2)-1);
            let s1_matches = new Array(s1.length).fill(false); let s2_matches = new Array(s2.length).fill(false);
            for(let i=0; i<s1.length; i++) { for(let j=Math.max(0,i-r); j<Math.min(s2.length,i+r+1);j++) { if(!s2_matches[j] && s1[i]===s2[j]){s1_matches[i]=true;s2_matches[j]=true;m++;break;}}} if(m===0)return 0;
            let k=0, t=0; for(let i=0;i<s1.length;i++){if(s1_matches[i]){while(!s2_matches[k])k++; if(s1[i]!==s2[k])t++; k++;}} t/=2;
            let jw = (m/s1.length + m/s2.length + (m-t)/m)/3; let p=0.1; if(jw > 0.7){let l=0; while(s1[l]===s2[l] && l<4)l++; jw += l*p*(1-jw);} return jw;
        };
        return JaroWrinkler(textA, textB) > similarityThreshold;
    }
    return true; // Default for other block types
  };

  const lcsMatches = diffArrays(fromChildren, toChildren, nodesAreEqual);
  const mergedNodes: MergedAstNode[] = [];

  for (const match of lcsMatches) {
    const { item, status, originalIndex, newIndex } = match;
    let currentToNode: Content | undefined = undefined;
    let currentFromNode: Content | undefined = undefined;

    if (status === 'common') {
      currentFromNode = fromChildren[originalIndex!];
      currentToNode = toChildren[newIndex!]; // item is toNode
    } else if (status === 'added') {
      currentToNode = item as Content; // item is toNode
    } else if (status === 'removed') {
      currentFromNode = item as Content; // item is fromNode
    }

    const nodeToProcess = currentToNode || currentFromNode;
    if (!nodeToProcess) continue;

    // If parent was added/removed, all children are consequently added/removed
    if (parentDiffStatus === 'added' || parentDiffStatus === 'removed'){
        mergedNodes.push({
            ...(nodeToProcess as any),
            diffStatus: parentDiffStatus,
            children: (nodeToProcess as Parent).children?.map(child => ({ ...(child as any), diffStatus: parentDiffStatus, children: (child as Parent).children ? diffAstChildren([], [], parentDiffStatus) : undefined } as MergedAstNode))
        });
        continue;
    }

    if (status === 'common') {
      const fromText = getAstNodeText(currentFromNode as Parent);
      const toText = getAstNodeText(currentToNode as Parent);
      let nodeChildren: MergedAstNode[] | undefined = undefined;

      if (currentToNode!.type === 'list' && currentFromNode!.type === 'list') {
        // Recursive call for children of lists (listItems)
        nodeChildren = diffAstChildren(
          (currentFromNode as Parent).children as Content[], 
          (currentToNode as Parent).children as Content[],
        );
      } else if ((currentToNode as Parent).children) {
         // For other common nodes with children (e.g. blockquote, listItem containing paragraphs)
         // If parent text content is identical, children are unchanged. If different, then children are part of that change.
         // A more granular approach would be to diff children of paragraphs too, but that might be too much detail for text blocks.
        nodeChildren = (currentToNode as Parent).children!.map(child => ({ ...(child as any), diffStatus: (fromText === toText ? 'unchanged' : 'changed') } as MergedAstNode));
      }

      if (fromText === toText && (currentToNode!.type !== 'list' || nodeChildren?.every(c => c.diffStatus === 'unchanged'))) {
        mergedNodes.push({
          ...(currentToNode as any),
          diffStatus: 'unchanged',
          children: nodeChildren || ( (currentToNode as Parent).children?.map(child => ({ ...(child as any), diffStatus: 'unchanged' } as MergedAstNode)) )
        });
      } else {
        const characterDiff = (currentToNode!.type !== 'list') ? dmp.diff_main(fromText, toText) : undefined;
        if (characterDiff) dmp.diff_cleanupSemantic(characterDiff);

        let mappedChildren: MergedAstNode[] | undefined = undefined;
        if (currentToNode!.type !== 'list') {
            mappedChildren = (currentToNode as Parent).children?.map(child => (
                { ...(child as any), diffStatus: 'unchanged' } as MergedAstNode
            ));
        } else {
            mappedChildren = nodeChildren;
        }

        mergedNodes.push({
          ...(currentToNode as any),
          diffStatus: 'changed',
          charDiff: characterDiff, 
          originalValue: fromText,
          children: mappedChildren
        });
      }
    } else if (status === 'added') {
      mergedNodes.push({
        ...(currentToNode as any),
        diffStatus: 'added',
        children: (currentToNode as Parent).children?.map(child => ({ ...(child as any), diffStatus: 'added', children: (child as Parent).children ? diffAstChildren([], [], 'added') : undefined } as MergedAstNode))
      });
    } else if (status === 'removed') {
      mergedNodes.push({
        ...(currentFromNode as any),
        type: currentFromNode!.type, 
        diffStatus: 'removed',
        originalValue: getAstNodeText(currentFromNode as Parent),
        children: (currentFromNode as Parent).children?.map(child => ({ ...(child as any), diffStatus: 'removed', children: (child as Parent).children ? diffAstChildren([], [], 'removed') : undefined } as MergedAstNode))
      });
    }
  }
  return mergedNodes;
}

export function diffAsts(fromAst: Root, toAst: Root): MergedAstNode[] {
  const mergedChildren = diffAstChildren(fromAst.children as Content[], toAst.children as Content[]);
  return [
    {
      type: 'root',
      // Root is changed if any children changed, or if child counts differ significantly (more robust check needed)
      diffStatus: (mergedChildren.every(n => n.diffStatus === 'unchanged') && fromAst.children.length === toAst.children.length) ? 'unchanged' : 'changed',
      children: mergedChildren
    } as MergedAstNode
  ];
} 