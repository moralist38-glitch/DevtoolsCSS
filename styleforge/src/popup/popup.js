/**
 * StyleForge Popup Script
 * Handles UI interactions and communication with background service worker
 */

class StyleForgePopup {
  constructor() {
    this.currentElement = null;
    this.currentState = 'base';
    this.currentBreakpoint = 'all';
    this.currentStyles = {};
    this.exportFormat = 'css';
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.loadState();
  }
  
  setupEventListeners() {
    // Inspector toggle
    document.getElementById('btnInspector').addEventListener('click', () => {
      this.toggleInspector();
    });
    
    // Undo/Redo
    document.getElementById('btnUndo').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'UNDO' });
    });
    
    document.getElementById('btnRedo').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'REDO' });
    });
    
    // Context selectors
    document.getElementById('stateSelect').addEventListener('change', (e) => {
      this.currentState = e.target.value;
      this.loadCurrentStyles();
    });
    
    document.getElementById('breakpointSelect').addEventListener('change', (e) => {
      this.currentBreakpoint = e.target.value;
      this.loadCurrentStyles();
    });
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });
    
    // Property inputs
    document.querySelectorAll('.property-input').forEach(input => {
      input.addEventListener('input', (e) => {
        this.handlePropertyChange(e.target.dataset.property, e.target.value);
      });
      
      input.addEventListener('change', (e) => {
        this.handlePropertyChange(e.target.dataset.property, e.target.value);
      });
    });
    
    // Color pickers
    document.querySelectorAll('.color-picker').forEach(picker => {
      picker.addEventListener('input', (e) => {
        const textInput = e.target.parentElement.querySelector('.color-text');
        if (textInput) {
          textInput.value = e.target.value;
        }
        this.handlePropertyChange(e.target.dataset.property, e.target.value);
      });
    });
    
    // Reset button
    document.getElementById('btnReset').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all styles for this element?')) {
        chrome.runtime.sendMessage({
          type: 'RESET_STYLES',
          payload: { selector: this.currentElement?.selector }
        });
      }
    });
    
    // Export format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.exportFormat = e.target.dataset.format;
        this.updateExportPreview();
      });
    });
    
    // Copy code
    document.getElementById('btnCopyCode').addEventListener('click', () => {
      this.copyCode();
    });
    
    // Download code
    document.getElementById('btnDownloadCode').addEventListener('click', () => {
      this.downloadCode();
    });
    
    // Tailwind search
    document.getElementById('tailwindSearch').addEventListener('input', (e) => {
      this.searchTailwindClasses(e.target.value);
    });
    
    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
      return true;
    });
  }
  
  async loadState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      
      if (response && response.selectedElement) {
        this.currentElement = response.selectedElement;
        this.currentStyles = response.styles || {};
        this.showEditor();
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      console.error('Error loading state:', error);
      this.showEmptyState();
    }
  }
  
  handleBackgroundMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'ELEMENT_SELECTED':
        this.currentElement = message.payload;
        this.showEditor();
        break;
      
      case 'INSPECTOR_TOGGLED':
        // Update inspector button state
        break;
    }
  }
  
  showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('editorContent').classList.add('hidden');
  }
  
  showEmptyState() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('editorContent').classList.add('hidden');
  }
  
  showEditor() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('editorContent').classList.remove('hidden');
    
    // Update element selector display
    if (this.currentElement) {
      document.getElementById('elementSelector').textContent = this.currentElement.selector || 'Unknown element';
    }
    
    this.loadCurrentStyles();
    this.updateExportPreview();
  }
  
  toggleInspector() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_INSPECTOR'
        });
      }
    });
  }
  
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    // Update export preview if switching to export tab
    if (tabName === 'export') {
      this.updateExportPreview();
    }
  }
  
  loadCurrentStyles() {
    if (!this.currentElement || !this.currentElement.selector) return;
    
    const elementStyles = this.currentStyles[this.currentElement.selector] || {};
    const stateStyles = elementStyles[this.currentState] || {};
    const breakpointStyles = stateStyles[this.currentBreakpoint] || {};
    
    // Populate inputs
    document.querySelectorAll('.property-input').forEach(input => {
      const property = input.dataset.property;
      const value = breakpointStyles[property];
      
      if (value !== undefined) {
        if (input.type === 'color') {
          input.value = this.parseColor(value);
        } else if (input.type === 'range') {
          input.value = parseFloat(value) || 1;
        } else {
          input.value = value;
        }
      } else {
        input.value = '';
      }
    });
  }
  
  parseColor(color) {
    // Simple color parsing - in production would need more robust handling
    if (color.startsWith('#') && color.length === 7) {
      return color;
    }
    if (color.startsWith('rgb')) {
      return this.rgbToHex(color);
    }
    return '#000000';
  }
  
  rgbToHex(rgb) {
    // Simple RGB to Hex conversion
    const match = rgb.match(/\d+/g);
    if (!match) return '#000000';
    
    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);
    
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  
  handlePropertyChange(property, value) {
    if (!this.currentElement || !this.currentElement.selector) return;
    
    // Skip if value is empty
    if (!value || value.trim() === '') {
      return;
    }
    
    chrome.runtime.sendMessage({
      type: 'STYLE_UPDATED',
      payload: {
        selector: this.currentElement.selector,
        property,
        value,
        state: this.currentState,
        breakpoint: this.currentBreakpoint
      }
    });
    
    // Update local state
    if (!this.currentStyles[this.currentElement.selector]) {
      this.currentStyles[this.currentElement.selector] = {};
    }
    if (!this.currentStyles[this.currentElement.selector][this.currentState]) {
      this.currentStyles[this.currentElement.selector][this.currentState] = {};
    }
    if (!this.currentStyles[this.currentElement.selector][this.currentState][this.currentBreakpoint]) {
      this.currentStyles[this.currentElement.selector][this.currentState][this.currentBreakpoint] = {};
    }
    this.currentStyles[this.currentElement.selector][this.currentState][this.currentBreakpoint][property] = value;
  }
  
  updateExportPreview() {
    chrome.runtime.sendMessage({
      type: 'EXPORT_STYLES',
      payload: { format: this.exportFormat }
    }, (response) => {
      if (response) {
        document.getElementById('codePreview').textContent = response;
      }
    });
  }
  
  async copyCode() {
    try {
      const code = document.getElementById('codePreview').textContent;
      await navigator.clipboard.writeText(code);
      this.showNotification('Code copied to clipboard!');
    } catch (error) {
      console.error('Error copying code:', error);
      this.showNotification('Failed to copy code');
    }
  }
  
  downloadCode() {
    const code = document.getElementById('codePreview').textContent;
    const extension = this.exportFormat === 'json' ? 'json' : 
                      this.exportFormat === 'tailwind' ? 'txt' : 'css';
    const mimeType = this.exportFormat === 'json' ? 'application/json' : 'text/plain';
    
    const blob = new Blob([code], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `styleforge-export.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showNotification('File downloaded!');
  }
  
  searchTailwindClasses(query) {
    // Simple Tailwind class suggestions (in production would be more comprehensive)
    const suggestions = [];
    
    if (!query || query.trim() === '') {
      document.getElementById('tailwindChips').innerHTML = '';
      return;
    }
    
    // Basic matching
    const commonClasses = [
      'flex', 'grid', 'block', 'inline-block', 'hidden',
      'p-4', 'p-8', 'p-16', 'm-4', 'm-8', 'm-16',
      'text-sm', 'text-base', 'text-lg', 'text-xl',
      'font-normal', 'font-medium', 'font-bold',
      'bg-white', 'bg-black', 'bg-gray-100', 'bg-blue-500',
      'text-white', 'text-black', 'text-gray-900',
      'rounded', 'rounded-lg', 'rounded-full',
      'shadow', 'shadow-md', 'shadow-lg',
      'border', 'border-2', 'border-none',
      'w-full', 'h-full', 'w-screen', 'h-screen',
      'justify-center', 'justify-between', 'justify-start',
      'items-center', 'items-start', 'items-end',
      'gap-2', 'gap-4', 'gap-8',
      'hover:bg-blue-600', 'hover:text-white',
      'focus:ring', 'focus:outline-none',
      'sm:flex', 'md:grid', 'lg:block',
      'transition', 'duration-300', 'ease-in-out'
    ];
    
    const filtered = commonClasses.filter(cls => 
      cls.toLowerCase().includes(query.toLowerCase())
    );
    
    const chipsContainer = document.getElementById('tailwindChips');
    chipsContainer.innerHTML = '';
    
    filtered.slice(0, 20).forEach(cls => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `
        <span>${cls}</span>
        <span class="chip-remove" data-class="${cls}">✕</span>
      `;
      
      chip.querySelector('.chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyTailwindClass(cls);
        chip.remove();
      });
      
      chipsContainer.appendChild(chip);
    });
  }
  
  applyTailwindClass(className) {
    // In production, this would convert Tailwind classes to CSS
    // For now, just show a notification
    this.showNotification(`Applied: ${className}`);
  }
  
  showNotification(message) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.textContent = message;
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: '10000',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    });
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new StyleForgePopup();
});
