# Iframe Integration Guide - SIF Boundou

## Overview
This guide explains how to embed the SIF Boundou geoportal in an iframe on your website.

## Quick Start

### Basic Embedding
```html
<iframe 
    src="https://your-domain.com/sif-boundou/" 
    width="100%" 
    height="800px"
    style="border: none;"
    title="SIF Boundou Geoportal"
    allow="geolocation; fullscreen">
</iframe>
```

## Fixes Applied

### 1. Map Resize Handling
The application now automatically resizes when:
- The iframe container is resized
- The browser window is resized
- A postMessage is received from the parent window

### 2. CSS Improvements
Added explicit sizing to ensure proper display in iframes:
```css
html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
}
```

### 3. PostMessage Communication
Parent pages can trigger a map resize by sending a message:
```javascript
// From parent page
const iframe = document.getElementById('mapIframe');
iframe.contentWindow.postMessage('resize', '*');
```

## Advanced Integration

### Responsive Container
```html
<div style="width: 100%; height: 80vh; position: relative;">
    <iframe 
        src="https://your-domain.com/sif-boundou/" 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
        title="SIF Boundou Geoportal"
        allow="geolocation; fullscreen">
    </iframe>
</div>
```

### Full-Screen Integration
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body, html { margin: 0; padding: 0; overflow: hidden; }
        iframe { width: 100vw; height: 100vh; border: none; }
    </style>
</head>
<body>
    <iframe 
        src="https://your-domain.com/sif-boundou/" 
        title="SIF Boundou Geoportal"
        allow="geolocation; fullscreen">
    </iframe>
</body>
</html>
```

### With Resize Detection
```html
<iframe id="boundouMap" src="https://your-domain.com/sif-boundou/"></iframe>

<script>
const iframe = document.getElementById('boundouMap');

// Notify iframe when parent resizes
window.addEventListener('resize', () => {
    iframe.contentWindow.postMessage('resize', '*');
});

// Notify iframe after it loads
iframe.addEventListener('load', () => {
    setTimeout(() => {
        iframe.contentWindow.postMessage('resize', '*');
    }, 500);
});
</script>
```

## Testing

### Test Page Included
A test page is included at `iframe-test.html` that demonstrates:
- Basic iframe embedding
- Resize functionality
- PostMessage communication
- Fullscreen mode

To use it:
1. Open `iframe-test.html` in your browser
2. Test the resize buttons
3. Verify the map fills the entire iframe

### Manual Testing Checklist
- [ ] Map displays correctly on initial load
- [ ] Map fills the entire iframe (not just 1/4)
- [ ] Map resizes when browser window is resized
- [ ] Map resizes when iframe container is resized
- [ ] PostMessage communication works
- [ ] Fullscreen mode works correctly
- [ ] All interactive features work (zoom, pan, 3D toggle)
- [ ] Search functionality works
- [ ] Parcel details display correctly

## Technical Details

### MapLibre GL JS Resize
The app uses MapLibre GL JS's `map.resize()` method to recalculate dimensions:
```javascript
handleResize() {
    if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
    }
    
    this.resizeTimeout = setTimeout(() => {
        if (this.map) {
            this.map.resize();
        }
    }, 100);
}
```

### Event Listeners
Two event listeners ensure proper resizing:

1. **Window Resize**
```javascript
window.addEventListener('resize', () => {
    this.handleResize();
});
```

2. **PostMessage**
```javascript
window.addEventListener('message', (event) => {
    if (event.data === 'resize' || event.data.type === 'resize') {
        this.handleResize();
    }
});
```

### Debouncing
Resize calls are debounced with a 100ms delay to prevent excessive updates during continuous resizing.

## Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Security Considerations

### CORS
Ensure your server allows iframe embedding by setting appropriate headers:
```
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: frame-ancestors 'self' https://your-parent-domain.com
```

### PostMessage Security
The current implementation accepts messages from any origin (`'*'`). For production, restrict to specific domains:
```javascript
window.addEventListener('message', (event) => {
    // Verify origin
    if (event.origin !== 'https://your-parent-domain.com') {
        return;
    }
    
    if (event.data === 'resize' || event.data.type === 'resize') {
        this.handleResize();
    }
});
```

## Troubleshooting

### Map Shows Only in 1/4 of Iframe
**Fixed!** This was caused by the map initializing before knowing the iframe's true size. The fixes above resolve this.

### Map Doesn't Resize
Check:
1. Parent page is sending postMessage after iframe loads
2. Browser console for any JavaScript errors
3. Iframe has explicit width/height set

### Map Appears Blank
Check:
1. API keys are configured correctly
2. Network tab shows successful tile requests
3. No CORS errors in console

### Interactions Don't Work
Check:
1. Iframe has proper `allow` attributes
2. No CSP blocking scripts
3. JavaScript is enabled

## Performance

### Optimization Tips
1. **Load iframe after page content** - Use lazy loading
2. **Set explicit dimensions** - Avoid layout shifts
3. **Use IntersectionObserver** - Load only when visible
4. **Consider lazy loading tiles** - For mobile devices

### Example: Lazy Load Iframe
```html
<iframe 
    id="boundouMap"
    data-src="https://your-domain.com/sif-boundou/" 
    width="100%" 
    height="800px"
    style="border: none;">
</iframe>

<script>
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const iframe = entry.target;
            iframe.src = iframe.dataset.src;
            observer.unobserve(iframe);
        }
    });
});

observer.observe(document.getElementById('boundouMap'));
</script>
```

## Support
For issues or questions, contact the development team or create an issue in the repository.

## Version History
- **v1.1.0** (2025-11-22): Added iframe resize support and postMessage communication
- **v1.0.0**: Initial release
