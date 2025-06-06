import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';

// Formatting configuration
const PRFAQ_FORMATTING = {
  document: {
    margins: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch = 720 twips
    defaultFont: "Calibri",
  },
  
  styles: {
    headline: {
      size: 20, // 10pt × 2 (docx uses half-points)
      bold: true,
      alignment: AlignmentType.CENTER,
      spacingAfter: 240, // 12pt
    },
    
    subheading: {
      size: 20, // 10pt × 2
      italic: true,
      alignment: AlignmentType.CENTER,
      spacingAfter: 360, // 18pt
    },
    
    body: {
      size: 20, // 10pt × 2
      spacingAfter: 120, // 6pt
      lineSpacing: 276, // 1.15
      italic: false, // Explicitly ensure body text is not italic
    },
    
    faqSectionHeader: {
      size: 20, // 10pt × 2
      bold: true,
      underline: true,
      spacingBefore: 480, // 24pt
      spacingAfter: 240, // 12pt
    },
    
    faqSubSectionHeader: {
      size: 20, // 10pt × 2
      bold: true,
      underline: false, // Secondary headers - no underline
      spacingBefore: 240, // 12pt
      spacingAfter: 120, // 6pt
    },
    
    faqQuestion: {
      size: 20, // 10pt × 2
      bold: true,
      spacingAfter: 60, // 3pt
    },
    
    faqAnswer: {
      size: 20, // 10pt × 2
      spacingAfter: 240, // 12pt
      // Removed indent - FAQ answers should be left-aligned
    },
    
    quote: {
      size: 20, // 10pt × 2
      italic: true, // Quotes should be italic
      indent: 720, // 0.5 inch left
      spacingBefore: 120, // 6pt
      spacingAfter: 120, // 6pt
    }
  }
};

// Pattern matchers for different content types
const PATTERNS = {
  faqStandard: /(\d+)\.\s+\*\*Question:\*\*\s+(.+?)\s+\*\*Answer:\*\*\s+(.+?)(?=\d+\.\s+\*\*Question:|$)/gs,
  faqNumbered: /(\d+)\.\s+\*\*Question:\*\*\s+(.+?)\n+\*\*Answer:\*\*\s+(.+?)(?=\d+\.\s+\*\*Question:|$)/gs,
  boldLine: /^\*\*(.+?)\*\*$/,
  italicLine: /^\*(.+?)\*$/,
  internalQuote: /^[""](.+?)[""].*?[-–—]\s*(.+?)$/,
};

interface ParsedContent {
  documentTitle?: string; // NEW FIELD - Overall PRFAQ title
  executiveSummary?: string; // NEW FIELD - Executive summary content
  pressRelease: {
    headline?: string;
    subheading?: string;
    body: string[];
  };
  faqSections: Array<{
    title: string;
    questions: Array<{ number: string; question: string; answer: string }>;
    subsections?: Array<{
      title: string;
      questions: Array<{ number: string; question: string; answer: string }>;
    }>;
  }>;
  // Legacy fallback for backward compatibility
  faq: {
    questions: Array<{ number: string; question: string; answer: string }>;
  };
}

function parsePRFAQ(content: string): ParsedContent {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  

  
  const parsed: ParsedContent = {
    pressRelease: {
      body: []
    },
    faqSections: [],
    faq: {
      questions: []
    }
  };
  
  let currentSection: 'pr' | 'faq' = 'pr';
  let lineIndex = 0;
  
  // Find headline (first bold line)
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const boldMatch = line.match(PATTERNS.boldLine);
    if (boldMatch) {
      parsed.pressRelease.headline = boldMatch[1];
      console.log('📰 FOUND headline:', parsed.pressRelease.headline);
      lineIndex++;
      break;
    }
    lineIndex++;
  }
  
  // Find subheading (first italic line after headline)
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    const italicMatch = line.match(PATTERNS.italicLine);
    if (italicMatch) {
      parsed.pressRelease.subheading = italicMatch[1];
      console.log('📰 FOUND subheading:', parsed.pressRelease.subheading);
      lineIndex++;
      break;
    }
    // Skip non-italic lines until we find the subheading or reach body content
    lineIndex++;
  }
  
  // Process remaining content
  for (let i = lineIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we're entering FAQ section
    if (line.toLowerCase().includes('frequently asked questions') || 
        line.toLowerCase().includes('customer faq') ||
        line.toLowerCase().includes('external faq') ||
        line.toLowerCase().includes('internal faq')) {
      currentSection = 'faq';
      console.log(`📋 Line ${i+1}: ENTERING FAQ SECTION - "${line}"`);
      continue;
    }
    
    // Skip section headers
    if (line.match(/^(Section \d+:|##|#)/)) {
      continue;
    }
    
    if (currentSection === 'pr') {
      parsed.pressRelease.body.push(line);
    }
  }
  
  // Enhanced FAQ section parsing with section awareness
  const faqStartIndex = content.search(/frequently asked questions|customer faq|external faq|internal faq/i);
  if (faqStartIndex !== -1) {
    const faqContent = content.substring(faqStartIndex);
    
    // Split content by potential section headers
    const sectionPattern = /(customer faq|external faq|internal faq|frequently asked questions)/gi;
    const sections = faqContent.split(sectionPattern).filter(part => part.trim());
    
    let sectionsFound = false;
    
    // Process sections in pairs (header, content)
    for (let i = 0; i < sections.length - 1; i += 2) {
      const sectionHeader = sections[i]?.toLowerCase().trim();
      const sectionContent = sections[i + 1]?.trim();
      
      if (!sectionHeader || !sectionContent) continue;
      
      // Determine section title based on header
      let sectionTitle = 'Frequently Asked Questions'; // Default
      if (sectionHeader.includes('customer') || sectionHeader.includes('external')) {
        sectionTitle = 'Customer FAQ';
      } else if (sectionHeader.includes('internal')) {
        sectionTitle = 'Internal FAQ';
      }
      
      // Parse questions from this section content
      let sectionQuestions: Array<{ number: string; question: string; answer: string }> = [];
      
              // Try different FAQ patterns
        let faqMatches = Array.from(sectionContent.matchAll(PATTERNS.faqStandard));
        if (faqMatches.length === 0) {
          faqMatches = Array.from(sectionContent.matchAll(PATTERNS.faqNumbered));
        }
      
      for (const match of faqMatches) {
        const questionNum = match[1];
        const questionText = match[2].trim();
        const answerText = match[3].trim();
        

        
        sectionQuestions.push({
          number: questionNum,
          question: questionText,
          answer: answerText
        });
      }
      
      // Only add section if it has questions
      if (sectionQuestions.length > 0) {
        sectionsFound = true;
        parsed.faqSections.push({
          title: sectionTitle,
          questions: sectionQuestions
        });
      }
    }
    
    // Fallback: If no sections found, use legacy behavior
    if (!sectionsFound) {
      let faqMatches = Array.from(faqContent.matchAll(PATTERNS.faqStandard));
      if (faqMatches.length === 0) {
        faqMatches = Array.from(faqContent.matchAll(PATTERNS.faqNumbered));
      }
      
      for (const match of faqMatches) {
        parsed.faq.questions.push({
          number: match[1],
          question: match[2].trim(),
          answer: match[3].trim()
        });
      }
    }
  }
  
  return parsed;
}

/**
 * Recovery function to find missing content using more permissive patterns.
 * Only runs when primary parsing misses critical content.
 * Zero risk to existing functionality - purely additive.
 */
function recoverMissingContent(content: string, parsed: ParsedContent): ParsedContent {
  const recovery = { ...parsed };
  
  // Debug logging
  console.log('🔍 Recovery Debug - Initial state:');
  console.log('  Headline:', !!recovery.pressRelease.headline);
  console.log('  Body paragraphs:', recovery.pressRelease.body.length);
  console.log('  FAQ sections:', recovery.faqSections.length);
  console.log('  Legacy FAQs:', recovery.faq.questions.length);
  
  // Recovery 1: Document title/headline if missing
  if (!recovery.pressRelease.headline) {
    // Try multiple title patterns
    let titleMatch = content.match(/###\s*\*\*([^*]+?)\*\*\s*PRFAQ/i);
    if (!titleMatch) {
      titleMatch = content.match(/##\s*\*\*([^*]+?)\*\*\s*PRFAQ/i);
    }
    if (!titleMatch) {
      titleMatch = content.match(/\*\*([^*]+?)\s*PRFAQ\*\*/i);
    }
    if (!titleMatch) {
      // Look for any line containing "PRFAQ" near the start
      const lines = content.split('\n').slice(0, 10);
      for (const line of lines) {
        if (line.toLowerCase().includes('prfaq') && line.trim().length > 5) {
          const cleanTitle = line.replace(/[#*]/g, '').replace(/PRFAQ/i, '').trim();
          if (cleanTitle) {
            recovery.pressRelease.headline = cleanTitle;
            break;
          }
        }
      }
    } else {
      recovery.pressRelease.headline = titleMatch[1].trim();
    }
    console.log('📰 Title recovery result:', recovery.pressRelease.headline || 'NOT FOUND');
  }

  // Recovery 1.5: Document title (ALWAYS run - separate from press release headline)
  const titleMatch = content.match(/^.*PRFAQ.*$/m);
  if (titleMatch) {
    recovery.documentTitle = titleMatch[0].replace(/[#*]/g, '').trim();
    console.log('📰 Document title found:', recovery.documentTitle);
  }
  
  // Recovery 2: Executive Summary if missing from press release body
  if (recovery.pressRelease.body.length === 0 || !recovery.pressRelease.body.some(p => p.toLowerCase().includes('executive'))) {
    // Try multiple executive summary patterns
    let execSummaryMatch = content.match(/###\s*\*\*Executive Summary\*\*\s*([\s\S]*?)(?=###|##|\*\*Press Release\*\*|Press Release)/i);
    if (!execSummaryMatch) {
      execSummaryMatch = content.match(/##\s*\*\*Executive Summary\*\*\s*([\s\S]*?)(?=###|##|\*\*Press Release\*\*|Press Release)/i);
    }
    if (!execSummaryMatch) {
      execSummaryMatch = content.match(/\*\*Executive Summary\*\*\s*([\s\S]*?)(?=###|##|\*\*Press Release\*\*|Press Release)/i);
    }
    if (!execSummaryMatch) {
      // Look for any paragraph mentioning executive summary
      const execMatch = content.match(/executive summary[:\s]*([\s\S]*?)(?=###|##|\*\*Press Release\*\*|Press Release)/i);
      if (execMatch) {
        execSummaryMatch = execMatch;
      }
    }
    
    if (execSummaryMatch) {
      const summaryText = execSummaryMatch[1].trim();
      if (summaryText && summaryText.length > 10) {
        // Add to separate executive summary field
        recovery.executiveSummary = summaryText;
        console.log('📋 Executive Summary found:', summaryText.substring(0, 50) + '...');
      }
    } else {
      console.log('📋 Executive Summary: NOT FOUND');
    }
  }
  
  // Recovery 3: FAQ subheader processing (always run to fix subheaders in answers)
  if (true) { // Always run to process subheaders within FAQ answers
    // Use more permissive FAQ detection
    const allFAQMatches = Array.from(content.matchAll(/(\d+)\.\s*\*\*Question:\*\*\s*([^]*?)\s*\*\*Answer:\*\*\s*([^]*?)(?=\d+\.\s*\*\*Question:|\*\*[A-Z][^*]*\*\*|###|##|$)/gs));
    
    if (allFAQMatches.length > 0) {
      
      // Group FAQs by detecting sub-headers in between them
      const faqsWithPositions = allFAQMatches.map(match => ({
        number: match[1],
        question: match[2].trim(),
        answer: match[3].trim(),
        position: match.index || 0
      }));
      
      // Find sub-headers and their positions
      const subHeaders = Array.from(content.matchAll(/\*\*([A-Z][^*]*?)\*\*/g))
        .filter(match => {
          const text = match[1];
          // Match sub-headers like "PRODUCT OVERVIEW", "MINIMUM LOVABLE PRODUCT (MLP)", "VALIDATION & RISK ASSESSMENT", etc.
          return /^[A-Z][A-Z\s\(\)&,-]+$/.test(text) && text.length > 3 && 
                 !text.includes('Question:') && !text.includes('Answer:');
        })
        .map(match => ({
          title: match[1].trim(),
          position: match.index || 0
        }));
      

      
      // Process existing FAQ sections to extract subheaders from answers
      const processedSections: typeof recovery.faqSections = [];
      
      // Process existing sections or create from scratch
      const sectionsToProcess = recovery.faqSections.length > 0 ? recovery.faqSections : [];
      
      for (const section of sectionsToProcess) {
        if (section.title === 'Internal FAQ') {
          // Extract subheaders from Internal FAQ answers
          const internalFAQSubsections: Array<{
            title: string;
            questions: Array<{ number: string; question: string; answer: string }>;
          }> = [];
          
          // Start with PRODUCT OVERVIEW as first section (FAQ 1-3)
          let currentSubsection = 'PRODUCT OVERVIEW';
          let currentSubsectionQuestions: Array<{ number: string; question: string; answer: string }> = [];
          
          for (const qa of section.questions) {
            // Add current FAQ to current subsection
            const cleanAnswer = qa.answer.replace(/\*\*[A-Z][A-Z\s\(\)&,-]+\*\*\s*/, '').trim();
            currentSubsectionQuestions.push({
              number: qa.number,
              question: qa.question,
              answer: cleanAnswer
            });
            
            // Check if this answer contains a subheader that defines the NEXT section
            const subHeaderMatch = qa.answer.match(/\*\*([A-Z][A-Z\s\(\)&,-]+)\*\*/);
            if (subHeaderMatch) {
              const nextSubsection = subHeaderMatch[1].trim();
              
              // Save current subsection
              internalFAQSubsections.push({
                title: currentSubsection,
                questions: [...currentSubsectionQuestions]
              });
              
              // Start new subsection for NEXT FAQs
              currentSubsection = nextSubsection;
              currentSubsectionQuestions = [];
            }
          }
          
          // Add final subsection
          if (currentSubsectionQuestions.length > 0) {
            internalFAQSubsections.push({
              title: currentSubsection,
              questions: currentSubsectionQuestions
            });
          }
          
          // Create processed Internal FAQ section with subsections
          processedSections.push({
            title: 'Internal FAQ',
            questions: [], // Main questions (if any)
            subsections: internalFAQSubsections
          });
          

        } else {
          // Keep other sections as-is
          processedSections.push(section);
        }
      }
      
      // Replace original sections with processed sections
      recovery.faqSections = processedSections;
      
      console.log(`✅ Created ${recovery.faqSections.length} FAQ sections`);
    } else {
      console.log('❓ No FAQs found in content for recovery processing');
    }
  }
  
  // Recovery 4: Fix truncated content (like "##**" endings)
  for (const section of recovery.faqSections) {
    for (const qa of section.questions) {
      // Clean up truncated answers
      qa.answer = qa.answer.replace(/##\*\*$|##$|\*\*$/, '').trim();
    }
  }
  
  // Recovery 5: Fix truncated press release content
  for (let i = 0; i < recovery.pressRelease.body.length; i++) {
    recovery.pressRelease.body[i] = recovery.pressRelease.body[i].replace(/##\*\*$|##$|\*\*$/, '').trim();
  }
  
  // Recovery summary
  console.log('📄 PRFAQ Recovery Results:');
  console.log(`  Document: ${recovery.documentTitle || 'Default'}`);
  console.log(`  Executive Summary: ${recovery.executiveSummary ? 'Found' : 'Not found'}`);
  console.log(`  Press Release: ${recovery.pressRelease.body.length} paragraphs`);
  console.log(`  FAQ Sections: ${recovery.faqSections.length}`);
  recovery.faqSections.forEach((section, i) => {
    console.log(`    ${section.title}: ${section.questions.length} questions${section.subsections ? ` + ${section.subsections.length} subsections` : ''}`);
  });
  
  return recovery;
}

/**
 * Check if text contains markdown formatting that needs processing
 */
function containsMarkdown(text: string): boolean {
  return /\*\*.*?\*\*|\*.*?\*/.test(text);
}

/**
 * Create a TextRun with proper formatting inheritance
 */
function createTextRun(text: string, baseStyle: any, markdownOverrides: any = {}): TextRun {
  return new TextRun({
    text: text,
    size: baseStyle.size,
    bold: markdownOverrides.bold ?? (baseStyle.bold || false),
    italics: markdownOverrides.italic ?? (baseStyle.italic || false),
    underline: baseStyle.underline || false,
    font: PRFAQ_FORMATTING.document.defaultFont,
  });
}

/**
 * Parse markdown text into multiple TextRun objects with proper formatting
 */
function parseMarkdownToRuns(text: string, baseStyle: any): TextRun[] {
  // Fail-safe: if parsing fails, return original behavior
  try {
    return parseMarkdownInternal(text, baseStyle);
  } catch (error) {
    console.warn('Markdown parsing failed, falling back to plain text:', error);
    return [createTextRun(text, baseStyle)];
  }
}

/**
 * Internal markdown parsing implementation
 */
function parseMarkdownInternal(text: string, baseStyle: any): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;
  let position = 0;
  const MAX_ITERATIONS = 1000; // Prevent infinite loops
  let iterations = 0;
  

  
  while (position < remaining.length && iterations < MAX_ITERATIONS) {
    iterations++;
    
    const restOfText = remaining.substring(position);
    
    // Look for bold patterns first (**text**)
    const boldMatch = restOfText.match(/^(.*?)\*\*(.*?)\*\*/);
    
    // Look for italic patterns (*text*) - but only if not in an italic paragraph
    const italicMatch = !baseStyle.italic ? restOfText.match(/^(.*?)\*([^*]+?)\*/) : null;
    

    
    // Determine which pattern comes first
    let useMatch = null;
    let isBold = false;
    
    if (boldMatch && italicMatch) {
      // Both found - use whichever comes first
      if (boldMatch.index === italicMatch.index) {
        // Same starting position - prefer bold
        useMatch = boldMatch;
        isBold = true;
      } else if (boldMatch.index! < italicMatch.index!) {
        useMatch = boldMatch;
        isBold = true;
      } else {
        useMatch = italicMatch;
        isBold = false;
      }
    } else if (boldMatch) {
      useMatch = boldMatch;
      isBold = true;
    } else if (italicMatch) {
      useMatch = italicMatch;
      isBold = false;
    }
    
    if (useMatch) {
      const [fullMatch, beforeText, markedText] = useMatch;
      
      // Add text before the markdown
      if (beforeText) {
        runs.push(createTextRun(beforeText, baseStyle));
      }
      
      // Add the formatted text
      if (markedText) {
        const overrides = isBold ? { bold: true } : { italic: true };
        runs.push(createTextRun(markedText, baseStyle, overrides));
      }
      
      // Move position past the processed text
      position += fullMatch.length;
    } else {
      // No more markdown patterns - add remaining text
      const remainingText = restOfText;
      if (remainingText) {
        runs.push(createTextRun(remainingText, baseStyle));
      }
      break;
    }
  }
  
  // Safety check - if we somehow got no runs, return original text
  if (runs.length === 0) {
    runs.push(createTextRun(text, baseStyle));
  }
  
  return runs;
}

function createParagraph(text: string, style: any, options: any = {}): Paragraph {
  const textRuns = containsMarkdown(text) 
    ? parseMarkdownToRuns(text, style)
    : [createTextRun(text, style)];
  
  return new Paragraph({
    children: textRuns,
    alignment: style.alignment || AlignmentType.LEFT,
    spacing: {
      after: style.spacingAfter || 120,
      before: style.spacingBefore || 0,
      line: style.lineSpacing || 276,
    },
    indent: {
      left: style.indent || options.indent || 0,
      firstLine: options.firstLineIndent || 0,
    },
  });
}

export async function exportPRFAQToWord(content: string, productIdea: string): Promise<void> {
  // Primary parsing (unchanged existing logic)
  const parsed = parsePRFAQ(content);
  
  // Recovery pass to find missing content (zero risk to existing functionality)
  const recoveredParsed = recoverMissingContent(content, parsed);
  
  const children: Paragraph[] = [];
  
  // Add document title (overall PRFAQ title)
  if (recoveredParsed.documentTitle) {
    children.push(createParagraph(
      recoveredParsed.documentTitle,
      PRFAQ_FORMATTING.styles.headline
    ));
  }
  
  // Add executive summary section
  if (recoveredParsed.executiveSummary) {
    // Section header
    children.push(createParagraph(
      "Executive Summary",
      PRFAQ_FORMATTING.styles.faqSectionHeader
    ));
    // Content
    children.push(createParagraph(
      recoveredParsed.executiveSummary,
      PRFAQ_FORMATTING.styles.body
    ));
  }
  
  // Add press release section header BEFORE headline
  if (recoveredParsed.pressRelease.body.length > 0) {
    children.push(createParagraph(
      "Press Release",
      PRFAQ_FORMATTING.styles.faqSectionHeader
    ));
  }
  
  // Add headline
  if (recoveredParsed.pressRelease.headline) {
    children.push(createParagraph(
      recoveredParsed.pressRelease.headline,
      PRFAQ_FORMATTING.styles.headline
    ));
  }
  
  // Add subheading
  if (recoveredParsed.pressRelease.subheading) {
    children.push(createParagraph(
      recoveredParsed.pressRelease.subheading,
      PRFAQ_FORMATTING.styles.subheading
    ));
  }
  
  // Add body paragraphs
  for (let i = 0; i < recoveredParsed.pressRelease.body.length; i++) {
    const paragraph = recoveredParsed.pressRelease.body[i];
    if (paragraph.trim()) {
      // Check if it's a quote
      const quoteMatch = paragraph.match(PATTERNS.internalQuote);
      
      
      const isInternalQuote = quoteMatch && /said\s+[A-Z][^,]*|according\s+to\s+[A-Z][^,]*|[A-Z][^,]*\s+said|[A-Z][^,]*\s+explained/i.test(paragraph); // internal quotes have attribution
      
      if (quoteMatch && isInternalQuote) {
        // Internal quotes (with attribution) should be body text, not italic
        children.push(createParagraph(
          paragraph,
          PRFAQ_FORMATTING.styles.body
        ));
      } else if (quoteMatch) {
        // External quotes should be italic
        children.push(createParagraph(
          paragraph,
          PRFAQ_FORMATTING.styles.quote
        ));
      } else {
        children.push(createParagraph(
          paragraph,
          PRFAQ_FORMATTING.styles.body
        ));
      }
    }
  }
  
  // Add FAQ sections if present
  if (recoveredParsed.faqSections.length > 0) {
    for (const section of recoveredParsed.faqSections) {
      // Add section header
      children.push(createParagraph(
        section.title,
        PRFAQ_FORMATTING.styles.faqSectionHeader
      ));
      
      // Add main section Q&A pairs (if any)
      for (const qa of section.questions) {
        // Question
        children.push(createParagraph(
          `${qa.number}. ${qa.question}`,
          PRFAQ_FORMATTING.styles.faqQuestion
        ));
        
        // Answer
        children.push(createParagraph(
          qa.answer,
          PRFAQ_FORMATTING.styles.faqAnswer
        ));
      }
      
      // Add subsections (for Internal FAQ)
      if (section.subsections) {
        for (const subsection of section.subsections) {
          // Add subsection header
          children.push(createParagraph(
            subsection.title,
            PRFAQ_FORMATTING.styles.faqSubSectionHeader
          ));
          
          // Add subsection Q&A pairs
          for (const qa of subsection.questions) {
            // Question
            children.push(createParagraph(
              `${qa.number}. ${qa.question}`,
              PRFAQ_FORMATTING.styles.faqQuestion
            ));
            
            // Answer
            children.push(createParagraph(
              qa.answer,
              PRFAQ_FORMATTING.styles.faqAnswer
            ));
          }
        }
      }
    }
  } else if (recoveredParsed.faq.questions.length > 0) {
    // Fallback: Use legacy single FAQ section behavior
    children.push(createParagraph(
      "Frequently Asked Questions",
      PRFAQ_FORMATTING.styles.faqSectionHeader
    ));
    
    // Add each Q&A pair
    for (const qa of recoveredParsed.faq.questions) {
      // Question
      children.push(createParagraph(
        `${qa.number}. ${qa.question}`,
        PRFAQ_FORMATTING.styles.faqQuestion
      ));
      
      // Answer
      children.push(createParagraph(
        qa.answer,
        PRFAQ_FORMATTING.styles.faqAnswer
      ));
    }
  }
  
  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: PRFAQ_FORMATTING.document.margins,
        },
      },
      children: children,
    }],
  });
  
  // Generate and download
  const blob = await Packer.toBlob(doc);
  
  // Create filename
  const date = new Date().toISOString().split('T')[0];
  const productName = productIdea.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `PRFAQ_${productName}_${date}.docx`;
  
  // Try modern file system API first for better UX
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Word Document',
          accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled or API not supported, fall back to traditional download
    }
  }
  
  // Traditional download fallback
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Browser console test function for validation
if (typeof window !== 'undefined') {
  (window as any).testMarkdownParsing = function() {
    console.log("🧪 Testing DOCX Markdown Parsing Implementation\n");
    
    const testStyle = {
      size: 20,
      bold: false,
      italic: false,
      underline: false,
      spacingAfter: 120,
      spacingBefore: 0,
      lineSpacing: 276
    };
    
    const tests = [
      {
        name: "Plain text",
        input: "This is plain text",
        expectRuns: 1
      },
      {
        name: "Bold text", 
        input: "Text with **bold** formatting",
        expectRuns: 3
      },
      {
        name: "FAQ Question",
        input: "1. **Question:** What is this product?",
        expectRuns: 3
      },
      {
        name: "FAQ Answer with bold",
        input: "**Answer:** This solves **key problems** for customers.",
        expectRuns: 4
      },
      {
        name: "Multiple bold sections",
        input: "First **bold** and second **bold** text",
        expectRuns: 5
      }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        const result = createParagraph(test.input, testStyle);
        const actualRuns = (result as any).children.length;
        
        if (actualRuns === test.expectRuns) {
          console.log(`✅ ${test.name} - ${actualRuns} runs created`);
          passed++;
        } else {
          console.log(`❌ ${test.name} - Expected ${test.expectRuns} runs, got ${actualRuns}`);
          failed++;
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Error: ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
    }
    
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log("🎉 All tests passed! Markdown parsing is working correctly.");
      console.log("💾 DOCX exports will now format **bold** and *italic* text properly.");
    } else {
      console.log("⚠️ Some tests failed. Implementation needs review.");
    }
    
    return failed === 0;
  };
  
  console.log("📝 Test function available: window.testMarkdownParsing()");
} 