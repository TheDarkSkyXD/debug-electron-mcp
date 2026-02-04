/**
 * Enhanced Electron interaction commands for React-based applications
 * Addresses common issues with form interactions, event handling, and state management
 */

/**
 * Securely escape text input for JavaScript code generation
 */
function escapeJavaScriptString(input: string): string {
  // Use JSON.stringify for proper escaping of quotes, newlines, and special characters
  return JSON.stringify(input);
}

/**
 * Validate text input for potential security issues
 */
function validateTextInput(text: string): {
  isValid: boolean;
  sanitized: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let sanitized = text;

  // Check for suspicious patterns
  if (text.includes('javascript:')) warnings.push('Contains javascript: protocol');
  if (text.includes('<script')) warnings.push('Contains script tags');
  if (text.match(/['"]\s*;\s*/)) warnings.push('Contains potential code injection');
  if (text.length > 1000) warnings.push('Input text is unusually long');

  // Basic sanitization - remove potentially dangerous content
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.substring(0, 1000); // Limit length

  return {
    isValid: warnings.length === 0,
    sanitized,
    warnings,
  };
}

export interface ElementAnalysis {
  element?: Element;
  tag: string;
  text: string;
  id: string;
  className: string;
  name: string;
  placeholder: string;
  type: string;
  value: string;
  ariaLabel: string;
  ariaRole: string;
  title: string;
  href: string;
  src: string;
  alt: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  isInteractive: boolean;
  zIndex: number;
  backgroundColor: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  cursor: string;
  context: string;
  selector: string;
  xpath: string;
}

export interface PageAnalysis {
  clickable: ElementAnalysis[];
  inputs: ElementAnalysis[];
  links: ElementAnalysis[];
  images: ElementAnalysis[];
  text: ElementAnalysis[];
  containers: ElementAnalysis[];
  metadata: {
    totalElements: number;
    visibleElements: number;
    interactiveElements: number;
    pageTitle: string;
    pageUrl: string;
    viewport: {
      width: number;
      height: number;
    };
  };
}

/**
 * Generate the enhanced find_elements command with deep DOM analysis
 */
export function generateFindElementsCommand(): string {
  return `
    (function() {
      // Deep DOM analysis functions
      function analyzeElement(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().substring(0, 100),
          id: el.id || '',
          className: el.className || '',
          name: el.name || '',
          placeholder: el.placeholder || '',
          type: el.type || '',
          value: el.value || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaRole: el.getAttribute('role') || '',
          title: el.title || '',
          href: el.href || '',
          src: el.src || '',
          alt: el.alt || '',
          position: { 
            x: Math.round(rect.left), 
            y: Math.round(rect.top), 
            width: Math.round(rect.width), 
            height: Math.round(rect.height) 
          },
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity > 0,
          isInteractive: isInteractiveElement(el),
          zIndex: parseInt(style.zIndex) || 0,
          backgroundColor: style.backgroundColor,
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          cursor: style.cursor,
          context: getElementContext(el),
          selector: generateSelector(el),
          xpath: generateXPath(el)
        };
      }
      
      function isInteractiveElement(el) {
        const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
        const interactiveTypes = ['button', 'submit', 'reset', 'checkbox', 'radio'];
        const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'option'];
        
        return interactiveTags.includes(el.tagName) ||
               interactiveTypes.includes(el.type) ||
               interactiveRoles.includes(el.getAttribute('role')) ||
               el.hasAttribute('onclick') ||
               el.hasAttribute('onsubmit') ||
               el.getAttribute('contenteditable') === 'true' ||
               getComputedStyle(el).cursor === 'pointer';
      }
      
      function getElementContext(el) {
        const context = [];
        
        // Get form context
        const form = el.closest('form');
        if (form) {
          const formTitle = form.querySelector('h1, h2, h3, h4, h5, h6, .title');
          if (formTitle) context.push('Form: ' + formTitle.textContent.trim().substring(0, 50));
        }
        
        // Get parent container context
        const container = el.closest('section, article, div[class*="container"], div[class*="card"], div[class*="panel"]');
        if (container && container !== form) {
          const heading = container.querySelector('h1, h2, h3, h4, h5, h6, .title, .heading');
          if (heading) context.push('Container: ' + heading.textContent.trim().substring(0, 50));
        }
        
        // Get nearby labels
        const label = findElementLabel(el);
        if (label) context.push('Label: ' + label.substring(0, 50));
        
        return context.join(' | ');
      }
      
      function findElementLabel(el) {
        // For inputs, find associated label
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          if (el.id) {
            const label = document.querySelector(\`label[for="\${el.id}"]\`);
            if (label) return label.textContent.trim();
          }
          
          // Check if nested in label
          const parentLabel = el.closest('label');
          if (parentLabel) return parentLabel.textContent.trim();
          
          // Check aria-labelledby
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            if (labelEl) return labelEl.textContent.trim();
          }
        }
        
        return '';
      }
      
      function generateSelector(el) {
        // Generate a robust CSS selector
        if (el.id) return '#' + el.id;
        
        let selector = el.tagName.toLowerCase();
        
        if (el.className) {
          const classes = el.className.split(' ').filter(c => c && !c.match(/^(ng-|v-|_)/));
          if (classes.length > 0) {
            selector += '.' + classes.slice(0, 3).join('.');
          }
        }
        
        // Add attribute selectors for better specificity
        if (el.name) selector += \`[name="\${el.name}"]\`;
        if (el.type && el.tagName === 'INPUT') selector += \`[type="\${el.type}"]\`;
        if (el.placeholder) selector += \`[placeholder*="\${el.placeholder.substring(0, 20)}"]\`;
        
        return selector;
      }
      
      function generateXPath(el) {
        if (el.id) return \`//*[@id="\${el.id}"]\`;
        
        let path = '';
        let current = el;
        
        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          
          if (current.id) {
            path = \`//*[@id="\${current.id}"]\` + path;
            break;
          }
          
          const siblings = Array.from(current.parentNode?.children || []).filter(
            sibling => sibling.tagName === current.tagName
          );
          
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += \`[\${index}]\`;
          }
          
          path = '/' + selector + path;
          current = current.parentElement;
        }
        
        return path || '//body' + path;
      }
      
      // Categorize elements by type
      const analysis = {
        clickable: [],
        inputs: [],
        links: [],
        images: [],
        text: [],
        containers: [],
        metadata: {
          totalElements: 0,
          visibleElements: 0,
          interactiveElements: 0,
          pageTitle: document.title,
          pageUrl: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };
      
      // Analyze all elements
      const allElements = document.querySelectorAll('*');
      analysis.metadata.totalElements = allElements.length;
      
      for (let el of allElements) {
        const elementAnalysis = analyzeElement(el);
        
        if (!elementAnalysis.isVisible) continue;
        analysis.metadata.visibleElements++;
        
        if (elementAnalysis.isInteractive) {
          analysis.metadata.interactiveElements++;
          
          // Categorize clickable elements
          if (['button', 'a', 'input'].includes(elementAnalysis.tag) || 
              ['button', 'submit'].includes(elementAnalysis.type) ||
              elementAnalysis.ariaRole === 'button') {
            analysis.clickable.push(elementAnalysis);
          }
        }
        
        // Categorize inputs
        if (['input', 'textarea', 'select'].includes(elementAnalysis.tag)) {
          analysis.inputs.push(elementAnalysis);
        }
        
        // Categorize links
        if (elementAnalysis.tag === 'a' && elementAnalysis.href) {
          analysis.links.push(elementAnalysis);
        }
        
        // Categorize images
        if (elementAnalysis.tag === 'img') {
          analysis.images.push(elementAnalysis);
        }
        
        // Categorize text elements with significant content
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'].includes(elementAnalysis.tag) &&
            elementAnalysis.text.length > 10 && elementAnalysis.text.length < 200) {
          analysis.text.push(elementAnalysis);
        }
        
        // Categorize important containers
        if (['form', 'section', 'article', 'main', 'nav', 'header', 'footer'].includes(elementAnalysis.tag) ||
            elementAnalysis.className.match(/(container|wrapper|card|panel|modal|dialog)/i)) {
          analysis.containers.push(elementAnalysis);
        }
      }
      
      // Limit results to prevent overwhelming output
      const maxResults = 20;
      Object.keys(analysis).forEach(key => {
        if (Array.isArray(analysis[key]) && analysis[key].length > maxResults) {
          analysis[key] = analysis[key].slice(0, maxResults);
        }
      });
      
      return JSON.stringify(analysis, null, 2);
    })()
  `;
}

/**
 * Generate the enhanced click_by_text command with improved element scoring
 */
export function generateClickByTextCommand(text: string): string {
  // Validate and sanitize input text
  const validation = validateTextInput(text);
  if (!validation.isValid) {
    return `(function() { return "Security validation failed: ${validation.warnings.join(
      ', ',
    )}"; })()`;
  }

  // Escape the text to prevent JavaScript injection
  const escapedText = escapeJavaScriptString(validation.sanitized);

  return `
    (function() {
      const targetText = ${escapedText};  // Safe: JSON.stringify escapes quotes and special chars
      
      // Deep DOM analysis function
      function analyzeElement(el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        
        return {
          element: el,
          text: (el.textContent || '').trim(),
          ariaLabel: el.getAttribute('aria-label') || '',
          title: el.title || '',
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
          isInteractive: el.tagName.match(/^(BUTTON|A|INPUT)$/) || el.hasAttribute('onclick') || el.getAttribute('role') === 'button' || style.cursor === 'pointer',
          rect: rect,
          zIndex: parseInt(style.zIndex) || 0,
          opacity: parseFloat(style.opacity) || 1
        };
      }
      
      // Score element relevance with improved text matching
      function scoreElement(analysis, target) {
        let score = 0;
        const text = analysis.text.toLowerCase().trim();
        const label = analysis.ariaLabel.toLowerCase().trim();
        const title = analysis.title.toLowerCase().trim();
        const targetLower = target.toLowerCase().trim();
        if (!targetLower) return 0;
        const targetWords = targetLower.split(/\s+/).filter(w => w.length > 0);
        
        // === EXACT MATCHES (highest priority) ===
        // Case-sensitive exact match (highest confidence)
        if (analysis.text.trim() === target || analysis.ariaLabel.trim() === target || analysis.title.trim() === target) {
          return 200; // Return immediately - this is a perfect match
        }
        
        // Case-insensitive exact match
        if (text === targetLower || label === targetLower || title === targetLower) {
          return 150; // Return immediately - very high confidence
        }
        
        // === WORD-BOUNDARY MATCHES ===
        // Check if target words appear as complete words in the element
        const textWords = text.split(/\s+/).filter(w => w.length > 0);
        const labelWords = label.split(/\s+/).filter(w => w.length > 0);
        const titleWords = title.split(/\s+/).filter(w => w.length > 0);
        
        // Count how many target words are found as complete words
        let matchedWords = 0;
        for (const targetWord of targetWords) {
          if (textWords.includes(targetWord) || labelWords.includes(targetWord) || titleWords.includes(targetWord)) {
            matchedWords++;
          }
        }
        
        // All target words found as complete words = very strong match
        if (matchedWords === targetWords.length && targetWords.length > 0) {
          score += 80;
        } else if (matchedWords > 0) {
          // Partial word matches - score based on percentage
          score += Math.round((matchedWords / targetWords.length) * 50);
        }
        
        // === SUBSTRING MATCHES (lower priority) ===
        // Starts with target (but not an exact match since we handled that above)
        if (text.startsWith(targetLower) || label.startsWith(targetLower)) {
          score += 30;
        }
        // Ends with target
        else if (text.endsWith(targetLower) || label.endsWith(targetLower)) {
          score += 25;
        }
        // Contains target as substring (word-boundary aware)
        else if (containsAsWholePhrase(text, targetLower) || containsAsWholePhrase(label, targetLower) || containsAsWholePhrase(title, targetLower)) {
          score += 20;
        }
        // Contains target anywhere (lowest substring priority)
        else if (text.includes(targetLower) || label.includes(targetLower) || title.includes(targetLower)) {
          score += 15;
        }
        
        // === FUZZY MATCHING (conservative) ===
        // Only apply fuzzy matching if we haven't found strong matches
        if (score < 40) {
          const similarity = Math.max(
            calculateWordSimilarity(textWords, targetWords),
            calculateWordSimilarity(labelWords, targetWords),
            calculateWordSimilarity(titleWords, targetWords)
          );
          // Use word-based similarity with lower weight
          score += Math.round(similarity * 15);
        }
        
        // === BONUSES ===
        // Bonus for interactive elements
        if (analysis.isInteractive) score += 8;
        
        // Bonus for visibility
        if (analysis.isVisible) score += 5;
        
        // Bonus for appropriately sized elements (buttons, links)
        if (analysis.rect.width > 50 && analysis.rect.width < 500 && analysis.rect.height > 20 && analysis.rect.height < 100) {
          score += 3;
        }
        
        // Small bonus for higher z-index (on top) - capped low
        score += Math.min(analysis.zIndex, 2);
        
        // === PENALTIES ===
        // Penalty for elements with lots of extra text (less specific matches)
        if (text.length > targetLower.length * 5 && score < 80) {
          score -= 10;
        }
        
        return Math.max(0, score);
      }
      
      // Check if phrase appears with word boundaries (simpler approach without regex)
      function containsAsWholePhrase(haystack, needle) {
        // Simple word boundary check without complex regex escaping
        const idx = haystack.indexOf(needle);
        if (idx === -1) return false;
        
        // Check character before needle (if exists)
        if (idx > 0) {
          const charBefore = haystack[idx - 1];
          if (/[a-z0-9]/i.test(charBefore)) return false;
        }
        
        // Check character after needle (if exists)
        const afterIdx = idx + needle.length;
        if (afterIdx < haystack.length) {
          const charAfter = haystack[afterIdx];
          if (/[a-z0-9]/i.test(charAfter)) return false;
        }
        
        return true;
      }
      
      // Word-based similarity function (more accurate than character-level)
      function calculateWordSimilarity(words1, words2) {
        if (words1.length === 0 || words2.length === 0) return 0;
        
        let matchCount = 0;
        const uniqueWords1 = [...new Set(words1)];
        const uniqueWords2 = [...new Set(words2)];
        
        // Count words that appear in both sets
        for (const word1 of uniqueWords1) {
          for (const word2 of uniqueWords2) {
            // Exact word match
            if (word1 === word2) {
              matchCount += 1;
              break;
            }
            // One word starts with the other (prefix match)
            if (word1.length >= 3 && word2.length >= 3) {
              if (word1.startsWith(word2) || word2.startsWith(word1)) {
                matchCount += 0.5;
                break;
              }
            }
          }
        }
        
        // Return ratio based on target words (words2)
        return matchCount / uniqueWords2.length;
      }
      
      // Find all potentially clickable elements
      const allElements = document.querySelectorAll('*');
      const candidates = [];
      
      for (let el of allElements) {
        const analysis = analyzeElement(el);
        
        if (analysis.isVisible && (analysis.isInteractive || analysis.text || analysis.ariaLabel)) {
          const score = scoreElement(analysis, targetText);
          if (score > 15) { // Only consider elements with meaningful relevance
            candidates.push({ ...analysis, score });
          }
        }
      }
      
      if (candidates.length === 0) {
        return \`No clickable elements found containing text: "\${targetText}"\`;
      }
      
      // Sort by score and get the best match
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      
      // Additional validation before clicking (raised threshold to reduce false positives)
      if (best.score < 40) {
        return \`Found potential matches but confidence too low (score: \${best.score}). Best match was: "\${best.text || best.ariaLabel}" - try being more specific or use click_by_selector for exact targeting.\`;
      }
      
      // Enhanced clicking for React components with duplicate prevention
      function clickElement(element) {
        // Enhanced duplicate prevention
        const elementId = element.id || element.className || element.textContent?.slice(0, 20) || 'element';
        const clickKey = 'mcp_click_text_' + btoa(elementId).slice(0, 10);
        
        // Check if this element was recently clicked
        if (window[clickKey] && Date.now() - window[clickKey] < 2000) {
          throw new Error('Element click prevented - too soon after previous click');
        }
        
        // Mark this element as clicked
        window[clickKey] = Date.now();
        
        // Prevent multiple rapid events
        const originalPointerEvents = element.style.pointerEvents;
        element.style.pointerEvents = 'none';
        
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Focus the element if focusable
        try {
          if (element.focus && typeof element.focus === 'function') {
            element.focus();
          }
        } catch (e) {
          // Focus may fail on some elements, that's ok
        }
        
        // Create and dispatch comprehensive click events for React
        const events = [
          new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
          new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        ];
        
        // Dispatch all events - don't treat preventDefault as failure
        events.forEach(event => {
          element.dispatchEvent(event);
        });
        
        // Trigger additional React events if it's a form element
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Re-enable after delay
        setTimeout(() => {
          element.style.pointerEvents = originalPointerEvents;
        }, 1000);
        
        return true;
      }
      
      try {
        const clickResult = clickElement(best.element);
        return \`Successfully clicked element (score: \${best.score}): "\${best.text || best.ariaLabel || best.title}" - searched for: "\${targetText}"\`;
      } catch (error) {
        return \`Failed to click element: \${error.message}. Element found (score: \${best.score}): "\${best.text || best.ariaLabel || best.title}"\`;
      }
    })()
  `;
}
