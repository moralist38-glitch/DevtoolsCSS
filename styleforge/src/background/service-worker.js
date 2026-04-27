/**
 * StyleForge Background Service Worker
 * Handles communication between content scripts and popup/sidepanel
 * Manages global state and storage operations
 */

// State management
let currentState = {
  selectedElement: null,
  activeTabId: null,
  styles: {},
  history: [],
  historyIndex: -1
};

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'ELEMENT_SELECTED':
      await handleElementSelected(message.payload, sender.tab?.id);
      break;
    
    case 'STYLE_UPDATED':
      await handleStyleUpdated(message.payload);
      break;
    
    case 'GET_STATE':
      sendResponse(currentState);
      return;
    
    case 'SET_ACTIVE_TAB':
      currentState.activeTabId = message.payload.tabId;
      await loadStylesForTab(message.payload.tabId);
      break;
    
    case 'UNDO':
      await performUndo();
      break;
    
    case 'REDO':
      await performRedo();
      break;
    
    case 'SAVE_STYLES':
      await saveStylesToStorage();
      break;
    
    case 'EXPORT_STYLES':
      const exported = await exportStyles(message.payload.format);
      sendResponse(exported);
      return;
    
    case 'RESET_STYLES':
      await resetStyles(message.payload.selector);
      break;
  }
}

async function handleElementSelected(payload, tabId) {
  currentState.selectedElement = payload;
  currentState.activeTabId = tabId;
  
  // Load existing styles for this element
  await loadStylesForTab(tabId);
  
  // Notify popup about selection
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    payload: currentState.selectedElement
  });
}

async function handleStyleUpdated(payload) {
  const { selector, property, value, state, breakpoint } = payload;
  
  // Add to history before modifying
  addToHistory();
  
  // Initialize styles structure if needed
  if (!currentState.styles[selector]) {
    currentState.styles[selector] = {};
  }
  
  if (!currentState.styles[selector][state]) {
    currentState.styles[selector][state] = {};
  }
  
  if (!currentState.styles[selector][state][breakpoint]) {
    currentState.styles[selector][state][breakpoint] = {};
  }
  
  // Update style
  currentState.styles[selector][state][breakpoint][property] = value;
  
  // Apply changes to content script
  if (currentState.activeTabId) {
    chrome.tabs.sendMessage(currentState.activeTabId, {
      type: 'APPLY_STYLES',
      payload: {
        selector,
        styles: currentState.styles[selector]
      }
    });
  }
  
  // Auto-save
  debouncedSave();
}

async function loadStylesForTab(tabId) {
  try {
    const result = await chrome.storage.local.get(`styles_${tabId}`);
    const savedStyles = result[`styles_${tabId}`];
    
    if (savedStyles) {
      currentState.styles = savedStyles;
      
      // Re-apply all styles
      if (currentState.activeTabId) {
        chrome.tabs.sendMessage(currentState.activeTabId, {
          type: 'APPLY_ALL_STYLES',
          payload: currentState.styles
        });
      }
    }
  } catch (error) {
    console.error('Error loading styles:', error);
  }
}

// History management
function addToHistory() {
  // Remove any future history if we're not at the end
  if (currentState.historyIndex < currentState.history.length - 1) {
    currentState.history = currentState.history.slice(0, currentState.historyIndex + 1);
  }
  
  // Clone current styles
  const snapshot = JSON.parse(JSON.stringify(currentState.styles));
  currentState.history.push(snapshot);
  
  // Limit history size
  if (currentState.history.length > 50) {
    currentState.history.shift();
  } else {
    currentState.historyIndex++;
  }
}

async function performUndo() {
  if (currentState.historyIndex > 0) {
    currentState.historyIndex--;
    currentState.styles = JSON.parse(JSON.stringify(currentState.history[currentState.historyIndex]));
    
    if (currentState.activeTabId) {
      chrome.tabs.sendMessage(currentState.activeTabId, {
        type: 'APPLY_ALL_STYLES',
        payload: currentState.styles
      });
    }
    
    debouncedSave();
  }
}

async function performRedo() {
  if (currentState.historyIndex < currentState.history.length - 1) {
    currentState.historyIndex++;
    currentState.styles = JSON.parse(JSON.stringify(currentState.history[currentState.historyIndex]));
    
    if (currentState.activeTabId) {
      chrome.tabs.sendMessage(currentState.activeTabId, {
        type: 'APPLY_ALL_STYLES',
        payload: currentState.styles
      });
    }
    
    debouncedSave();
  }
}

// Storage operations
let saveTimeout = null;

function debouncedSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(async () => {
    await saveStylesToStorage();
  }, 500);
}

async function saveStylesToStorage() {
  if (!currentState.activeTabId) return;
  
  try {
    await chrome.storage.local.set({
      [`styles_${currentState.activeTabId}`]: currentState.styles
    });
  } catch (error) {
    console.error('Error saving styles:', error);
  }
}

// Export functionality
async function exportStyles(format) {
  switch (format) {
    case 'css':
      return exportAsCSS();
    case 'tailwind':
      return exportAsTailwind();
    case 'json':
      return JSON.stringify(currentState.styles, null, 2);
    default:
      return exportAsCSS();
  }
}

function exportAsCSS() {
  let css = '/* StyleForge Export */\n\n';
  
  for (const [selector, states] of Object.entries(currentState.styles)) {
    for (const [state, breakpoints] of Object.entries(states)) {
      for (const [breakpoint, properties] of Object.entries(breakpoints)) {
        const props = Object.entries(properties)
          .map(([prop, val]) => `  ${prop}: ${val};`)
          .join('\n');
        
        let rule = '';
        
        // Handle breakpoints
        if (breakpoint !== 'all') {
          const minWidth = getBreakpointMinWidth(breakpoint);
          rule += `@media (min-width: ${minWidth}) {\n`;
        }
        
        // Handle states
        let selectorWithState = selector;
        if (state !== 'base') {
          selectorWithState += `:${state}`;
        }
        
        rule += `${selectorWithState} {\n${props}\n}`;
        
        if (breakpoint !== 'all') {
          rule += '\n}';
        }
        
        css += rule + '\n\n';
      }
    }
  }
  
  return css;
}

function exportAsTailwind() {
  const tailwindClasses = {};
  
  for (const [selector, states] of Object.entries(currentState.styles)) {
    tailwindClasses[selector] = [];
    
    for (const [state, breakpoints] of Object.entries(states)) {
      for (const [breakpoint, properties] of Object.entries(breakpoints)) {
        const classes = convertPropertiesToTailwind(properties);
        
        let prefix = '';
        if (breakpoint !== 'all') {
          prefix += `${breakpoint}:`;
        }
        if (state !== 'base') {
          prefix += `${state}:`;
        }
        
        tailwindClasses[selector].push(...classes.map(c => prefix ? `${prefix}${c}` : c));
      }
    }
  }
  
  return JSON.stringify(tailwindClasses, null, 2);
}

function convertPropertiesToTailwind(properties) {
  const classes = [];
  
  // Simple conversion examples (would need comprehensive mapping in production)
  for (const [prop, value] of Object.entries(properties)) {
    switch (prop) {
      case 'background-color':
        classes.push(`bg-[${value}]`);
        break;
      case 'color':
        classes.push(`text-[${value}]`);
        break;
      case 'font-size':
        classes.push(`text-[${value}]`);
        break;
      case 'padding':
        classes.push(`p-[${value}]`);
        break;
      case 'margin':
        classes.push(`m-[${value}]`);
        break;
      case 'border-radius':
        classes.push(`rounded-[${value}]`);
        break;
      case 'display':
        classes.push(value);
        break;
      case 'flex-direction':
        classes.push(value === 'row' ? 'flex-row' : 'flex-col');
        break;
      case 'justify-content':
        classes.push(`justify-${value.replace('center', 'center').replace('space-between', 'between')}`);
        break;
      case 'align-items':
        classes.push(`items-${value}`);
        break;
      case 'width':
        classes.push(`w-[${value}]`);
        break;
      case 'height':
        classes.push(`h-[${value}]`);
        break;
    }
  }
  
  return classes;
}

function getBreakpointMinWidth(breakpoint) {
  const breakpoints = {
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    '2xl': '1536px'
  };
  
  return breakpoints[breakpoint] || '0px';
}

async function resetStyles(selector) {
  addToHistory();
  
  if (selector) {
    delete currentState.styles[selector];
  } else {
    currentState.styles = {};
  }
  
  if (currentState.activeTabId) {
    chrome.tabs.sendMessage(currentState.activeTabId, {
      type: 'APPLY_ALL_STYLES',
      payload: currentState.styles
    });
  }
  
  debouncedSave();
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  currentState.activeTabId = activeInfo.tabId;
  await loadStylesForTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentState.activeTabId && changeInfo.status === 'complete') {
    await loadStylesForTab(tabId);
  }
});
