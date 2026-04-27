/**
 * StyleForge - Popup UI Logic
 */

class PopupUI {
  constructor() {
    this.currentSelector = null;
    this.currentState = 'base';
    this.currentBreakpoint = 'all';
    this.elementInfo = null;
    this.appliedTailwindClasses = [];
    this.debounceTimer = null;
    
    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    this.bindEvents();
    await this.loadState();
    this.startMessageListener();
    
    console.log('[StyleForge Popup] Initialized');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // State buttons
    document.querySelectorAll('#state-buttons .btn-context').forEach(btn => {
      btn.addEventListener('click', (e) => this.setState(e.target.dataset.state));
    });

    // Breakpoint buttons
    document.querySelectorAll('#breakpoint-buttons .btn-context').forEach(btn => {
      btn.addEventListener('click', (e) => this.setBreakpoint(e.target.dataset.breakpoint));
    });

    // Inspector button
    document.getElementById('btn-inspector').addEventListener('click', () => {
      this.toggleInspector();
    });

    // Reset button
    document.getElementById('btn-reset').addEventListener('click', () => {
      this.resetAllStyles();
    });

    // Clear selection
    document.getElementById('btn-clear-selection').addEventListener('click', () => {
      this.clearSelection();
    });

    // Save button
    document.getElementById('btn-save').addEventListener('click', () => {
      this.saveStyles();
    });

    // CSS property inputs
    document.querySelectorAll('.property-input').forEach(input => {
      input.addEventListener('change', (e) => this.handlePropertyChange(e));
      input.addEventListener('input', (e) => this.handlePropertyInput(e));
    });

    // Color pickers
    document.querySelectorAll('.color-picker').forEach(picker => {
      picker.addEventListener('input', (e) => this.handleColorPick(e));
    });

    // Tailwind search
    document.getElementById('tw-search').addEventListener('input', (e) => {
      this.searchTailwind(e.target.value);
    });

    // Export format
    document.getElementById('export-format').addEventListener('change', () => {
      this.generateExport();
    });

    // Copy button
    document.getElementById('btn-copy').addEventListener('click', () => {
      this.copyToClipboard();
    });

    // Download button
    document.getElementById('btn-download').addEventListener('click', () => {
      this.downloadExport();
    });

    // Undo/Redo
    document.getElementById('btn-undo').addEventListener('click', () => {
      this.undo();
    });

    document.getElementById('btn-redo').addEventListener('click', () => {
      this.redo();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        this.toggleInspector();
      }
    });
  }

  /**
   * Load initial state from background
   */
  async loadState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (response.success && response.state.selectedElement) {
        this.onElementSelected(response.state.selectedElement);
      }
    } catch (error) {
      console.error('[StyleForge] Error loading state:', error);
    }
  }

  /**
   * Start listening for messages from background
   */
  startMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'ELEMENT_SELECTED':
          this.onElementSelected(message.data);
          break;
          
        case 'HISTORY_UPDATED':
          this.updateHistoryUI(message.data);
          break;
          
        case 'UNDO':
        case 'REDO':
          this.handleUndoRedo(message);
          break;
      }
      
      sendResponse({ success: true });
      return true;
    });
  }

  /**
   * Handle element selection
   */
  onElementSelected(elementInfo) {
    this.elementInfo = elementInfo;
    this.currentSelector = elementInfo.selector;
    
    // Show element bar
    document.getElementById('element-bar').style.display = 'block';
    document.getElementById('selector-display').textContent = elementInfo.selector;
    
    // Show element path
    this.renderElementPath(elementInfo.path);
    
    // Load current styles
    this.loadElementStyles();
    
    // Show notification
    this.showNotification(`Selected: ${elementInfo.tagName}`, 'success');
  }

  /**
   * Render element path navigation
   */
  renderElementPath(path) {
    const pathContainer = document.getElementById('element-path');
    pathContainer.innerHTML = '';
    
    if (!path || !Array.isArray(path)) return;
    
    path.forEach((segment, index) => {
      const span = document.createElement('span');
      span.className = 'path-segment';
      
      let text = segment.tagName;
      if (segment.id) text += `#${segment.id}`;
      if (segment.className.length > 0) {
        text += `.${segment.className[0]}`;
      }
      
      span.textContent = text;
      span.addEventListener('click', () => {
        this.selectElementByIndex(index);
      });
      
      pathContainer.appendChild(span);
      
      if (index < path.length - 1) {
        const arrow = document.createElement('span');
        arrow.textContent = ' > ';
        pathContainer.appendChild(arrow);
      }
    });
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    
    // Generate export if switching to export tab
    if (tabName === 'export') {
      this.generateExport();
    }
  }

  /**
   * Set current state (base, hover, etc.)
   */
  setState(state) {
    this.currentState = state;
    
    document.querySelectorAll('#state-buttons .btn-context').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.state === state);
    });
    
    this.loadElementStyles();
  }

  /**
   * Set current breakpoint
   */
  setBreakpoint(breakpoint) {
    this.currentBreakpoint = breakpoint;
    
    document.querySelectorAll('#breakpoint-buttons .btn-context').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.breakpoint === breakpoint);
    });
    
    this.loadElementStyles();
  }

  /**
   * Toggle inspector mode
   */
  async toggleInspector() {
    const btn = document.getElementById('btn-inspector');
    btn.classList.toggle('active');
    
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_INSPECTOR' });
    } catch (error) {
      console.error('[StyleForge] Error toggling inspector:', error);
      this.showNotification('Error activating inspector', 'error');
    }
  }

  /**
   * Handle property change
   */
  handlePropertyChange(e) {
    const input = e.target;
    const prop = input.dataset.prop;
    const value = input.value;
    
    if (!prop || !this.currentSelector) return;
    
    this.applyStyle(prop, value);
  }

  /**
   * Handle property input (with debounce)
   */
  handlePropertyInput(e) {
    const input = e.target;
    const prop = input.dataset.prop;
    const value = input.value;
    
    if (!prop || !this.currentSelector) return;
    
    // Debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.applyStyle(prop, value);
    }, 300);
  }

  /**
   * Handle color picker change
   */
  handleColorPick(e) {
    const picker = e.target;
    const prop = picker.dataset.prop;
    const value = picker.value;
    
    if (!prop || !this.currentSelector) return;
    
    // Update text input
    const textInput = document.querySelector(`.property-input[data-prop="${prop}"].color-value`);
    if (textInput) {
      textInput.value = value;
    }
    
    this.applyStyle(prop, value);
  }

  /**
   * Apply style to element
   */
  async applyStyle(property, value) {
    if (!this.currentSelector) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_STYLES',
        data: {
          selector: this.currentSelector,
          state: this.currentState,
          breakpoint: this.currentBreakpoint,
          css: { [property]: value }
        }
      });
      
      // Validate
      this.validateProperty(property, value);
    } catch (error) {
      console.error('[StyleForge] Error applying style:', error);
    }
  }

  /**
   * Validate property value
   */
  validateProperty(property, value) {
    const input = document.querySelector(`.property-input[data-prop="${property}"]`);
    if (!input) return;
    
    // Basic validation
    const isValid = this.basicValidation(property, value);
    input.classList.toggle('invalid', !isValid && value !== '');
  }

  /**
   * Basic property validation
   */
  basicValidation(property, value) {
    if (!value) return true;
    
    switch (property) {
      case 'width':
      case 'height':
      case 'fontSize':
      case 'lineHeight':
      case 'borderRadius':
        return /^[\d.]+(px|em|rem|%|vw|vh|auto)?$/.test(value);
        
      case 'opacity':
        const opacity = parseFloat(value);
        return !isNaN(opacity) && opacity >= 0 && opacity <= 1;
        
      case 'zIndex':
        return /^-?\d+$|^auto$/.test(value);
        
      default:
        return true;
    }
  }

  /**
   * Load current element styles
   */
  async loadElementStyles() {
    if (!this.currentSelector) return;
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ELEMENT_STYLES',
        selector: this.currentSelector
      });
      
      if (response.success && response.styles) {
        this.populateFields(response.styles);
      }
    } catch (error) {
      console.error('[StyleForge] Error loading styles:', error);
    }
  }

  /**
   * Populate form fields with current styles
   */
  populateFields(styles) {
    // Get styles for current state and breakpoint
    const stateStyles = styles[this.currentState] || {};
    const bpStyles = stateStyles[this.currentBreakpoint] || { css: {}, tailwind: [] };
    
    // Populate CSS fields
    document.querySelectorAll('.property-input').forEach(input => {
      const prop = input.dataset.prop;
      if (bpStyles.css[prop]) {
        input.value = bpStyles.css[prop];
      } else {
        input.value = '';
      }
    });
    
    // Populate color pickers
    document.querySelectorAll('.color-picker').forEach(picker => {
      const prop = picker.dataset.prop;
      if (bpStyles.css[prop]) {
        picker.value = this.hexToRgb(bpStyles.css[prop]) || '#000000';
      }
    });
    
    // Store Tailwind classes
    this.appliedTailwindClasses = bpStyles.tailwind || [];
    this.renderAppliedClasses();
  }

  /**
   * Search Tailwind classes
   */
  searchTailwind(query) {
    // Simple suggestions (in real implementation, this would be more comprehensive)
    const suggestions = [
      'flex', 'grid', 'block', 'inline-block', 'hidden',
      'p-4', 'p-8', 'm-4', 'm-8', 'px-4', 'py-2',
      'text-sm', 'text-lg', 'text-xl', 'font-bold',
      'bg-red-500', 'bg-blue-500', 'bg-green-500',
      'text-white', 'text-black', 'text-gray-500',
      'rounded', 'rounded-lg', 'rounded-full',
      'shadow', 'shadow-lg', 'shadow-xl',
      'hover:bg-red-600', 'focus:ring', 'active:scale-95'
    ];
    
    const filtered = query
      ? suggestions.filter(c => c.toLowerCase().includes(query.toLowerCase()))
      : suggestions.slice(0, 10);
    
    this.renderSuggestions(filtered);
  }

  /**
   * Render Tailwind suggestions
   */
  renderSuggestions(classes) {
    const container = document.getElementById('tw-suggestions');
    
    if (classes.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No classes found</p></div>';
      return;
    }
    
    container.innerHTML = classes.map(cls => `
      <div class="class-chip" style="cursor: pointer;" data-class="${cls}">
        ${cls}
      </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.class-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.addTailwindClass(chip.dataset.class);
      });
    });
  }

  /**
   * Render applied Tailwind classes
   */
  renderAppliedClasses() {
    const container = document.getElementById('applied-classes');
    
    if (this.appliedTailwindClasses.length === 0) {
      container.innerHTML = '<div class="empty-state-text">No Tailwind classes applied</div>';
      return;
    }
    
    container.innerHTML = this.appliedTailwindClasses.map(cls => `
      <div class="class-chip">
        ${cls}
        <span class="class-chip-remove" data-class="${cls}">×</span>
      </div>
    `).join('');
    
    // Add remove handlers
    container.querySelectorAll('.class-chip-remove').forEach(remove => {
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTailwindClass(remove.dataset.class);
      });
    });
  }

  /**
   * Add Tailwind class
   */
  async addTailwindClass(className) {
    if (!this.currentSelector) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_STYLES',
        data: {
          selector: this.currentSelector,
          state: this.currentState,
          breakpoint: this.currentBreakpoint,
          tailwind: [className]
        }
      });
      
      this.appliedTailwindClasses.push(className);
      this.renderAppliedClasses();
      this.showNotification(`Added: ${className}`, 'success');
    } catch (error) {
      console.error('[StyleForge] Error adding class:', error);
    }
  }

  /**
   * Remove Tailwind class
   */
  async removeTailwindClass(className) {
    if (!this.currentSelector) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_STYLES',
        data: {
          selector: this.currentSelector,
          state: this.currentState,
          breakpoint: this.currentBreakpoint,
          tailwind: [-className] // Negative prefix indicates removal
        }
      });
      
      this.appliedTailwindClasses = this.appliedTailwindClasses.filter(c => c !== className);
      this.renderAppliedClasses();
    } catch (error) {
      console.error('[StyleForge] Error removing class:', error);
    }
  }

  /**
   * Generate export code
   */
  async generateExport() {
    const format = document.getElementById('export-format').value;
    const preview = document.getElementById('export-preview');
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'EXPORT_CSS' });
      
      if (!response.success) {
        preview.textContent = '/* Error generating export */';
        return;
      }
      
      let code = '';
      
      switch (format) {
        case 'css':
          code = response.css || '/* No styles to export */';
          break;
          
        case 'tailwind':
          code = this.generateTailwindExport();
          break;
          
        case 'json':
          code = JSON.stringify(response.styles || {}, null, 2);
          break;
      }
      
      preview.textContent = code;
    } catch (error) {
      preview.textContent = '/* Error: ' + error.message + ' */';
    }
  }

  /**
   * Generate Tailwind export
   */
  generateTailwindExport() {
    if (this.appliedTailwindClasses.length === 0) {
      return '/* No Tailwind classes applied */';
    }
    
    return `class="${this.appliedTailwindClasses.join(' ')}"`;
  }

  /**
   * Copy to clipboard
   */
  async copyToClipboard() {
    const preview = document.getElementById('export-preview');
    const text = preview.textContent;
    
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('Copied to clipboard!', 'success');
    } catch (error) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showNotification('Copied to clipboard!', 'success');
    }
  }

  /**
   * Download export file
   */
  downloadExport() {
    const format = document.getElementById('export-format').value;
    const preview = document.getElementById('export-preview');
    const content = preview.textContent;
    
    let filename = 'styleforge-export';
    let mimeType = 'text/plain';
    
    switch (format) {
      case 'css':
        filename += '.css';
        mimeType = 'text/css';
        break;
      case 'json':
        filename += '.json';
        mimeType = 'application/json';
        break;
      default:
        filename += '.txt';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showNotification(`Downloaded ${filename}`, 'success');
  }

  /**
   * Undo last action
   */
  async undo() {
    try {
      await chrome.runtime.sendMessage({ type: 'UNDO' });
    } catch (error) {
      this.showNotification('Nothing to undo', 'error');
    }
  }

  /**
   * Redo last undone action
   */
  async redo() {
    try {
      await chrome.runtime.sendMessage({ type: 'REDO' });
    } catch (error) {
      this.showNotification('Nothing to redo', 'error');
    }
  }

  /**
   * Update history UI
   */
  updateHistoryUI(data) {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    
    undoBtn.disabled = !data.canUndo;
    redoBtn.disabled = !data.canRedo;
    
    // Update history list
    this.renderHistoryList();
  }

  /**
   * Render history list
   */
  async renderHistoryList() {
    // In a full implementation, this would fetch history from storage
    const list = document.getElementById('history-list');
    list.innerHTML = '<li class="history-item">History feature coming soon...</li>';
  }

  /**
   * Handle undo/redo events
   */
  handleUndoRedo(message) {
    this.loadElementStyles();
    this.showNotification(`${message.type === 'UNDO' ? 'Undone' : 'Redone'}`, 'success');
  }

  /**
   * Select element by path index
   */
  async selectElementByIndex(index) {
    // This would navigate the DOM tree in the content script
    this.showNotification('Navigation coming soon', 'success');
  }

  /**
   * Clear current selection
   */
  async clearSelection() {
    this.currentSelector = null;
    this.elementInfo = null;
    
    document.getElementById('element-bar').style.display = 'none';
    document.querySelectorAll('.property-input').forEach(input => {
      input.value = '';
    });
    
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_STYLES' });
    } catch (error) {
      console.error('[StyleForge] Error clearing selection:', error);
    }
    
    this.showNotification('Selection cleared', 'success');
  }

  /**
   * Reset all styles
   */
  async resetAllStyles() {
    if (!confirm('Are you sure you want to reset all styles? This cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_STYLES' });
      this.clearSelection();
      this.showNotification('All styles reset', 'success');
    } catch (error) {
      this.showNotification('Error resetting styles', 'error');
    }
  }

  /**
   * Save styles explicitly
   */
  async saveStyles() {
    try {
      // Styles are auto-saved, but this triggers an explicit save
      await chrome.runtime.sendMessage({ type: 'SAVE_STYLES' });
      this.showNotification('Styles saved!', 'success');
    } catch (error) {
      this.showNotification('Error saving styles', 'error');
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 2000);
  }

  /**
   * Convert hex to rgb for color picker
   */
  hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `rgb(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)})`
      : null;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.styleForgePopup = new PopupUI();
});
