# StyleForge - Visual Style Editor for Chrome

A powerful Chrome Extension that allows you to visually edit styles of any web page in real-time, with support for CSS, Tailwind CSS, and export capabilities.

## 🚀 Features

### Core Functionality
- **Click-to-Select Inspector** - Hover over any element to preview, click to select
- **Real-time Style Editing** - Modify CSS properties and see changes instantly
- **State Management** - Edit base, :hover, :focus, :active states
- **Responsive Breakpoints** - Apply styles for sm, md, lg, xl, 2xl breakpoints
- **Tailwind CSS Support** - Search and apply utility classes
- **Export Options** - Export as CSS, Tailwind classes, or JSON

### Supported CSS Properties
- **Typography**: font-size, font-weight, line-height, text-align
- **Colors**: text color, background color, opacity (with color picker)
- **Box Model**: width, height, padding, margin, border-radius
- **Layout**: display, position, z-index
- **Effects**: box-shadow, filter

### Advanced Features
- **Shadow DOM Support** - Style ::part() elements
- **SVG Styling** - Full support for SVG elements
- **SPA Navigation** - Auto-detect route changes
- **History/Undo-Redo** - Track and revert changes
- **Local Storage** - Persist styles between sessions
- **Keyboard Shortcuts** - Ctrl+Shift+E to toggle inspector

## 📁 Project Structure

```
styleforge-chrome/
├── manifest.json              # Extension manifest (V3)
├── assets/                    # Icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/
│   │   └── service-worker.js  # Background service worker
│   ├── content/
│   │   ├── content-script.js  # Entry point
│   │   ├── inspector.js       # DOM inspector & highlighter
│   │   ├── style-injector.js  # CSS injection engine
│   │   └── bridge.js          # Message bridge
│   └── popup/
│       ├── popup.html         # UI interface
│       └── popup.js           # UI logic
└── README.md
```

## 🛠️ Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `styleforge-chrome` folder
5. The extension icon should appear in your toolbar

### Pin to Toolbar
- Click the puzzle piece icon in Chrome toolbar
- Find "StyleForge" and click the pin icon

## 📖 Usage Guide

### Basic Workflow

1. **Navigate** to any web page you want to style
2. **Click** the StyleForge extension icon
3. **Activate Inspector** by clicking 🔍 Inspect button or pressing `Ctrl+Shift+E`
4. **Hover** over elements to preview selection (blue highlight)
5. **Click** to select an element
6. **Edit Styles** in the popup panel:
   - Switch between CSS/Tailwind/History/Export tabs
   - Choose state (Base, :hover, :focus, :active)
   - Choose breakpoint (All, sm, md, lg, xl)
   - Modify properties in real-time
7. **Save** your changes (auto-saved, but explicit save available)
8. **Export** when ready (CSS, Tailwind, or JSON)

### State Editing

Elements can have different styles for different interaction states:

| State | Description | Use Case |
|-------|-------------|----------|
| Base | Default state | Normal appearance |
| :hover | Mouse hover | Button hover effects |
| :focus | Keyboard focus | Accessibility styling |
| :active | Being clicked | Click feedback |

### Responsive Breakpoints

Apply styles conditionally based on viewport width:

| Breakpoint | Min Width | Typical Device |
|------------|-----------|----------------|
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Laptops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large screens |

### Tailwind CSS Integration

1. Go to the **Tailwind** tab
2. Search for classes (e.g., `bg-red-500`, `flex`, `p-4`)
3. Click suggestions to apply
4. Applied classes appear as chips
5. Click × on a chip to remove

### Exporting Styles

1. Go to the **Export** tab
2. Choose format:
   - **CSS**: Full stylesheet with media queries and pseudo-classes
   - **Tailwind Classes**: Ready-to-use class strings
   - **JSON**: Complete data structure for programmatic use
3. Click **Copy** to copy to clipboard
4. Click **Download** to save as file

## 🔧 Technical Details

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Popup     │────▶│  Background  │◀────│   Content   │
│    (UI)     │     │Service Worker│     │   Script    │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │chrome.storage│
                    │    local     │
                    └─────────────┘
```

### Message Flow

1. User clicks element → Content Script detects selection
2. Content Script → Background: `ELEMENT_SELECTED`
3. Background → Popup: Notify of selection
4. User edits style → Popup → Background: `UPDATE_STYLES`
5. Background → Content Script: Apply styles via `<style>` injection
6. Content Script → Background: `SAVE_STYLES`
7. Background → chrome.storage.local: Persist data

### Data Structure

Styles are stored per domain and path:

```json
{
  "domain:example.com": {
    "/page-path": {
      "element-selector": {
        "base": {
          "all": {
            "css": { "color": "#fff", "padding": "16px" },
            "tailwind": ["bg-blue-500"]
          }
        },
        "hover": {
          "md": {
            "css": { "color": "#ff0" },
            "tailwind": ["md:hover:bg-blue-600"]
          }
        }
      }
    }
  }
}
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Toggle Inspector |
| `Escape` | Cancel inspection |

## 🎨 Customization

### Adding More CSS Properties

Edit `popup.html` to add new property inputs:

```html
<div class="property-row">
  <label class="property-label">New Property</label>
  <input type="text" class="property-input" data-prop="newProperty" placeholder="value">
</div>
```

The `data-prop` attribute should match the CSS property name in camelCase.

### Extending Tailwind Suggestions

Edit `popup.js` and modify the `searchTailwind()` method to include more class suggestions.

## 🔒 Privacy & Security

- **No External Requests**: All data stays local
- **No Tracking**: No analytics or telemetry
- **Local Storage Only**: Uses chrome.storage.local
- **CSP Compliant**: No eval() or inline scripts
- **Manifest V3**: Latest Chrome extension security standards

## 🐛 Troubleshooting

### Extension not working on a page?
- Refresh the page after installing/enabling the extension
- Check if the page has restrictive CSP policies
- Some pages (chrome://, about:blank) are restricted by Chrome

### Styles not persisting?
- Ensure you're on the same URL path
- Check chrome.storage.local quota (5MB limit)
- Try explicit Save button

### Inspector not highlighting elements?
- Make sure no other dev tools are interfering
- Try deactivating and reactivating the inspector

## 📝 Development

### Running Tests

```bash
# Lint JavaScript files
npx eslint src/

# Check manifest
npx web-ext lint
```

### Building for Production

```bash
# Create ZIP for Chrome Web Store
cd styleforge-chrome
zip -r ../styleforge.zip .
```

### Debugging

1. **Popup**: Right-click extension icon → "Inspect popup"
2. **Background**: `chrome://extensions/` → Service Worker → "Inspect"
3. **Content Script**: DevTools Console on any page

## 📄 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📞 Support

For issues and feature requests, please open an issue on GitHub.

---

**Built with ❤️ for web developers everywhere**
