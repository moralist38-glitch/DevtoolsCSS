/**
 * StyleForge - Style Injector Module
 * Handles dynamic <style> management and specificity handling
 */

class StyleInjector {
  constructor() {
    this.styleElement = null;
    this.styles = new Map(); // selector -> style rules
    this.debounceTimer = null;
    this.debounceDelay = 50; // ms
  }

  /**
   * Initialize the style injector
   */
  init() {
    this.ensureStyleElement();
    return this;
  }

  /**
   * Ensure style element exists in document
   */
  ensureStyleElement() {
    if (this.styleElement && document.contains(this.styleElement)) {
      return this.styleElement;
    }

    this.styleElement = document.getElementById('styleforge-inject');
    
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'styleforge-inject';
      this.styleElement.setAttribute('data-styleforge', 'true');
      
      // Insert at the end of head to have high specificity
      const head = document.head || document.documentElement;
      head.appendChild(this.styleElement);
    }

    return this.styleElement;
  }

  /**
   * Set styles for a selector
   * @param {string} selector - CSS selector
   * @param {object} cssRules - CSS properties object
   * @param {string} state - State (base, hover, focus, etc.)
   * @param {string} breakpoint - Breakpoint (all, sm, md, lg, xl, 2xl)
   */
  setStyles(selector, cssRules, state = 'base', breakpoint = 'all') {
    const key = this.getStyleKey(selector, state, breakpoint);
    
    this.styles.set(key, {
      selector,
      state,
      breakpoint,
      rules: { ...cssRules },
      updatedAt: Date.now()
    });

    // Debounce the actual injection
    this.scheduleInjection();
    
    return this;
  }

  /**
   * Add Tailwind classes to a selector
   * @param {string} selector - CSS selector
   * @param {array} classes - Array of Tailwind classes
   * @param {string} state - State (base, hover, focus, etc.)
   * @param {string} breakpoint - Breakpoint (all, sm, md, lg, xl, 2xl)
   */
  addTailwindClasses(selector, classes, state = 'base', breakpoint = 'all') {
    const key = this.getTailwindKey(selector, state, breakpoint);
    
    const existing = this.styles.get(key) || {
      selector,
      state,
      breakpoint,
      classes: [],
      type: 'tailwind',
      updatedAt: Date.now()
    };

    // Add new classes, avoid duplicates
    const newClasses = classes.filter(c => !existing.classes.includes(c));
    existing.classes = [...existing.classes, ...newClasses];
    existing.updatedAt = Date.now();
    
    this.styles.set(key, existing);
    this.scheduleInjection();
    
    return this;
  }

  /**
   * Remove Tailwind classes from a selector
   * @param {string} selector - CSS selector
   * @param {array} classes - Array of Tailwind classes to remove
   * @param {string} state - State
   * @param {string} breakpoint - Breakpoint
   */
  removeTailwindClasses(selector, classes, state = 'base', breakpoint = 'all') {
    const key = this.getTailwindKey(selector, state, breakpoint);
    const existing = this.styles.get(key);
    
    if (!existing) return this;

    existing.classes = existing.classes.filter(c => !classes.includes(c));
    existing.updatedAt = Date.now();
    
    if (existing.classes.length === 0) {
      this.styles.delete(key);
    } else {
      this.styles.set(key, existing);
    }
    
    this.scheduleInjection();
    
    return this;
  }

  /**
   * Get all styles for a selector
   */
  getStyles(selector) {
    const result = {
      css: {},
      tailwind: {},
      states: ['base', 'hover', 'focus', 'focus-visible', 'active', 'disabled', 'checked'],
      breakpoints: ['all', 'sm', 'md', 'lg', 'xl', '2xl']
    };

    for (const [key, data] of this.styles.entries()) {
      if (data.selector !== selector) continue;
      
      const stateKey = data.state;
      const breakpointKey = data.breakpoint;
      
      if (!result[stateKey]) {
        result[stateKey] = {};
      }
      
      if (!result[stateKey][breakpointKey]) {
        result[stateKey][breakpointKey] = { css: {}, tailwind: [] };
      }
      
      if (data.type === 'tailwind') {
        result[stateKey][breakpointKey].tailwind = data.classes || [];
      } else {
        result[stateKey][breakpointKey].css = data.rules || {};
      }
    }

    return result;
  }

  /**
   * Remove all styles for a selector
   */
  removeStyles(selector) {
    for (const [key, data] of this.styles.entries()) {
      if (data.selector === selector) {
        this.styles.delete(key);
      }
    }
    this.scheduleInjection();
    return this;
  }

  /**
   * Clear all styles
   */
  clearAll() {
    this.styles.clear();
    this.scheduleInjection();
    return this;
  }

  /**
   * Reset styles for a specific state and breakpoint
   */
  resetState(selector, state, breakpoint = 'all') {
    const key = this.getStyleKey(selector, state, breakpoint);
    const twKey = this.getTailwindKey(selector, state, breakpoint);
    
    this.styles.delete(key);
    this.styles.delete(twKey);
    this.scheduleInjection();
    
    return this;
  }

  /**
   * Schedule style injection with debounce
   */
  scheduleInjection() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.inject();
    }, this.debounceDelay);
  }

  /**
   * Inject all styles into the page
   */
  inject() {
    if (!this.styleElement) {
      this.ensureStyleElement();
    }

    const css = this.generateCSS();
    this.styleElement.textContent = css;
  }

  /**
   * Generate CSS string from stored styles
   */
  generateCSS() {
    let css = '';
    
    // Group styles by breakpoint
    const breakpointGroups = new Map();
    
    for (const [key, data] of this.styles.entries()) {
      const bp = data.breakpoint;
      
      if (!breakpointGroups.has(bp)) {
        breakpointGroups.set(bp, []);
      }
      
      breakpointGroups.get(bp).push(data);
    }

    // Generate CSS for each breakpoint
    for (const [breakpoint, styles] of breakpointGroups.entries()) {
      const mediaQuery = this.getMediaQuery(breakpoint);
      
      if (mediaQuery) {
        css += `${mediaQuery} {\n`;
      }
      
      for (const data of styles) {
        const fullSelector = this.buildSelector(data.selector, data.state);
        
        if (data.type === 'tailwind') {
          // Skip Tailwind classes in CSS generation (they're applied directly to elements)
          continue;
        } else {
          const rules = this.formatRules(data.rules);
          if (rules) {
            css += `  ${fullSelector} {\n${rules}\n  }\n\n`;
          }
        }
      }
      
      if (mediaQuery) {
        css += '}\n\n';
      }
    }

    return css.trim();
  }

  /**
   * Build full selector with state pseudo-class
   */
  buildSelector(selector, state) {
    if (!state || state === 'base') {
      return selector;
    }
    
    return `${selector}${state}`;
  }

  /**
   * Get media query for breakpoint
   */
  getMediaQuery(breakpoint) {
    const breakpoints = {
      'sm': '@media (min-width: 640px)',
      'md': '@media (min-width: 768px)',
      'lg': '@media (min-width: 1024px)',
      'xl': '@media (min-width: 1280px)',
      '2xl': '@media (min-width: 1536px)'
    };
    
    return breakpoints[breakpoint] || null;
  }

  /**
   * Format CSS rules object to string
   */
  formatRules(rules) {
    if (!rules || Object.keys(rules).length === 0) {
      return '';
    }
    
    return Object.entries(rules)
      .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
      .map(([prop, value]) => `    ${this.camelToKebab(prop)}: ${value};`)
      .join('\n');
  }

  /**
   * Convert camelCase to kebab-case
   */
  camelToKebab(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Get unique key for CSS styles
   */
  getStyleKey(selector, state, breakpoint) {
    return `css:${selector}:${state}:${breakpoint}`;
  }

  /**
   * Get unique key for Tailwind classes
   */
  getTailwindKey(selector, state, breakpoint) {
    return `tw:${selector}:${state}:${breakpoint}`;
  }

  /**
   * Apply Tailwind classes directly to element
   */
  applyTailwindClasses(selector, classes, state = 'base') {
    // Find element by selector
    const element = document.querySelector(selector);
    if (!element) return false;

    // For base state, apply classes directly
    if (state === 'base') {
      const existingClasses = element.className.split(/\s+/).filter(c => c);
      const newClasses = classes.filter(c => !existingClasses.includes(c));
      element.classList.add(...newClasses);
      return true;
    }

    // For other states, we need to use CSS or JS event handlers
    // This is a limitation - Tailwind state classes need to be in the HTML
    return false;
  }

  /**
   * Get all stored styles as object
   */
  getAllStyles() {
    const result = {};
    
    for (const [key, data] of this.styles.entries()) {
      const { selector, state, breakpoint } = data;
      
      if (!result[selector]) {
        result[selector] = {};
      }
      
      if (!result[selector][state]) {
        result[selector][state] = {};
      }
      
      if (!result[selector][state][breakpoint]) {
        result[selector][state][breakpoint] = { css: {}, tailwind: [] };
      }
      
      if (data.type === 'tailwind') {
        result[selector][state][breakpoint].tailwind = data.classes || [];
      } else {
        result[selector][state][breakpoint].css = data.rules || {};
      }
    }
    
    return result;
  }

  /**
   * Load styles from object
   */
  loadStyles(stylesObj) {
    for (const [selector, states] of Object.entries(stylesObj)) {
      for (const [state, breakpoints] of Object.entries(states)) {
        for (const [breakpoint, data] of Object.entries(breakpoints)) {
          if (data.css && Object.keys(data.css).length > 0) {
            this.setStyles(selector, data.css, state, breakpoint);
          }
          if (data.tailwind && data.tailwind.length > 0) {
            this.addTailwindClasses(selector, data.tailwind, state, breakpoint);
          }
        }
      }
    }
    
    return this;
  }

  /**
   * Export styles for persistence
   */
  exportStyles() {
    return this.getAllStyles();
  }

  /**
   * Handle Shadow DOM ::part() selectors
   */
  setPartStyles(hostSelector, partName, cssRules, state = 'base', breakpoint = 'all') {
    const selector = `${hostSelector}::part(${partName})`;
    return this.setStyles(selector, cssRules, state, breakpoint);
  }

  /**
   * Validate CSS property and value
   */
  validateProperty(property, value) {
    if (!property || !value) return false;
    
    // Basic validation - check if it's a known property
    const testEl = document.createElement('div');
    testEl.style[property] = value;
    
    // If the browser accepts it, it's valid
    return testEl.style[property] !== '';
  }

  /**
   * Force apply with !important
   */
  setImportantStyles(selector, cssRules, state = 'base', breakpoint = 'all') {
    const importantRules = {};
    
    for (const [prop, value] of Object.entries(cssRules)) {
      if (value && !String(value).includes('!important')) {
        importantRules[prop] = `${value} !important`;
      } else {
        importantRules[prop] = value;
      }
    }
    
    return this.setStyles(selector, importantRules, state, breakpoint);
  }
}

// Export for use in content script
window.StyleForgeInjector = StyleInjector;
