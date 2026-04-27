/**
 * StyleForge - DOM Inspector Module
 * Handles element highlighting, click capture, and DOM traversal
 */

class Inspector {
  constructor() {
    this.isActive = false;
    this.selectedElement = null;
    this.highlightOverlay = null;
    this.hoveredElement = null;
    this.onSelectCallback = null;
    
    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Activate inspector mode
   */
  activate(onSelect) {
    if (this.isActive) return;
    
    this.isActive = true;
    this.onSelectCallback = onSelect;
    
    // Create highlight overlay
    this.createHighlightOverlay();
    
    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    
    // Show activation message
    this.showNotification('Inspector activated. Hover to preview, click to select. (Esc to cancel)');
  }

  /**
   * Deactivate inspector mode
   */
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.removeHighlightOverlay();
    
    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    
    this.hoveredElement = null;
  }

  /**
   * Create highlight overlay element
   */
  createHighlightOverlay() {
    if (this.highlightOverlay) return;
    
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'styleforge-highlight';
    this.highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #3b82f6;
      background-color: rgba(59, 130, 246, 0.1);
      z-index: 2147483647;
      display: none;
      transition: all 0.1s ease;
    `;
    document.body.appendChild(this.highlightOverlay);
  }

  /**
   * Remove highlight overlay
   */
  removeHighlightOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  }

  /**
   * Update highlight position and size
   */
  updateHighlight(element) {
    if (!this.highlightOverlay || !element) return;
    
    const rect = element.getBoundingClientRect();
    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.left = `${rect.left}px`;
    this.highlightOverlay.style.top = `${rect.top}px`;
    this.highlightOverlay.style.width = `${rect.width}px`;
    this.highlightOverlay.style.height = `${rect.height}px`;
    
    // Show element info tooltip
    this.showElementInfo(element);
  }

  /**
   * Show element information tooltip
   */
  showElementInfo(element) {
    let tooltip = document.getElementById('styleforge-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'styleforge-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        background: #1f2937;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        z-index: 2147483647;
        pointer-events: none;
        white-space: nowrap;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      document.body.appendChild(tooltip);
    }
    
    const selector = this.generateSelector(element);
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className && typeof element.className === 'string' 
      ? `.${element.className.split(' ').filter(c => c).join('.')}` 
      : '';
    
    tooltip.textContent = `${tagName}${id}${classes}`;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
    tooltip.style.top = `${rect.top - 24}px`;
    tooltip.style.display = 'block';
  }

  /**
   * Handle mouse move events
   */
  handleMouseMove(e) {
    if (!this.isActive) return;
    
    const target = e.target;
    if (!target || target === this.highlightOverlay || target.id === 'styleforge-tooltip') return;
    
    this.hoveredElement = target;
    this.updateHighlight(target);
  }

  /**
   * Handle click events
   */
  handleClick(e) {
    if (!this.isActive) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const target = this.hoveredElement;
    if (target && this.onSelectCallback) {
      this.selectedElement = target;
      this.onSelectCallback(target);
      this.deactivate();
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.deactivate();
      this.showNotification('Inspector deactivated');
    }
  }

  /**
   * Generate unique CSS selector for element
   */
  generateSelector(element) {
    if (!(element instanceof Element)) return '';
    
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      // Use ID if available
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      // Use class if available and unique among siblings
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          // Check if class is unique among siblings
          const parent = current.parentElement;
          if (parent) {
            const siblingsWithSameClass = Array.from(parent.children).filter(
              sib => sib !== current && 
                classes.some(cls => sib.classList.contains(cls))
            );
            
            if (siblingsWithSameClass.length === 0) {
              selector += `.${classes.join('.')}`;
              path.unshift(selector);
              current = current.parentElement;
              continue;
            }
          }
        }
      }
      
      // Use nth-child as fallback
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          node => node.nodeName === current.nodeName
        );
        const index = siblings.indexOf(current) + 1;
        if (siblings.length > 1) {
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  /**
   * Get element path as array
   */
  getElementPath(element) {
    const path = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      path.unshift({
        tagName: current.tagName.toLowerCase(),
        id: current.id || null,
        className: current.className && typeof current.className === 'string'
          ? current.className.trim().split(/\s+/).filter(c => c)
          : [],
        nthChild: this.getChildIndex(current)
      });
      current = current.parentElement;
    }
    
    return path;
  }

  /**
   * Get child index among same-tag siblings
   */
  getChildIndex(element) {
    const parent = element.parentElement;
    if (!parent) return 1;
    
    const siblings = Array.from(parent.children).filter(
      node => node.nodeName === element.nodeName
    );
    return siblings.indexOf(element) + 1;
  }

  /**
   * Navigate to parent element
   */
  navigateToParent(element) {
    if (!element || !element.parentElement) return null;
    return element.parentElement;
  }

  /**
   * Navigate to child element by index
   */
  navigateToChild(element, index) {
    if (!element || !element.children[index]) return null;
    return element.children[index];
  }

  /**
   * Check if element is in Shadow DOM
   */
  isInShadowDOM(element) {
    return element && element.getRootNode() instanceof ShadowRoot;
  }

  /**
   * Get Shadow DOM part name if available
   */
  getPartName(element) {
    if (!element) return null;
    return element.getAttribute('part') || element.getAttribute('exportparts');
  }

  /**
   * Check if element is SVG
   */
  isSVGElement(element) {
    return element && (
      element.namespaceURI === 'http://www.w3.org/2000/svg' ||
      element.tagName.toLowerCase() === 'svg'
    );
  }

  /**
   * Check if element is Canvas
   */
  isCanvasElement(element) {
    return element && element.tagName.toLowerCase() === 'canvas';
  }

  /**
   * Check if element is inside cross-origin iframe
   */
  isCrossOriginIframe(element) {
    try {
      const rootDoc = element.ownerDocument;
      if (rootDoc.defaultView !== window.top) {
        // Try to access parent frame
        rootDoc.defaultView.parent.location.href;
        return false;
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  /**
   * Show notification message
   */
  showNotification(message) {
    let notification = document.getElementById('styleforge-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'styleforge-notification';
      notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1f2937;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-family: system-ui, sans-serif;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.style.opacity = '1';
    
    setTimeout(() => {
      notification.style.opacity = '0';
    }, 2000);
  }

  /**
   * Get computed styles for element
   */
  getComputedStyles(element) {
    if (!element) return {};
    
    const computed = window.getComputedStyle(element);
    const styles = {};
    
    // Get relevant properties
    const properties = [
      'color', 'background-color', 'background-image',
      'font-family', 'font-size', 'font-weight', 'line-height',
      'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'border', 'border-width', 'border-style', 'border-color', 'border-radius',
      'display', 'position', 'top', 'right', 'bottom', 'left',
      'flex-direction', 'justify-content', 'align-items', 'gap',
      'box-shadow', 'filter', 'opacity', 'transform', 'transition',
      'z-index', 'overflow', 'cursor'
    ];
    
    properties.forEach(prop => {
      styles[prop] = computed.getPropertyValue(prop);
    });
    
    return styles;
  }
}

// Export for use in content script
window.StyleForgeInspector = Inspector;
