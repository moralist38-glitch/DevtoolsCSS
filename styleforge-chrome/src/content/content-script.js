/**
 * StyleForge - Content Script Entry Point
 * Loads all modules and initializes the content script
 */

// Load modules in order
const script1 = document.createElement('script');
script1.src = chrome.runtime.getURL('src/content/inspector.js');
script1.onload = () => {
  const script2 = document.createElement('script');
  script2.src = chrome.runtime.getURL('src/content/style-injector.js');
  script2.onload = () => {
    const script3 = document.createElement('script');
    script3.src = chrome.runtime.getURL('src/content/bridge.js');
  };
  document.head.appendChild(script2);
};
document.head.appendChild(script1);
