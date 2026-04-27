/**
 * StyleForge - Background Service Worker
 * Manages state, storage, and communication between components
 */

// State management
const state = {
  currentTabId: null,
  selectedElement: null,
  styles: {},
  history: [],
  historyIndex: -1,
  maxHistorySize: 50
};

// Storage keys
const STORAGE_KEYS = {
  STYLES: 'styleforge_styles',
  HISTORY: 'styleforge_history',
  SETTINGS: 'styleforge_settings'
};

/**
 * Initialize the service worker
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[StyleForge] Extension installed:', details.reason);
  
  // Initialize default settings
  chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: {
      autoSave: true,
      saveDelay: 500,
      enableHistory: true,
      maxHistorySize: 50
    }
  });
});

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

/**
 * Process incoming messages
 */
async function handleMessage(message, sender) {
  const { type, data } = message;
  
  switch (type) {
    case 'CONTENT_READY':
      return handleContentReady(sender.tab?.id);
      
    case 'ELEMENT_SELECTED':
      return handleElementSelected(data, sender.tab?.id);
      
    case 'SAVE_STYLES':
      return handleSaveStyles(data);
      
    case 'LOAD_STYLES':
      return handleLoadStyles(data);
      
    case 'GET_STATE':
      return getState();
      
    case 'UPDATE_STATE':
      return updateState(data);
      
    case 'ADD_HISTORY':
      return addToHistory(data);
      
    case 'UNDO':
      return undo();
      
    case 'REDO':
      return redo();
      
    case 'CLEAR_HISTORY':
      return clearHistory();
      
    case 'OPEN_POPUP':
      return openPopup();
      
    case 'TOGGLE_INSPECTOR':
      return toggleInspector(sender.tab?.id);
      
    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Handle content script ready
 */
function handleContentReady(tabId) {
  if (tabId) {
    state.currentTabId = tabId;
  }
  console.log('[StyleForge] Content script ready in tab:', tabId);
  return { success: true };
}

/**
 * Handle element selection from content script
 */
function handleElementSelected(data, tabId) {
  state.selectedElement = data;
  state.currentTabId = tabId;
  
  // Notify popup if open
  notifyPopup({
    type: 'ELEMENT_SELECTED',
    data
  });
  
  return { success: true };
}

/**
 * Save styles to storage
 */
async function handleSaveStyles(data) {
  const { domain, path, styles } = data;
  
  try {
    // Get existing styles
    const existing = await chrome.storage.local.get([STORAGE_KEYS.STYLES]);
    const allStyles = existing[STORAGE_KEYS.STYLES] || {};
    
    // Update styles for this domain/path
    if (!allStyles[domain]) {
      allStyles[domain] = {};
    }
    
    if (!allStyles[domain][path]) {
      allStyles[domain][path] = {};
    }
    
    // Merge with existing styles
    allStyles[domain][path] = {
      ...allStyles[domain][path],
      ...styles,
      updatedAt: Date.now()
    };
    
    // Save back to storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.STYLES]: allStyles
    });
    
    // Add to history
    if (state.selectedElement) {
      await addToHistory({
        action: 'update_styles',
        selector: state.selectedElement.selector,
        timestamp: Date.now()
      });
    }
    
    console.log('[StyleForge] Styles saved for:', domain, path);
    return { success: true };
  } catch (error) {
    console.error('[StyleForge] Error saving styles:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Load styles from storage
 */
async function handleLoadStyles(data) {
  const { domain, path } = data;
  
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.STYLES]);
    const allStyles = result[STORAGE_KEYS.STYLES] || {};
    
    let styles = {};
    
    if (allStyles[domain]) {
      // Try exact path match first
      if (allStyles[domain][path]) {
        styles = allStyles[domain][path];
      } else {
        // Fallback to root path or merge all paths
        const rootStyles = allStyles[domain]['/'] || {};
        styles = rootStyles;
      }
    }
    
    return { success: true, type: 'STYLES_LOADED', data: styles };
  } catch (error) {
    console.error('[StyleForge] Error loading styles:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current state
 */
function getState() {
  return {
    success: true,
    state: {
      currentTabId: state.currentTabId,
      selectedElement: state.selectedElement,
      historyLength: state.history.length,
      historyIndex: state.historyIndex
    }
  };
}

/**
 * Update state
 */
function updateState(data) {
  Object.assign(state, data);
  return { success: true };
}

/**
 * Add action to history
 */
async function addToHistory(action) {
  const settings = await getSettings();
  
  if (!settings.enableHistory) {
    return { success: true };
  }
  
  // Remove any future history if we're not at the end
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  
  // Add new action
  state.history.push(action);
  state.historyIndex = state.history.length - 1;
  
  // Limit history size
  if (state.history.length > settings.maxHistorySize) {
    state.history = state.history.slice(-settings.maxHistorySize);
    state.historyIndex = state.history.length - 1;
  }
  
  // Save history to storage
  await chrome.storage.local.set({
    [STORAGE_KEYS.HISTORY]: {
      items: state.history,
      index: state.historyIndex
    }
  });
  
  notifyPopup({
    type: 'HISTORY_UPDATED',
    data: {
      length: state.history.length,
      index: state.historyIndex,
      canUndo: state.historyIndex > 0,
      canRedo: state.historyIndex < state.history.length - 1
    }
  });
  
  return { success: true };
}

/**
 * Undo last action
 */
async function undo() {
  if (state.historyIndex <= 0) {
    return { success: false, error: 'Nothing to undo' };
  }
  
  state.historyIndex--;
  const action = state.history[state.historyIndex];
  
  // Save updated index
  await chrome.storage.local.set({
    [STORAGE_KEYS.HISTORY]: {
      items: state.history,
      index: state.historyIndex
    }
  });
  
  notifyPopup({
    type: 'UNDO',
    data: action
  });
  
  return { success: true, action };
}

/**
 * Redo last undone action
 */
async function redo() {
  if (state.historyIndex >= state.history.length - 1) {
    return { success: false, error: 'Nothing to redo' };
  }
  
  state.historyIndex++;
  const action = state.history[state.historyIndex];
  
  // Save updated index
  await chrome.storage.local.set({
    [STORAGE_KEYS.HISTORY]: {
      items: state.history,
      index: state.historyIndex
    }
  });
  
  notifyPopup({
    type: 'REDO',
    data: action
  });
  
  return { success: true, action };
}

/**
 * Clear history
 */
async function clearHistory() {
  state.history = [];
  state.historyIndex = -1;
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.HISTORY]: {
      items: [],
      index: -1
    }
  });
  
  return { success: true };
}

/**
 * Get settings from storage
 */
async function getSettings() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
  return result[STORAGE_KEYS.SETTINGS] || {
    autoSave: true,
    saveDelay: 500,
    enableHistory: true,
    maxHistorySize: 50
  };
}

/**
 * Toggle inspector mode in active tab
 */
async function toggleInspector(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }
  
  if (!tabId) {
    return { success: false, error: 'No active tab' };
  }
  
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_INSPECTOR' });
    return { success: true };
  } catch (error) {
    console.error('[StyleForge] Error toggling inspector:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Open popup programmatically
 */
async function openPopup() {
  // This is handled by the browser automatically when clicking the extension icon
  return { success: true };
}

/**
 * Notify popup of events
 */
function notifyPopup(message) {
  // Find popup view and send message
  const views = chrome.extension.getViews({ type: 'popup' });
  
  views.forEach(view => {
    if (view.chrome && view.chrome.runtime) {
      view.postMessage(message);
    }
  });
  
  // Also try to send via runtime
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (e) {
    // Popup might not be open
  }
}

/**
 * Handle tab activation
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  state.currentTabId = activeInfo.tabId;
  
  // Notify content script to load styles for new tab
  chrome.tabs.sendMessage(activeInfo.tabId, {
    type: 'TAB_ACTIVATED'
  }).catch(() => {});
});

/**
 * Handle tab updates (navigation)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tabId === state.currentTabId) {
    console.log('[StyleForge] Tab loaded:', tab.url);
  }
});

/**
 * Handle window focus changes
 */
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }
  
  // Update current tab for focused window
  chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
    if (tab) {
      state.currentTabId = tab.id;
    }
  });
});

/**
 * Keyboard shortcut handler
 */
chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'toggle-inspector') {
    toggleInspector();
  }
});

console.log('[StyleForge] Service worker initialized');
