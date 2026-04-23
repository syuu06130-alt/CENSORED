# CENSORED: Observer's Perjury

## Game Overview

**Title**: CENSORED: Observer's Perjury

**Description**: A surveillance horror game where you monitor AI-controlled security feeds in a dystopian city. The AI actively censors anomalies with black boxes and static, forcing you to deduce threats from environmental clues, shadows, and audio hints. Communicate with civilians using coded messages to avoid triggering the AI's suspicion protocols.

**Core Gameplay Loop**: Observe two security camera feeds → Detect censored anomalies through indirect clues → Respond to civilian requests using coded language that sounds innocent to the AI → Manage suspicion meter to avoid termination

## Code Overview

**How it works**: The game presents a fixed surveillance station UI with two camera feeds (hallway and apartment). A scripted 3-minute sequence introduces anomalies that the AI censors with black boxes. Players must interpret shadows, reflections, and audio cues to understand what's hidden, then select appropriate coded messages when a civilian requests help. Choosing the wrong message or using forbidden language increases AI suspicion, leading to game over.

**Key variables**:
- `gameState` - Tracks current phase, elapsed time, suspicion level, selected message
- `config` - Holds editable parameters (shift duration, AI sensitivity, censorship intensity, etc.)
- `eventTimeline` - Array of scripted events with timestamps and callbacks
- `censorBoxes` - Array of active censorship overlays with positions and animations
- `audioContext` - Web Audio API context for all sound playback

**Main functions**:
- `startShift()` - Initializes game state, starts event timeline and game loop
- `updateGameLoop(timestamp)` - Main update cycle, processes events, updates animations
- `triggerEvent(eventData)` - Executes scripted events (anomaly appearance, civilian communication)
- `selectMessage(index)` - Handles player message selection
- `sendMessage()` - Processes message choice, updates suspicion, triggers consequences
- `renderCameraFeed(feedId)` - Draws camera feed with backgrounds, characters, censorship layers
- `applyCensorshipEffect(feed, x, y, width, height)` - Creates animated censorship overlay
- `endShift(success)` - Handles win/lose conditions and displays results

**Important implementation details**:
- Uses delta time capped at 100ms for frame-independent animations
- Censorship boxes are CSS divs positioned absolutely over canvas feeds for smooth animations
- Event timeline uses elapsed time checks rather than setInterval for precision
- Audio uses Web Audio API with preloaded buffers for instant playback
- Suspicion meter has different sensitivity multipliers based on edit mode settings
- Camera feeds render at 320×240px with pixel-perfect asset scaling to maintain aspect ratios

## Code Structure

### File Organization

| File | Purpose |
|------|---------|
| `index.html` | HTML structure, camera feed containers, UI panels |
| `game.js` | Main game logic, event system, rendering, audio |
| `style.css` | Retro terminal UI, animations, glitch effects |
| `game_config.json` | Editable settings (difficulty, duration, visual style) |

### Key Components in game.js

```
run(mode)                    - Entry point, initializes game based on mode
├── Edit mode setup          - Shows game parameters UI, allows customization
└── Play mode setup          - Preloads assets, starts shift, enables gameplay

startShift()                 - Begins the 3-minute surveillance shift
├── Initialize state         - Reset suspicion, time, phase
├── Setup event timeline     - Schedule scripted anomaly events
└── Start game loop          - Begin render/update cycle

updateGameLoop(timestamp)    - Main update cycle (requestAnimationFrame)
├── Calculate delta time     - Frame-independent timing
├── Check event triggers     - Process timeline events at correct moments
├── Update animations        - Censorship boxes, glitches, scan lines
└── Render feeds             - Draw camera feeds with all layers

Event System
├── 0:45 - First anomaly     - Shadow appears, censorship applied
├── 1:30 - Civilian appears  - Communication prompt shown
├── 2:15 - Message response  - Process player choice, show consequences
└── 3:00 - Shift complete    - End game, show results

Communication System
├── selectMessage(index)     - Highlight chosen message option
├── sendMessage()            - Validate choice, update suspicion
└── processConsequences()    - Trigger success/failure animations
```

### State Management

- **window.gameConfig**: Creator-editable parameters loaded from game_config.json
  - `shiftDuration`: Length of shift in seconds (120-300)
  - `aiSensitivity`: "lenient" | "standard" | "paranoid"
  - `censorshipIntensity`: "minimal" | "standard" | "heavy"
  - `audioCues`: "clear" | "distorted" | "minimal"
  - `colorScheme`: "green" | "amber" | "blue" | "red"
  - `glitchIntensity`: 0-100 percentage
  
- **Runtime variables**: Temporary gameplay state (not persisted)
  - `currentPhase`: "observing" | "communicating" | "resolving"
  - `elapsedTime`: Seconds since shift started
  - `suspicionLevel`: 0-100 percentage
  - `selectedMessageIndex`: Currently highlighted message option
  - `hasResponded`: Whether player has sent their message
  
- **Player data**: Not applicable (single-session game, no save system needed)

## Modification Guide

### Which File to Edit

| Change Type | File | Notes |
|------------|------|-------|
| Event timing, game logic | game.js | Adjust event timeline, suspicion calculations |
| UI colors, glitch effects | style.css | Change color schemes, animation speeds |
| HTML structure | index.html | Modify layout, add UI elements |
| Default difficulty settings | game_config.json | Adjust starting parameters |

### Adding New Features

1. **New anomaly events**: Add to `eventTimeline` array with timestamp and callback function
2. **New message options**: Add to `messageOptions` array, update communication panel rendering
3. **New visual effects**: Create CSS animations or canvas rendering functions
4. **New audio cues**: Request via asset system, preload in `preloadAudio()`, trigger in events

## Important Rules

1. **All JS in .js files** - No inline `<script>` tags in index.html
2. **window.run(mode)** - Required entry point, receives 'edit' or 'play'
3. **gameConfig for creator data only** - Difficulty settings, visual preferences (not player progress)
4. **Cache assets at init** - All images and audio loaded before shift starts
5. **Delta time for animations** - Ensures consistent speed across different frame rates
6. **Maintain aspect ratios** - Camera feeds are 4:3 (320×240px), never stretch assets
