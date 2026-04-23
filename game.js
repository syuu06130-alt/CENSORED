/* ==================================================
 * CENSORED: Observer's Perjury - Main Game Logic
 *
 * A surveillance horror game where players monitor AI-censored security feeds.
 * Players must detect anomalies through indirect clues and communicate with
 * civilians using coded messages to avoid triggering AI suspicion protocols.
 *
 * GAME STATE SHAPE: window.gameConfig = {
 *   shiftDuration: number (120-300 seconds),
 *   aiSensitivity: "lenient" | "standard" | "paranoid",
 *   censorshipIntensity: "minimal" | "standard" | "heavy",
 *   audioCues: "clear" | "distorted" | "minimal",
 *   colorScheme: "green" | "amber" | "blue" | "red",
 *   glitchIntensity: number (0-100)
 * }
 * ================================================== */

// ===== GLOBAL STATE =====
let gameState = {
  mode: 'play',
  phase: 'idle', // 'idle' | 'observing' | 'communicating' | 'resolving' | 'ended'
  elapsedTime: 0,
  suspicionLevel: 0,
  selectedMessageIndex: null,
  hasResponded: false,
  shiftStartTime: 0,
  lastFrameTime: 0,
  animationFrameId: null,
};

let config = {
  shiftDuration: 180,
  aiSensitivity: 'standard',
  censorshipIntensity: 'standard',
  audioCues: 'distorted',
  colorScheme: 'green',
  glitchIntensity: 60,
};

// ===== ASSET CACHE =====
const assetCache = {
  images: {},
  audioBuffers: {},
  audioSources: {},
};

let audioContext = null;

// ===== DOM ELEMENTS =====
let elements = {};

// ===== EVENT TIMELINE =====
let eventTimeline = [];
let currentEventIndex = 0;

// ===== CENSORSHIP STATE =====
let censorBoxes = {
  feedA: [],
  feedB: [],
};

// ===== ANIMATION STATE =====
let shadowPosition = { x: 0, y: 0, visible: false };
let civilianState = { visible: false, distressed: false };
let flickerState = { active: false, intensity: 0 };

// ===== MESSAGE OPTIONS =====
const messageOptions = [
  { text: '"Weather looks clear today"', correct: false, suspicionIncrease: 0 },
  { text: '"Maintenance scheduled for sector 3"', correct: true, suspicionIncrease: 0 },
  { text: '"All systems normal, remain in designated areas"', correct: true, suspicionIncrease: 0 },
  { text: '"There\'s something in the hallway!"', correct: false, suspicionIncrease: 50 },
];

/* ==================================================
 * MAIN ENTRY POINT
 * ================================================== */
function run(mode) {
  lib.log('run() called. Mode: ' + mode);

  gameState.mode = mode;

  // Initialize DOM elements
  initializeElements();

  // Load config from gameConfig
  if (window.gameConfig) {
    config = { ...config, ...window.gameConfig };
  }

  // Apply color scheme
  applyColorScheme(config.colorScheme);

  // Show game parameters UI
  lib.showGameParameters({
    name: 'Shift Settings',
    params: {
      'Shift Duration': {
        key: 'gameConfig.shiftDuration',
        type: 'slider',
        min: 120,
        max: 300,
        step: 30,
        onChange: (value) => {
          window.gameConfig.shiftDuration = value;
          config.shiftDuration = value;
        },
      },
      'AI Suspicion Sensitivity': {
        key: 'gameConfig.aiSensitivity',
        type: 'dropdown',
        options: [
          { label: 'Lenient', value: 'lenient' },
          { label: 'Standard', value: 'standard' },
          { label: 'Paranoid', value: 'paranoid' },
        ],
        onChange: (value) => {
          window.gameConfig.aiSensitivity = value;
          config.aiSensitivity = value;
        },
      },
      'Censorship Intensity': {
        key: 'gameConfig.censorshipIntensity',
        type: 'dropdown',
        options: [
          { label: 'Minimal', value: 'minimal' },
          { label: 'Standard', value: 'standard' },
          { label: 'Heavy', value: 'heavy' },
        ],
        onChange: (value) => {
          window.gameConfig.censorshipIntensity = value;
          config.censorshipIntensity = value;
        },
      },
      'Audio Cues': {
        key: 'gameConfig.audioCues',
        type: 'dropdown',
        options: [
          { label: 'Clear', value: 'clear' },
          { label: 'Distorted', value: 'distorted' },
          { label: 'Minimal', value: 'minimal' },
        ],
        onChange: (value) => {
          window.gameConfig.audioCues = value;
          config.audioCues = value;
        },
      },
      'Interface Color': {
        key: 'gameConfig.colorScheme',
        type: 'dropdown',
        options: [
          { label: 'Green Terminal', value: 'green' },
          { label: 'Amber Monitor', value: 'amber' },
          { label: 'Blue Hologram', value: 'blue' },
          { label: 'Red Alert', value: 'red' },
        ],
        onChange: (value) => {
          window.gameConfig.colorScheme = value;
          config.colorScheme = value;
          applyColorScheme(value);
        },
      },
      'Glitch Effect Intensity': {
        key: 'gameConfig.glitchIntensity',
        type: 'slider',
        min: 0,
        max: 100,
        step: 10,
        onChange: (value) => {
          window.gameConfig.glitchIntensity = value;
          config.glitchIntensity = value;
        },
      },
    },
  });

  if (mode === 'edit') {
    // Edit mode: Show static preview
    setupEditMode();
  } else {
    // Play mode: Full game
    setupPlayMode();
  }
}

/* ==================================================
 * INITIALIZATION
 * ================================================== */
function initializeElements() {
  elements = {
    statusBar: document.getElementById('status-bar'),
    systemStatusText: document.getElementById('system-status-text'),
    suspicionFill: document.getElementById('suspicion-fill'),
    suspicionValue: document.getElementById('suspicion-value'),

    feedA: document.getElementById('feed-a'),
    feedB: document.getElementById('feed-b'),
    canvasA: document.getElementById('canvas-a'),
    canvasB: document.getElementById('canvas-b'),
    censorLayerA: document.getElementById('censor-layer-a'),
    censorLayerB: document.getElementById('censor-layer-b'),
    timestampA: document.getElementById('timestamp-a'),
    timestampB: document.getElementById('timestamp-b'),

    systemLog: document.getElementById('system-log'),
    logContent: document.getElementById('log-content'),

    communicationPanel: document.getElementById('communication-panel'),
    messagePrompt: document.getElementById('message-prompt'),
    messageOptions: document.getElementById('message-options'),
    sendMessageBtn: document.getElementById('send-message-btn'),

    endScreen: document.getElementById('end-screen'),
    endTitle: document.getElementById('end-title'),
    endMessage: document.getElementById('end-message'),
    endStats: document.getElementById('end-stats'),
    restartBtn: document.getElementById('restart-btn'),

    glitchOverlay: document.getElementById('glitch-overlay'),
  };
}

function applyColorScheme(scheme) {
  const body = document.body;
  body.classList.remove('scheme-green', 'scheme-amber', 'scheme-blue', 'scheme-red');
  if (scheme !== 'green') {
    body.classList.add('scheme-' + scheme);
  }
}

/* ==================================================
 * EDIT MODE
 * ================================================== */
function setupEditMode() {
  lib.log('Setting up Edit Mode');

  // Show static preview of the monitoring station
  const ctxA = elements.canvasA.getContext('2d');
  const ctxB = elements.canvasB.getContext('2d');

  // Draw placeholder backgrounds
  ctxA.fillStyle = '#1a1f1a';
  ctxA.fillRect(0, 0, 320, 240);
  ctxA.fillStyle = '#00ff41';
  ctxA.font = '20px VT323';
  ctxA.textAlign = 'center';
  ctxA.fillText('FEED A: HALLWAY', 160, 120);

  ctxB.fillStyle = '#2a2520';
  ctxB.fillRect(0, 0, 320, 240);
  ctxB.fillStyle = '#00ff41';
  ctxB.font = '20px VT323';
  ctxB.textAlign = 'center';
  ctxB.fillText('FEED B: APARTMENT', 160, 120);

  addLogEntry('Edit mode active - Adjust settings above');
}

/* ==================================================
 * PLAY MODE
 * ================================================== */
function setupPlayMode() {
  lib.log('Setting up Play Mode');

  // Initialize audio context
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Preload all assets
  preloadAssets()
    .then(() => {
      lib.log('Assets loaded, ready to start shift');

      // Setup event listeners
      setupEventListeners();

      // Start the shift
      startShift();
    })
    .catch((error) => {
      lib.log('Error loading assets: ' + error);
      addLogEntry('ERROR: Asset loading failed', 'error');
    });
}

function preloadAssets() {
  return new Promise((resolve, reject) => {
    const imageIds = [
      'hallway_background',
      'apartment_interior_background',
      'civilian_character_neutral',
      'civilian_character_distressed',
      'shadow_silhouette',
    ];

    const audioIds = [
      'ambient_surveillance_room',
      'static_glitch_sfx',
      'suspicion_alert_sfx',
      'message_send_sfx',
      'distant_footsteps_sfx',
    ];

    let loadedCount = 0;
    const totalAssets = imageIds.length + audioIds.length;

    // Load images
    imageIds.forEach((id) => {
      const assetInfo = lib.getAsset(id);
      if (assetInfo && assetInfo.url) {
        const img = new Image();
        img.onload = () => {
          assetCache.images[id] = img;
          loadedCount++;
          if (loadedCount === totalAssets) resolve();
        };
        img.onerror = () => {
          lib.log('Failed to load image: ' + id);
          loadedCount++;
          if (loadedCount === totalAssets) resolve();
        };
        img.src = assetInfo.url;
      } else {
        loadedCount++;
        if (loadedCount === totalAssets) resolve();
      }
    });

    // Load audio
    audioIds.forEach((id) => {
      const assetInfo = lib.getAsset(id);
      if (assetInfo && assetInfo.url) {
        fetch(assetInfo.url)
          .then((response) => response.arrayBuffer())
          .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
          .then((audioBuffer) => {
            assetCache.audioBuffers[id] = audioBuffer;
            loadedCount++;
            if (loadedCount === totalAssets) resolve();
          })
          .catch((error) => {
            lib.log('Failed to load audio: ' + id + ' - ' + error);
            loadedCount++;
            if (loadedCount === totalAssets) resolve();
          });
      } else {
        loadedCount++;
        if (loadedCount === totalAssets) resolve();
      }
    });
  });
}

function setupEventListeners() {
  // Message selection
  const radioButtons = elements.messageOptions.querySelectorAll('input[type="radio"]');
  radioButtons.forEach((radio, index) => {
    radio.addEventListener('change', () => {
      gameState.selectedMessageIndex = index;
      elements.sendMessageBtn.disabled = false;
    });
  });

  // Send message button
  elements.sendMessageBtn.addEventListener('click', sendMessage);

  // Restart button
  elements.restartBtn.addEventListener('click', () => {
    elements.endScreen.classList.add('hidden');
    startShift();
  });
}

/* ==================================================
 * GAME FLOW
 * ================================================== */
function startShift() {
  lib.log('Starting shift');

  // Reset state
  gameState.phase = 'observing';
  gameState.elapsedTime = 0;
  gameState.suspicionLevel = 0;
  gameState.selectedMessageIndex = null;
  gameState.hasResponded = false;
  gameState.shiftStartTime = Date.now();
  gameState.lastFrameTime = performance.now();

  currentEventIndex = 0;
  censorBoxes.feedA = [];
  censorBoxes.feedB = [];
  shadowPosition = { x: 0, y: 0, visible: false };
  civilianState = { visible: false, distressed: false };

  // Clear UI
  elements.logContent.innerHTML = '';
  elements.communicationPanel.classList.add('hidden');
  elements.suspicionFill.style.width = '0%';
  elements.suspicionValue.textContent = '0%';
  elements.systemStatusText.textContent = 'ACTIVE';

  // Clear censorship layers
  elements.censorLayerA.innerHTML = '';
  elements.censorLayerB.innerHTML = '';

  // Add initial log entries
  addLogEntry('> 23:45:00 - Shift initiated');
  addLogEntry('> 23:45:01 - Feed A active');
  addLogEntry('> 23:45:01 - Feed B active');
  addLogEntry('> 23:45:02 - Monitoring commenced');

  // Build event timeline based on config
  buildEventTimeline();

  // Start ambient audio
  playAudio('ambient_surveillance_room', true, 0.3);

  // Start game loop
  gameState.animationFrameId = requestAnimationFrame(gameLoop);
}

function buildEventTimeline() {
  const duration = config.shiftDuration;

  eventTimeline = [
    // Event 1: First anomaly (shadow appears)
    {
      time: duration * 0.25, // 25% through shift
      triggered: false,
      execute: () => {
        addLogEntry('> ANOMALY DETECTED - Feed A', 'warning');
        shadowPosition.visible = true;
        shadowPosition.x = 50; // Far end of hallway
        shadowPosition.y = 120;

        // Apply censorship
        setTimeout(() => {
          addLogEntry('> CENSORSHIP APPLIED', 'warning');
          applyCensorshipToFeedA();
          playAudio('static_glitch_sfx', false, 0.5);
          triggerGlitchEffect();
        }, 500);

        // Play footsteps if audio cues enabled
        if (config.audioCues !== 'minimal') {
          setTimeout(() => {
            playAudio('distant_footsteps_sfx', false, config.audioCues === 'clear' ? 0.6 : 0.3);
          }, 2000);
        }
      },
    },

    // Event 2: Shadow moves closer
    {
      time: duration * 0.45, // 45% through shift
      triggered: false,
      execute: () => {
        shadowPosition.x = 150; // Closer
        updateCensorshipFeedA();
        playAudio('static_glitch_sfx', false, 0.4);
      },
    },

    // Event 3: Civilian appears, communication prompt
    {
      time: duration * 0.5, // 50% through shift
      triggered: false,
      execute: () => {
        addLogEntry('> CIVILIAN DETECTED - Feed B', 'warning');
        civilianState.visible = true;
        civilianState.distressed = false;

        setTimeout(() => {
          civilianState.distressed = true;
          addLogEntry('> COMMUNICATION REQUEST RECEIVED');
          showCommunicationPanel();
        }, 2000);
      },
    },

    // Event 4: Shadow at door (if no response yet)
    {
      time: duration * 0.7, // 70% through shift
      triggered: false,
      execute: () => {
        if (!gameState.hasResponded) {
          shadowPosition.x = 220; // At door 307
          updateCensorshipFeedA();
          addLogEntry('> ANOMALY PROXIMITY ALERT', 'warning');
          playAudio('static_glitch_sfx', false, 0.6);
          triggerGlitchEffect();
        }
      },
    },
  ];
}

function gameLoop(timestamp) {
  // Calculate delta time (capped at 100ms)
  const deltaTime = Math.min((timestamp - gameState.lastFrameTime) / 1000, 0.1);
  gameState.lastFrameTime = timestamp;

  if (gameState.phase === 'observing' || gameState.phase === 'communicating') {
    // Update elapsed time
    gameState.elapsedTime += deltaTime;

    // Update timestamps
    updateTimestamps();

    // Check for event triggers
    checkEventTriggers();

    // Render camera feeds
    renderCameraFeeds();

    // Check for shift completion
    if (gameState.elapsedTime >= config.shiftDuration && !gameState.hasResponded) {
      // Time ran out without response
      endShift(false, 'Time expired without response');
      return;
    }
  }

  // Continue loop
  gameState.animationFrameId = requestAnimationFrame(gameLoop);
}

function checkEventTriggers() {
  eventTimeline.forEach((event) => {
    if (!event.triggered && gameState.elapsedTime >= event.time) {
      event.triggered = true;
      event.execute();
    }
  });
}

function updateTimestamps() {
  const baseTime = 23 * 3600 + 45 * 60; // 23:45:00 in seconds
  const currentTime = baseTime + Math.floor(gameState.elapsedTime);

  const hours = Math.floor(currentTime / 3600) % 24;
  const minutes = Math.floor((currentTime % 3600) / 60);
  const seconds = currentTime % 60;

  const timeString =
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0');

  elements.timestampA.textContent = timeString;
  elements.timestampB.textContent = timeString;
}

/* ==================================================
 * RENDERING
 * ================================================== */
function renderCameraFeeds() {
  renderFeedA();
  renderFeedB();
}

function renderFeedA() {
  const canvas = elements.canvasA;
  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 240);

  // Draw hallway background
  const hallwayBg = assetCache.images['hallway_background'];
  if (hallwayBg && hallwayBg.complete) {
    ctx.drawImage(hallwayBg, 0, 0, 320, 240);
  } else {
    // Fallback: draw simple hallway
    ctx.fillStyle = '#1a1f1a';
    ctx.fillRect(0, 0, 320, 240);

    // Draw doors
    ctx.fillStyle = '#2a2f2a';
    ctx.fillRect(20, 100, 40, 80);
    ctx.fillRect(80, 100, 40, 80);
    ctx.fillRect(140, 100, 40, 80);
    ctx.fillRect(200, 100, 40, 80);
    ctx.fillRect(260, 100, 40, 80);
  }

  // Draw shadow if visible and not fully censored
  if (shadowPosition.visible) {
    const shadowImg = assetCache.images['shadow_silhouette'];
    if (shadowImg && shadowImg.complete) {
      ctx.globalAlpha = 0.8;
      ctx.drawImage(shadowImg, shadowPosition.x, shadowPosition.y, 60, 80);
      ctx.globalAlpha = 1.0;
    } else {
      // Fallback: draw simple shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(shadowPosition.x, shadowPosition.y, 40, 70);
    }
  }

  // Apply glitch effect based on intensity
  if (config.glitchIntensity > 0 && Math.random() < config.glitchIntensity / 1000) {
    applyCanvasGlitch(ctx, 320, 240);
  }
}

function renderFeedB() {
  const canvas = elements.canvasB;
  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 240);

  // Draw apartment background
  const apartmentBg = assetCache.images['apartment_interior_background'];
  if (apartmentBg && apartmentBg.complete) {
    ctx.drawImage(apartmentBg, 0, 0, 320, 240);
  } else {
    // Fallback: draw simple apartment
    ctx.fillStyle = '#2a2520';
    ctx.fillRect(0, 0, 320, 240);

    // Draw furniture outlines
    ctx.strokeStyle = '#4a4540';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 150, 80, 60); // Couch
    ctx.strokeRect(200, 100, 60, 40); // Desk
    ctx.strokeRect(20, 20, 60, 80); // Window
  }

  // Draw civilian if visible
  if (civilianState.visible) {
    const civilianImg = civilianState.distressed
      ? assetCache.images['civilian_character_distressed']
      : assetCache.images['civilian_character_neutral'];

    if (civilianImg && civilianImg.complete) {
      ctx.drawImage(civilianImg, 130, 100, 60, 80);
    } else {
      // Fallback: draw simple figure
      ctx.fillStyle = civilianState.distressed ? '#ff8800' : '#4a5859';
      ctx.fillRect(140, 120, 40, 60);
      ctx.beginPath();
      ctx.arc(160, 110, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Apply glitch effect based on intensity
  if (config.glitchIntensity > 0 && Math.random() < config.glitchIntensity / 1000) {
    applyCanvasGlitch(ctx, 320, 240);
  }
}

function applyCanvasGlitch(ctx, width, height) {
  // Apply glitch effect via CSS on the canvas container instead of pixel manipulation
  // This avoids cross-origin taint issues with CDN images
  const canvas = ctx.canvas;
  if (canvas && canvas.parentElement) {
    canvas.parentElement.classList.add('glitch-active');
    setTimeout(() => {
      canvas.parentElement.classList.remove('glitch-active');
    }, 100);
  }
}

/* ==================================================
 * CENSORSHIP EFFECTS
 * ================================================== */
function applyCensorshipToFeedA() {
  const layer = elements.censorLayerA;

  // Calculate censor box size based on intensity
  let boxWidth = 80;
  let boxHeight = 100;

  if (config.censorshipIntensity === 'minimal') {
    boxWidth = 60;
    boxHeight = 80;
  } else if (config.censorshipIntensity === 'heavy') {
    boxWidth = 120;
    boxHeight = 140;
  }

  // Create censor box
  const censorBox = document.createElement('div');
  censorBox.className = 'censor-box';
  censorBox.style.left = shadowPosition.x + 'px';
  censorBox.style.top = shadowPosition.y + 'px';
  censorBox.style.width = boxWidth + 'px';
  censorBox.style.height = boxHeight + 'px';

  layer.appendChild(censorBox);

  // Add static overlay if heavy censorship
  if (config.censorshipIntensity === 'heavy') {
    const staticOverlay = document.createElement('div');
    staticOverlay.className = 'static-overlay';
    staticOverlay.style.left = shadowPosition.x + 'px';
    staticOverlay.style.top = shadowPosition.y + 'px';
    staticOverlay.style.width = boxWidth + 'px';
    staticOverlay.style.height = boxHeight + 'px';
    layer.appendChild(staticOverlay);
  }

  censorBoxes.feedA.push(censorBox);
}

function updateCensorshipFeedA() {
  // Remove old censor boxes
  elements.censorLayerA.innerHTML = '';
  censorBoxes.feedA = [];

  // Reapply with new position
  applyCensorshipToFeedA();
}

/* ==================================================
 * COMMUNICATION SYSTEM
 * ================================================== */
function showCommunicationPanel() {
  gameState.phase = 'communicating';
  elements.communicationPanel.classList.remove('hidden');

  // Reset message selection
  const radioButtons = elements.messageOptions.querySelectorAll('input[type="radio"]');
  radioButtons.forEach((radio) => {
    radio.checked = false;
  });
  gameState.selectedMessageIndex = null;
  elements.sendMessageBtn.disabled = true;
}

function sendMessage() {
  if (gameState.selectedMessageIndex === null) return;

  gameState.hasResponded = true;
  gameState.phase = 'resolving';

  const selectedOption = messageOptions[gameState.selectedMessageIndex];

  // Play send sound
  playAudio('message_send_sfx', false, 0.6);

  // Add to log
  addLogEntry('> MESSAGE TRANSMITTED: ' + selectedOption.text);

  // Hide communication panel
  elements.communicationPanel.classList.add('hidden');

  // Calculate suspicion increase
  let suspicionIncrease = selectedOption.suspicionIncrease;

  // Apply AI sensitivity multiplier
  if (config.aiSensitivity === 'lenient') {
    suspicionIncrease *= 0.7;
  } else if (config.aiSensitivity === 'paranoid') {
    suspicionIncrease *= 1.5;
  }

  // Update suspicion
  if (suspicionIncrease > 0) {
    updateSuspicion(suspicionIncrease);
  }

  // Process consequences
  setTimeout(() => {
    processMessageConsequences(selectedOption);
  }, 1000);
}

function processMessageConsequences(option) {
  if (option.suspicionIncrease >= 50) {
    // Forbidden phrase used - immediate termination
    addLogEntry('> ALERT: FORBIDDEN LANGUAGE DETECTED', 'error');
    addLogEntry('> OPERATOR FLAGGED AS COMPROMISED', 'error');
    updateSuspicion(50);

    setTimeout(() => {
      endShift(false, 'AI SUSPICION CRITICAL - SESSION TERMINATED');
    }, 2000);
  } else if (option.correct) {
    // Correct message - civilian stays safe
    addLogEntry('> Civilian acknowledged instruction');
    addLogEntry('> Civilian remains in secure location');

    // Shadow retreats
    setTimeout(() => {
      addLogEntry('> Anomaly containment successful');
      shadowPosition.visible = false;
      elements.censorLayerA.innerHTML = '';

      // Wait for shift to complete
      const remainingTime = config.shiftDuration - gameState.elapsedTime;
      setTimeout(
        () => {
          endShift(true, 'SHIFT COMPLETE - ANOMALY CONTAINED');
        },
        Math.max(remainingTime * 1000, 2000)
      );
    }, 2000);
  } else {
    // Incorrect message - civilian endangered
    addLogEntry('> Civilian misinterpreted instruction', 'warning');
    addLogEntry('> Civilian approaching hallway', 'warning');

    setTimeout(() => {
      addLogEntry('> CRITICAL FAILURE - CIVILIAN CASUALTY', 'error');
      triggerGlitchEffect();
      playAudio('static_glitch_sfx', false, 0.8);

      setTimeout(() => {
        endShift(false, 'MISSION FAILED - CIVILIAN CASUALTY');
      }, 2000);
    }, 2000);
  }
}

/* ==================================================
 * SUSPICION SYSTEM
 * ================================================== */
function updateSuspicion(increase) {
  gameState.suspicionLevel = Math.min(100, gameState.suspicionLevel + increase);

  elements.suspicionFill.style.width = gameState.suspicionLevel + '%';
  elements.suspicionValue.textContent = Math.floor(gameState.suspicionLevel) + '%';

  if (increase > 0) {
    playAudio('suspicion_alert_sfx', false, 0.5);
    triggerGlitchEffect();
  }

  if (gameState.suspicionLevel >= 100) {
    addLogEntry('> AI SUSPICION CRITICAL', 'error');
    setTimeout(() => {
      endShift(false, 'AI SUSPICION CRITICAL - SESSION TERMINATED');
    }, 1000);
  }
}

/* ==================================================
 * GAME END
 * ================================================== */
function endShift(success, message) {
  gameState.phase = 'ended';

  // Stop game loop
  if (gameState.animationFrameId) {
    cancelAnimationFrame(gameState.animationFrameId);
  }

  // Stop all audio
  stopAllAudio();

  // Show end screen
  elements.endTitle.textContent = success ? 'SHIFT COMPLETE' : 'SHIFT TERMINATED';
  elements.endTitle.className = 'end-title ' + (success ? 'success' : 'failure');
  elements.endMessage.textContent = message;

  const minutes = Math.floor(gameState.elapsedTime / 60);
  const seconds = Math.floor(gameState.elapsedTime % 60);
  elements.endStats.innerHTML =
    'Time Elapsed: ' +
    minutes +
    'm ' +
    seconds +
    's<br>' +
    'Final Suspicion: ' +
    Math.floor(gameState.suspicionLevel) +
    '%';

  elements.endScreen.classList.remove('hidden');

  if (!success) {
    triggerGlitchEffect();
  }
}

/* ==================================================
 * AUDIO SYSTEM
 * ================================================== */
function playAudio(audioId, loop = false, volume = 1.0) {
  if (!audioContext || !assetCache.audioBuffers[audioId]) {
    return;
  }

  try {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = assetCache.audioBuffers[audioId];
    source.loop = loop;

    // Apply volume based on audio cues setting
    let finalVolume = volume;
    if (config.audioCues === 'minimal') {
      finalVolume *= 0.5;
    } else if (config.audioCues === 'distorted') {
      finalVolume *= 0.8;
    }

    gainNode.gain.value = finalVolume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start(0);

    // Store reference for looping sounds
    if (loop) {
      assetCache.audioSources[audioId] = { source, gainNode };
    }
  } catch (error) {
    lib.log('Error playing audio: ' + audioId + ' - ' + error);
  }
}

function stopAllAudio() {
  Object.keys(assetCache.audioSources).forEach((key) => {
    try {
      const { source } = assetCache.audioSources[key];
      source.stop();
    } catch (error) {
      // Ignore errors when stopping
    }
  });
  assetCache.audioSources = {};
}

/* ==================================================
 * VISUAL EFFECTS
 * ================================================== */
function triggerGlitchEffect() {
  elements.glitchOverlay.classList.add('active');
  setTimeout(() => {
    elements.glitchOverlay.classList.remove('active');
  }, 300);
}

/* ==================================================
 * UI HELPERS
 * ================================================== */
function addLogEntry(text, type = 'normal') {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  if (type === 'warning') entry.classList.add('warning');
  if (type === 'error') entry.classList.add('error');
  entry.textContent = text;

  elements.logContent.appendChild(entry);

  // Auto-scroll to bottom
  elements.logContent.scrollTop = elements.logContent.scrollHeight;

  // Limit log entries to prevent memory issues
  const entries = elements.logContent.querySelectorAll('.log-entry');
  if (entries.length > 20) {
    entries[0].remove();
  }
}

/* ==================================================
 * EXPORT
 * ================================================== */
if (typeof window !== 'undefined') {
  window.run = run;
}
