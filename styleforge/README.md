# StyleForge

**Visual Style Editor for Chrome** - Select, edit, and export CSS/Tailwind styles directly in your browser.

## Features

### Core Functionality
- **Click-to-Select Inspector**: Activate with Ctrl+Shift+E or the toolbar button
- **Real-time Style Editing**: Modify CSS properties and see changes instantly
- **State Management**: Edit base styles plus hover, focus, active, and other pseudo-states
- **Responsive Breakpoints**: Apply styles at different screen sizes (sm, md, lg, xl, 2xl)
- **History & Undo/Redo**: Track changes and revert when needed

### CSS Properties Supported
- **Typography**: font-size, font-weight, line-height, text-align, etc.
- **Colors**: text color, background color with HEX/RGB pickers, opacity
- **Box Model**: width, height, padding, margin, border-radius, display
- **Effects**: box-shadow, filter, backdrop-filter
- **Layout**: flexbox and grid properties

### Tailwind CSS Integration
- Search and apply Tailwind utility classes
- Automatic class generation from CSS properties
- Support for state prefixes (hover:, focus:) and breakpoint prefixes (md:, lg:)

### Export Options
- **CSS**: Generate clean CSS with media queries and pseudo-selectors
- **Tailwind**: Export as Tailwind class lists
- **JSON**: Save complete style configurations

### Data Persistence
- Styles saved locally per tab using chrome.storage.local
- Auto-save with debouncing
- Survives page refreshes and browser restarts

## Installation

### Development Mode
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `styleforge` folder
6. The extension icon should appear in your toolbar

### Usage
1. Navigate to any webpage
2. Click the StyleForge extension icon
3. Click the inspector button (🔍) or press Ctrl+Shift+E
4. Hover over elements to highlight them
5. Click to select an element
6. Modify styles in the popup panel
7. Export your styles when ready

## Project Structure

```
styleforge/
├── manifest.json           # Extension manifest (Manifest V3)
├── assets/                 # Icons and static assets
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── background/
    │   └── service-worker.js  # Background service worker
    ├── content/
    │   └── content-script.js  # Content script for DOM manipulation
    └── popup/
        ├── popup.html      # Popup/Side Panel UI
        └── popup.js        # Popup logic
```

## Architecture

### Components

**Content Script** (`src/content/content-script.js`)
- Injects `<style id="styleforge-inject">` into pages
- Handles element selection with visual highlighting
- Listens for keyboard shortcuts (Ctrl+Shift+E)
- Applies style changes in real-time

**Background Service Worker** (`src/background/service-worker.js`)
- Central state management
- Communication hub between content scripts and popup
- Local storage operations
- Export functionality (CSS, Tailwind, JSON)
- History/undo-redo management

**Popup UI** (`src/popup/popup.html`, `src/popup/popup.js`)
- Property editor interface
- Tab navigation (CSS, Tailwind, Export, History)
- Context selectors (states, breakpoints)
- Export preview and download

### Communication Flow

```
User Action → Popup → Background Worker → Content Script → DOM
     ↓                                          ↑
     └─────────── Storage ←─────────────────────┘
```

1. User selects element via inspector
2. Content script sends selector to background
3. Background updates state and notifies popup
4. User modifies properties in popup
5. Popup sends changes to background
6. Background saves to storage and forwards to content script
7. Content script applies styles via injected `<style>` element

## API Reference

### Message Types

**From Content to Background:**
- `ELEMENT_SELECTED`: Element was selected
- `CONTENT_READY`: Content script initialized
- `INSPECTOR_TOGGLED`: Inspector mode changed

**From Popup to Background:**
- `GET_STATE`: Request current state
- `STYLE_UPDATED`: Style property changed
- `UNDO`/`REDO`: History navigation
- `EXPORT_STYLES`: Request export
- `RESET_STYLES`: Clear styles

**From Background to Content:**
- `TOGGLE_INSPECTOR`: Enable/disable inspector
- `APPLY_STYLES`: Apply specific styles
- `APPLY_ALL_STYLES`: Reapply all saved styles

### Data Structure

```javascript
{
  selector: {
    base: {
      all: {
        'color': '#000000',
        'font-size': '16px'
      },
      md: {
        'font-size': '18px'
      }
    },
    hover: {
      all: {
        'background-color': '#f0f0f0'
      }
    }
  }
}
```

## Browser Compatibility

- **Google Chrome**: 88+ (Manifest V3)
- **Microsoft Edge**: 88+ (Manifest V3)
- **Other Chromium browsers**: Should work with Manifest V3 support

## Limitations

- **Shadow DOM**: Only open shadow roots are supported
- **Cross-origin iframes**: Cannot inspect or style due to CORS
- **Canvas elements**: Only container styling, not canvas content
- **Closed Shadow DOM**: Not accessible by design

## Security

- No external network requests
- All data stored locally in chrome.storage.local
- No eval() or inline scripts (CSP compliant)
- Styles injected via safe `<style>` element

## Performance

- Debounced style updates (50-100ms)
- Single style element per page
- Efficient DOM observation
- Minimal layout thrashing

## Future Enhancements

- [ ] Comprehensive Tailwind class mapping
- [ ] Visual gradient editor
- [ ] Box model visualization
- [ ] Computed styles panel
- [ ] Import existing CSS
- [ ] Share/export presets
- [ ] Multi-element selection
- [ ] Animation timeline editor

## License

MIT License - Feel free to use and modify.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and feature requests, please open an issue on the repository.
