export class ContentProcessor {
  private static readonly SAFE_CLEANUP_RULES = [
    // Remove meta-commentary but preserve line breaks
    { pattern: /^(Here's|Here is|I've created|Below is).*?:?\s*$/gim, replacement: '' },
    { pattern: /^(This document|The following|Let me know if).*?$/gim, replacement: '' },
    
    // Normalize spacing: exactly 2 newlines for proper markdown paragraphs
    { pattern: /\n{3,}/g, replacement: '\n\n' },
  ];

  static processContent(content: string): string {
    if (!content || typeof content !== 'string') return content || '';
    
    let processed = content;
    
    // Apply only the safest rules with error handling
    for (const rule of this.SAFE_CLEANUP_RULES) {
      try {
        processed = processed.replace(rule.pattern, rule.replacement as string);
      } catch (error) {
        console.warn('ContentProcessor rule failed:', error);
        // Continue with original content if processing fails
      }
    }
    
    return processed.trim();
  }

  static formatForExport(content: string): string {
    const processed = this.processContent(content);
    
    // Only remove markdown headers for plain text export
    return processed
      .replace(/^#+\s*/gm, '')
      .trim();
  }
} 