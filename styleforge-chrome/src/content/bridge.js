/**
 * StyleForge - Content Script Bridge
 * Handles communication between content script and background service worker
 */

class ContentBridge {
  constructor() {
    this.inspector = null;
    this.injector = null;
    this.currentElement = null;
    this.currentSelector = null;
    this.isConnected = false;
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
    this.onElementSelect = this.onElementSelect.bind(this);
  }

  /**
   * Initialize the bridge
   */
  async init() {
    // Wait for modules to be available
    await this.waitForModules();
    
    // Initialize components
    this.inspector = new window.StyleForgeInspector();
    this.injector = new window.StyleForgeInjector().init();
    
    // Load saved styles from storage
    await this.loadSavedStyles();
    
    // Set up message listener
    chrome.runtime.onMessage.addListener(this.handleMessage);
    
    // Send ready message to background
    this.sendToBackground({ type: 'CONTENT_READY' });
    
    // Set up SPA navigation detection
    this.setupNavigationDetection();
    
    console.log('[StyleForge] Content script initialized');
    return this;
  }

  /**
   * Wait for inspector and injector modules to load
   */
  waitForModules() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.StyleForgeInspector && window.StyleForgeInjector) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * Handle messages from background/popup
   */
  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'ACTIVATE_INSPECTOR':
        this.activateInspector();
        sendResponse({ success: true });
        break;
        
      case 'DEACTIVATE_INSPECTOR':
        this.inspector.deactivate();
        sendResponse({ success: true });
        break;
        
      case 'SELECT_ELEMENT':
        this.selectElementBySelector(message.selector);
        sendResponse({ success: true });
        break;
        
      case 'UPDATE_STYLES':
        this.updateStyles(message.data);
        sendResponse({ success: true });
        break;
        
      case 'GET_ELEMENT_STYLES':
        const styles = this.getElementStyles(message.selector);
        sendResponse({ success: true, styles });
        break;
        
      case 'CLEAR_STYLES':
        this.injector.clearAll();
        sendResponse({ success: true });
        break;
        
      case 'EXPORT_CSS':
        const css = this.generateExportCSS();
        sendResponse({ success: true, css });
        break;
        
      case 'GET_PAGE_INFO':
        const pageInfo = this.getPageInfo();
        sendResponse({ success: true, pageInfo });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Keep channel open for async response
  }

  /**
   * Activate inspector mode
   */
  activateInspector() {
    this.inspector.activate(this.onElementSelect);
  }

  /**
   * Callback when element is selected
   */
  onElementSelect(element) {
    this.currentElement = element;
    this.currentSelector = this.inspector.generateSelector(element);
    
    const elementInfo = {
      selector: this.currentSelector,
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className && typeof element.className === 'string'
        ? element.className.split(/\s+/).filter(c => c)
        : [],
      path: this.inspector.getElementPath(element),
      isInShadowDOM: this.inspector.isInShadowDOM(element),
      partName: this.inspector.getPartName(element),
      isSVG: this.inspector.isSVGElement(element),
      isCanvas: this.inspector.isCanvasElement(element),
      computedStyles: this.inspector.getComputedStyles(element)
    };
    
    // Send to background
    this.sendToBackground({
      type: 'ELEMENT_SELECTED',
      data: elementInfo
    });
  }

  /**
   * Select element by selector
   */
  selectElementBySelector(selector) {
    const element = document.querySelector(selector);
    if (element) {
      this.currentElement = element;
      this.currentSelector = selector;
      
      // Highlight the element
      this.inspector.selectedElement = element;
      this.inspector.updateHighlight(element);
      
      return true;
    }
    return false;
  }

  /**
   * Update styles for current element
   */
  updateStyles(data) {
    const { selector, state, breakpoint, css, tailwind, important } = data;
    
    if (!selector) return;
    
    if (css && Object.keys(css).length > 0) {
      if (important) {
        this.injector.setImportantStyles(selector, css, state, breakpoint);
      } else {
        this.injector.setStyles(selector, css, state, breakpoint);
      }
    }
    
    if (tailwind && tailwind.length > 0) {
      this.injector.addTailwindClasses(selector, tailwind, state, breakpoint);
    }
    
    // Save to storage
    this.saveStyles();
  }

  /**
   * Get all styles for an element
   */
  getElementStyles(selector) {
    return this.injector.getStyles(selector);
  }

  /**
   * Generate CSS for export
   */
  generateExportCSS() {
    return this.injector.generateCSS();
  }

  /**
   * Get page information
   */
  getPageInfo() {
    return {
      url: window.location.href,
      domain: window.location.hostname,
      path: window.location.pathname,
      title: document.title
    };
  }

  /**
   * Send message to background service worker
   */
  sendToBackground(message) {
    try {
      chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('[StyleForge] Error sending message to background:', error);
    }
  }

  /**
   * Save current styles to storage
   */
  saveStyles() {
    const styles = this.injector.exportStyles();
    const pageInfo = this.getPageInfo();
    
    this.sendToBackground({
      type: 'SAVE_STYLES',
      data: {
        domain: pageInfo.domain,
        path: pageInfo.path,
        styles
      }
    });
  }

  /**
   * Load saved styles from storage
   */
  async loadSavedStyles() {
    return new Promise((resolve) => {
      const pageInfo = this.getPageInfo();
      
      this.sendToBackground({
        type: 'LOAD_STYLES',
        data: {
          domain: pageInfo.domain,
          path: pageInfo.path
        }
      });
      
      // Listen for response
      const listener = (message) => {
        if (message.type === 'STYLES_LOADED' && message.data) {
          this.injector.loadStyles(message.data);
          chrome.runtime.onMessage.removeListener(listener);
          resolve();
        }
      };
      
      chrome.runtime.onMessage.addListener(listener);
      
      // Timeout fallback
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }, 1000);
    });
  }

  /**
   * Set up SPA navigation detection
   */
  setupNavigationDetection() {
    // Listen for popstate events
    window.addEventListener('popstate', () => {
      this.handleNavigation();
    });
    
    // Monkey-patch history.pushState
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleNavigation();
    };
    
    // Monkey-patch history.replaceState
    const originalReplaceState = history.replaceState;
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleNavigation();
    };
  }

  /**
   * Handle navigation event
   */
  handleNavigation() {
    console.log('[StyleForge] Navigation detected, reloading styles...');
    
    // Clear current styles
    this.injector.clearAll();
    
    // Load styles for new URL
    setTimeout(() => {
      this.loadSavedStyles();
    }, 100);
    
    // Notify background
    this.sendToBackground({
      type: 'NAVIGATION_CHANGED',
      data: this.getPageInfo()
    });
  }

  /**
   * Navigate to parent element
   */
  navigateToParent() {
    if (!this.currentElement) return null;
    
    const parent = this.inspector.navigateToParent(this.currentElement);
    if (parent) {
      this.currentElement = parent;
      this.currentSelector = this.inspector.generateSelector(parent);
      this.onElementSelect(parent);
    }
    
    return parent;
  }

  /**
   * Navigate to child element
   */
  navigateToChild(index) {
    if (!this.currentElement) return null;
    
    const child = this.inspector.navigateToChild(this.currentElement, index);
    if (child) {
      this.currentElement = child;
      this.currentSelector = this.inspector.generateSelector(child);
      this.onElementSelect(child);
    }
    
    return child;
  }

  /**
   * Reset current selection
   */
  resetSelection() {
    this.currentElement = null;
    this.currentSelector = null;
    
    this.sendToBackground({
      type: 'SELECTION_CLEARED'
    });
  }

  /**
   * Apply snapshot of styles
   */
  applySnapshot(snapshot) {
    this.injector.clearAll();
    this.injector.loadStyles(snapshot);
    this.saveStyles();
  }

  /**
   * Get current snapshot
   */
  getSnapshot() {
    return this.injector.exportStyles();
  }

  /**
   * Validate CSS property
   */
  validateProperty(property, value) {
    return this.injector.validateProperty(property, value);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.styleForgeBridge = new ContentBridge().init();
  });
} else {
  window.styleForgeBridge = new ContentBridge().init();
}

// Export for external use
window.StyleForgeBridge = ContentBridge;
