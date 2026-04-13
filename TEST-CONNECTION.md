# Database Connection Check - Snackbar Style

## New Design:

### Snackbar Notification (Bottom Right)
- **Position**: Fixed at bottom-right corner
- **Style**: Red snackbar with shadow
- **Animation**: Slides in from bottom

### Components:
1. **WiFi Off Icon** - Red icon showing disconnection
2. **Error Message** - "No internet connection" or "Cannot connect to server"
3. **Subtitle** - "Check your internet connection" or "Reconnecting..."
4. **Retry Button** - Red button with icon

### Retry Button States:

**Normal State:**
- Shows: RefreshCw icon + "Retry" text
- Color: Red background
- Clickable

**Retrying State (5 seconds):**
- Shows: Spinning Loader icon + "Retrying..." text
- Color: Lighter red (disabled)
- Not clickable
- Animated spinning loader

### Features:
- ✅ Snackbar style (not blocking popup)
- ✅ No "Continue Offline" button (removed)
- ✅ Only "Retry" button
- ✅ 5 second delay when retrying
- ✅ Loading animation during retry
- ✅ Retry counter shows attempt number
- ✅ Smooth slide-in animation

## How It Works:

1. **On Load**: Checks connection (10 second timeout)
2. **If Failed**: Snackbar appears at bottom-right
3. **Click Retry**: 
   - Button shows "Retrying..." with spinning icon
   - Waits 5 seconds
   - Attempts reconnection
   - If successful: Snackbar disappears
   - If failed: Shows error again with attempt counter

## Visual Layout:

```
┌─────────────────────────────────────┐
│ [WiFi Off] No internet connection   │
│            Check your internet   [Retry] │
│                                     │
│                          Attempt 1  │
└─────────────────────────────────────┘
```

**During Retry:**
```
┌─────────────────────────────────────┐
│ [WiFi Off] No internet connection   │
│            Reconnecting...  [⟳ Retrying...] │
│                                     │
│                          Attempt 2  │
└─────────────────────────────────────┘
```

## Test Instructions:

1. Turn off WiFi
2. Refresh page
3. See snackbar at bottom-right
4. Click "Retry" button
5. Watch spinning animation for 5 seconds
6. Turn WiFi back on during retry
7. Snackbar disappears when connected

## Colors:
- Background: Red-50 (light) / Red-950 (dark)
- Border: Red-200 / Red-800
- Text: Red-900 / Red-100
- Button: Red-600 hover Red-700
- Icon: Red-600 / Red-400
