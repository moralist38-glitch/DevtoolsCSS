/**
 * StyleForge Content Script
 * Handles element selection, style injection, and DOM manipulation
 */

class StyleForgeContent {
  constructor() {
    this.isSelectedMode = false;
    this.selectedElement = null;
    this.highlightOverlay = null;
    this.styleElement = null;
    this.debounceTimers = {};
    
    this.init();
  }
  
  init() {
    this.createStyleElement();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    
    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
    
    // Notify background that content script is ready
    this.notifyReady();
  }
  
  createStyleElement() {
    // Remove existing if present
    const existing = document.getElementById('styleforge-inject');
    if (existing) {
      existing.remove();
    }
    
    // Create new style element
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'styleforge-inject';
    document.head.appendChild(this.styleElement);
  }
  
  setupEventListeners() {
    // Mouse over for highlight
    document.addEventListener('mouseover', (e) => {
      if (!this.isSelectedMode || e.target === this.highlightOverlay) return;
      this.showHighlight(e.target);
    }, true);
    
    // Mouse out to remove highlight
    document.addEventListener('mouseout', (e) => {
      if (!this.isSelectedMode || e.target === this.highlightOverlay) return;
      this.hideHighlight();
    }, true);
    
    // Click to select
    document.addEventListener('click', (e) => {
      if (!this.isSelectedMode) return;
      e.preventDefault();
      e.stopPropagation();
      this.selectElement(e.target);
    }, true);
    
    // Handle page navigation (SPA)
    window.addEventListener('popstate', () => {
      this.notifyReady();
    });
    
    // Monitor for DOM changes
    const observer = new MutationObserver(() => {
      if (this.styleElement && !document.contains(this.styleElement)) {
        this.createStyleElement();
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+E to toggle inspector
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        this.toggleInspector();
      }
      
      // Escape to exit inspector
      if (e.key === 'Escape' && this.isSelectedMode) {
        this.toggleInspector(false);
      }
    });
  }
  
  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'TOGGLE_INSPECTOR':
        this.toggleInspector(message.payload?.enabled);
        break;
      
      case 'APPLY_STYLES':
        this.applyStyles(message.payload.selector, message.payload.styles);
        break;
      
      case 'APPLY_ALL_STYLES':
        this.applyAllStyles(message.payload);
        break;
      
      case 'CLEAR_STYLES':
        this.clearStyles();
        break;
      
      case 'GET_ELEMENT_INFO':
        const info = this.getElementInfo(this.selectedElement);
        sendResponse(info);
        return;
    }
  }
  
  notifyReady() {
    chrome.runtime.sendMessage({
      type: 'CONTENT_READY',
      payload: {
        url: window.location.href,
        title: document.title
      }
    });
  }
  
  toggleInspector(enabled) {
    if (enabled === undefined) {
      this.isSelectedMode = !this.isSelectedMode;
    } else {
      this.isSelectedMode = enabled;
    }
    
    if (this.isSelectedMode) {
      document.body.style.cursor = 'crosshair';
      this.showNotification('Inspector mode enabled. Click an element to select it.');
    } else {
      document.body.style.cursor = '';
      this.hideHighlight();
      this.showNotification('Inspector mode disabled.');
    }
    
    chrome.runtime.sendMessage({
      type: 'INSPECTOR_TOGGLED',
      payload: { enabled: this.isSelectedMode }
    });
  }
  
  showHighlight(element) {
    if (!element) return;
    
    // Remove existing overlay
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
    }
    
    // Create highlight overlay
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'styleforge-highlight';
    
    const rect = element.getBoundingClientRect();
    Object.assign(this.highlightOverlay.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      border: '2px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      pointerEvents: 'none',
      zIndex: '2147483647',
      boxSizing: 'border-box'
    });
    
    document.body.appendChild(this.highlightOverlay);
  }
  
  hideHighlight() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  }
  
  selectElement(element) {
    if (!element) return;
    
    this.selectedElement = element;
    this.hideHighlight();
    this.toggleInspector(false);
    
    // Generate selector
    const selector = this.generateSelector(element);
    const elementInfo = this.getElementInfo(element);
    
    // Send to background
    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTED',
      payload: {
        selector,
        ...elementInfo
      }
    });
    
    this.showNotification(`Selected: ${selector}`);
  }
  
  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).slice(0, 3).join('.');
      if (classes) {
        return `${element.tagName.toLowerCase()}.${classes}`;
      }
    }
    
    // Fallback to nth-child path
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c).slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }
      
      // Add nth-child if needed
      let sibling = current;
      let count = 1;
      while ((sibling = sibling.previousElementSibling) !== null) {
        if (sibling.tagName === current.tagName) {
          count++;
        }
      }
      
      if (count > 1 || !current.id) {
        selector += `:nth-child(${count})`;
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }
  
  getElementInfo(element) {
    const computed = window.getComputedStyle(element);
    
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      text: element.textContent?.trim().substring(0, 50) || null,
      dimensions: {
        width: element.offsetWidth,
        height: element.offsetHeight
      },
      styles: {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        padding: computed.padding,
        margin: computed.margin,
        border: computed.border,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        display: computed.display,
        justifyContent: computed.justifyContent,
        alignItems: computed.alignItems,
        flexDirection: computed.flexDirection,
        gap: computed.gap,
        position: computed.position,
        zIndex: computed.zIndex,
        width: computed.width,
        height: computed.height,
        minWidth: computed.minWidth,
        minHeight: computed.minHeight,
        maxWidth: computed.maxWidth,
        maxHeight: computed.maxHeight
      }
    };
  }
  
  applyStyles(selector, styles) {
    const cssRules = this.generateCSSRules(selector, styles);
    this.updateStyleElement(cssRules);
  }
  
  applyAllStyles(allStyles) {
    let allCSS = '';
    
    for (const [selector, styles] of Object.entries(allStyles)) {
      allCSS += this.generateCSSRules(selector, styles);
    }
    
    this.styleElement.textContent = allCSS;
  }
  
  generateCSSRules(selector, styles) {
    let css = '';
    
    for (const [state, breakpoints] of Object.entries(styles)) {
      for (const [breakpoint, properties] of Object.entries(breakpoints)) {
        const props = Object.entries(properties)
          .map(([prop, val]) => `${prop}: ${val};`)
          .join(' ');
        
        let rule = '';
        
        // Handle state
        let selectorWithState = selector;
        if (state !== 'base') {
          selectorWithState += `:${state}`;
        }
        
        // Handle breakpoint
        if (breakpoint !== 'all') {
          const minWidth = this.getBreakpointMinWidth(breakpoint);
          rule += `@media (min-width: ${minWidth}) { ${selectorWithState} { ${props} } } `;
        } else {
          rule += `${selectorWithState} { ${props} } `;
        }
        
        css += rule;
      }
    }
    
    return css;
  }
  
  getBreakpointMinWidth(breakpoint) {
    const breakpoints = {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px'
    };
    
    return breakpoints[breakpoint] || '0px';
  }
  
  updateStyleElement(css) {
    // Append to existing styles
    this.styleElement.textContent += '\n' + css;
  }
  
  clearStyles() {
    this.styleElement.textContent = '';
  }
  
  showNotification(message) {
    // Remove existing notification
    const existing = document.getElementById('styleforge-notification');
    if (existing) {
      existing.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.id = 'styleforge-notification';
    notification.textContent = message;
    
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      zIndex: '2147483647',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      animation: 'styleforge-fade-in 0.3s ease'
    });
    
    // Add animation styles
    let style = document.getElementById('styleforge-animations');
    if (!style) {
      style = document.createElement('style');
      style.id = 'styleforge-animations';
      style.textContent = `
        @keyframes styleforge-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes styleforge-fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'styleforge-fade-out 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new StyleForgeContent();
  });
} else {
  new StyleForgeContent();
}
