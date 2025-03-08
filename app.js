// Log function for debugging
function log(message) {
    const logContainer = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    console.log(message);
}

// Update status indicator
function updateStatus(active, message) {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    if (active) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
    
    text.textContent = message || (active ? 'Gesture recognition active' : 'Gesture recognition inactive');
}

// Initialize variables for MediaPipe
let gestureRecognizer = null;
let webcamRunning = false;
let lastVideoTime = -1;
let gestureResults = null;

// Gesture tracking variables
let currentGesture = null;
let gestureStartTime = 0;
let gestureHoldDuration = 0;
let requiredHoldTime = 1000; // 1 second hold time
let gestureInProgress = false;
let fullGestureTrackingEnabled = true; // Controls whether we track all gestures or just "Pointing Up"
let lastGestureExecutionTime = 0; // Time when the last gesture was executed
let gestureCooldownPeriod = 2000; // 2 second cooldown between gesture executions
let continuousActionActive = false; // Whether we're currently performing a continuous action
let lastContinuousActionTime = 0; // Last time a continuous action was performed
let continuousActionInterval = 200; // How often to repeat continuous actions (in ms)

// YouTube API setup
let player;
log("Loading YouTube API...");

// YouTube player initialization
function onYouTubeIframeAPIReady() {
    log("YouTube API ready");
    
    player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: 'dQw4w9WgXcQ', // Default video (Rick Roll)
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0,
            'fs': 1,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    log("YouTube player ready");
    
    // Set up button event listeners
    document.getElementById('load-button').addEventListener('click', loadVideo);
    document.getElementById('play-button').addEventListener('click', playVideo);
    document.getElementById('pause-button').addEventListener('click', pauseVideo);
    document.getElementById('stop-button').addEventListener('click', stopVideo);
    document.getElementById('gesture-toggle').addEventListener('click', startWebcamTracking);
    
    // Allow enter key to load video
    document.getElementById('video-id').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadVideo();
        }
    });
    
    // Initialize MediaPipe modules
    log("Checking MediaPipe module status...");
    
    if (window.mpVision) {
        log("MediaPipe modules already loaded, initializing gesture recognizer");
        setupGestureRecognizer();
    } else {
        log("MediaPipe not loaded yet, will attempt initialization");
        // Try to initialize MediaPipe
        window.initMediaPipe().then(success => {
            if (success) {
                log("MediaPipe initialized successfully, setting up gesture recognizer");
                setupGestureRecognizer();
            } else {
                log("ERROR: Failed to initialize MediaPipe. Try refreshing the page.");
            }
        });
    }
}

function onPlayerStateChange(event) {
    const states = {
        '-1': 'Unstarted',
        '0': 'Ended',
        '1': 'Playing',
        '2': 'Paused',
        '3': 'Buffering',
        '5': 'Video cued'
    };
    log(`Player state: ${states[event.data]}`);
}

function onPlayerError(event) {
    log(`Player error: ${event.data}`);
}

// Video control functions
function loadVideo() {
    const videoId = document.getElementById('video-id').value.trim();
    if (videoId) {
        player.loadVideoById(videoId);
        log(`Loading video: ${videoId}`);
    } else {
        log("No video ID provided");
    }
}

function playVideo() {
    player.playVideo();
    log("Video playing");
}

function pauseVideo() {
    player.pauseVideo();
    log("Video paused");
}

function stopVideo() {
    player.seekTo(0);
    player.pauseVideo();
    log("Video stopped");
}

function togglePlayPause() {
    const state = player.getPlayerState();
    if (state === 1) { // Playing
        pauseVideo();
    } else {
        playVideo();
    }
}

function increaseVolume() {
    const currentVolume = player.getVolume();
    const newVolume = Math.min(100, currentVolume + 10);
    player.setVolume(newVolume);
    log(`Volume up: ${newVolume}%`);
}

function decreaseVolume() {
    const currentVolume = player.getVolume();
    const newVolume = Math.max(0, currentVolume - 10);
    player.setVolume(newVolume);
    log(`Volume down: ${newVolume}%`);
}

function fastForward() {
    const currentTime = player.getCurrentTime();
    player.seekTo(currentTime + 10, true);
    log("Fast forward: +10s");
}

function rewind() {
    const currentTime = player.getCurrentTime();
    player.seekTo(Math.max(0, currentTime - 10), true);
    log("Rewind: -10s");
}

// Gesture recognition setup - using CDN-hosted model
async function setupGestureRecognizer() {
    try {
        log("Setting up MediaPipe Gesture Recognizer...");
        
        // Wait for MediaPipe to be available
        if (!window.mpVision) {
            log("MediaPipe not available yet, attempting to initialize...");
            const success = await window.initMediaPipe();
            if (!success) {
                log("Failed to initialize MediaPipe. Gesture recognition won't work.");
                return;
            }
        }
        
        log("MediaPipe loaded, creating GestureRecognizer...");
        
        try {
            // Log detailed MediaPipe availability information
            log(`MediaPipe object structure: ${Object.keys(window.mpVision).join(', ')}`);
            
            // Access the GestureRecognizer from the global MediaPipe object
            const { GestureRecognizer, FilesetResolver } = window.mpVision;
            
            if (!GestureRecognizer) {
                log("ERROR: GestureRecognizer not found in MediaPipe");
                return;
            }
            
            // Store reference for later use
            window.GestureRecognizer = GestureRecognizer;
            
            log("Loading vision tasks...");
            // Initialize the vision tasks
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            
            log("Vision tasks loaded, creating gesture recognizer...");
            
            // Create the gesture recognizer
            gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                    delegate: "GPU"
                },
                numHands: 1,
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
                runningMode: "VIDEO"
            });
            
            log("MODEL LOADED SUCCESSFULLY ✓");
        } catch (err) {
            log(`ERROR during GestureRecognizer initialization: ${err.message}`);
            console.error("GestureRecognizer error:", err);
        }
        
        log("Gesture recognizer created successfully");
        
        // Set up canvas
        const outputCanvas = document.getElementById('output-canvas');
        outputCanvas.width = 640;
        outputCanvas.height = 480;
        
    } catch (error) {
        log(`ERROR setting up MediaPipe: ${error.message}`);
        console.error(error);
    }
}

// Start webcam and gesture tracking - one-time startup function
function startWebcamTracking() {
    const gestureToggleButton = document.getElementById('gesture-toggle');
    
    if (webcamRunning) {
        log("Webcam is already running");
        return;
    }
    
    if (!gestureRecognizer) {
        log("Gesture recognizer not initialized yet. Trying to set up...");
        setupGestureRecognizer().then(() => {
            if (gestureRecognizer) {
                startWebcam();
                updateButtonState();
            } else {
                log("ERROR: Failed to initialize gesture recognizer");
            }
        });
    } else {
        startWebcam();
        updateButtonState();
    }
    
    function updateButtonState() {
        gestureToggleButton.textContent = "Gesture Control Active";
        gestureToggleButton.classList.remove('btn-primary');
        gestureToggleButton.classList.add('btn-success');
        gestureToggleButton.disabled = true; // Disable the button after activation
        updateStatus(true, "Use Pointing Up gesture to toggle tracking mode");
    }
}

// Start webcam and gesture recognition
function startWebcam() {
    const webcamElement = document.getElementById('webcam');
    const constraints = { 
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 }
        } 
    };
    
    log("Starting webcam...");
    
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
            webcamElement.srcObject = stream;
            webcamElement.addEventListener('loadeddata', () => {
                log("Webcam loaded data, starting prediction");
                webcamRunning = true;
                window.requestAnimationFrame(predictWebcam);
            });
        })
        .catch(function(error) {
            log(`ERROR accessing webcam: ${error.message}`);
        });
}

// Stop webcam
function stopWebcam() {
    const webcamElement = document.getElementById('webcam');
    
    if (webcamElement.srcObject) {
        webcamElement.srcObject.getTracks().forEach(track => track.stop());
        webcamElement.srcObject = null;
    }
    
    webcamRunning = false;
    resetGestureTracking();
    
    // Clear canvas
    const outputCanvas = document.getElementById('output-canvas');
    const ctx = outputCanvas.getContext('2d');
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    
    log("Webcam stopped");
}

// Reset gesture tracking state
function resetGestureTracking() {
    gestureInProgress = false;
    currentGesture = null;
    gestureStartTime = 0;
    gestureHoldDuration = 0;
}

// Process detected gestures
function processGesture(detectedGesture) {
    const now = Date.now();
    
    // If we're in continuous action mode, keep executing the action
    // as long as the same gesture is being held
    if (continuousActionActive) {
        if (detectedGesture === currentGesture) {
            // Same gesture still active, continue the action
            executeContinuousAction(currentGesture);
            return;
        } else {
            // Gesture changed, end continuous action
            log(`Continuous action ended: ${formatGestureName(currentGesture)}`);
            continuousActionActive = false;
            // Apply a shorter cooldown after continuous actions
            lastGestureExecutionTime = now;
        }
    }
    
    // Check if we're in cooldown period after executing a gesture
    if (now - lastGestureExecutionTime < gestureCooldownPeriod) {
        // Still in cooldown period, show status but don't process
        const remainingCooldown = Math.ceil((gestureCooldownPeriod - (now - lastGestureExecutionTime)) / 1000);
        updateStatus(true, `Cooldown: ${remainingCooldown}s remaining`);
        return;
    }
    
    // In limited tracking mode, ignore all gestures except Pointing Up
    if (!fullGestureTrackingEnabled && detectedGesture !== 'Pointing_Up') {
        // Still show what was detected but don't process it
        updateStatus(true, `Detected: ${formatGestureName(detectedGesture)} (tracking disabled)`);
        return;
    }
    
    // If this is a new gesture or different from the last one
    if (!gestureInProgress || currentGesture !== detectedGesture) {
        currentGesture = detectedGesture;
        gestureStartTime = now;
        gestureInProgress = true;
        updateStatus(true, `Detected: ${formatGestureName(detectedGesture)}`);
    } else {
        // Continue tracking current gesture
        gestureHoldDuration = now - gestureStartTime;
        
        // If gesture has been held long enough, execute action
        if (gestureHoldDuration >= requiredHoldTime) {
            executeGestureAction(currentGesture);
            if (!isContinuousActionGesture(currentGesture)) {
                // Only reset tracking for non-continuous gestures
                resetGestureTracking();
            }
        }
    }
}

// Check if a gesture supports continuous action
function isContinuousActionGesture(gesture) {
    return ['Thumb_Up', 'Thumb_Down', 'Open_Palm', 'Closed_Fist'].includes(gesture);
}

// Execute action based on gesture
function executeGestureAction(gesture) {
    const now = Date.now();
    
    log(`Executing gesture: ${formatGestureName(gesture)}`);
    
    // Flash status to show recognition
    updateStatus(true, `Executing: ${formatGestureName(gesture)}`);
    
    // Special case for Pointing Up - always handle this to toggle tracking mode
    if (gesture === 'Pointing_Up') {
        toggleGestureTrackingMode();
        return;
    }
    
    // Only execute other gestures if full tracking is enabled
    if (!fullGestureTrackingEnabled) {
        log("Gesture ignored - only looking for Pointing Up to re-enable tracking");
        return;
    }
    
    // Check if this is a continuous action gesture
    if (isContinuousActionGesture(gesture)) {
        // Start continuous action mode
        continuousActionActive = true;
        executeContinuousAction(gesture);
        return;
    }
    
    // For non-continuous gestures, use normal behavior
    // Map gestures to actions based on controls
    switch(gesture) {
        case 'Victory':
            togglePlayPause();
            break;
        default:
            log(`No action mapped for gesture: ${gesture}`);
    }
    
    // Start cooldown period for non-continuous gestures
    lastGestureExecutionTime = now;
    log(`Gesture cooldown started: ${gestureCooldownPeriod/1000} seconds`);
}

// Execute the continuous action for the current gesture
function executeContinuousAction(gesture) {
    const now = Date.now();
    
    // Only execute at the specified interval
    if (now - lastContinuousActionTime < continuousActionInterval) {
        return;
    }
    
    lastContinuousActionTime = now;
    
    // Execute the appropriate action based on gesture
    switch(gesture) {
        case 'Thumb_Up':
            fastForward();
            break;
        case 'Thumb_Down':
            rewind();
            break;
        case 'Open_Palm':
            increaseVolume();
            break;
        case 'Closed_Fist':
            decreaseVolume();
            break;
    }
}

// Toggle between full gesture tracking and only Pointing Up detection
function toggleGestureTrackingMode() {
    fullGestureTrackingEnabled = !fullGestureTrackingEnabled;
    
    if (fullGestureTrackingEnabled) {
        log("Full gesture tracking enabled - all gestures will be recognized");
        updateStatus(true, "Full gesture tracking ON");
    } else {
        log("Gesture tracking limited - only tracking 'Pointing Up' gesture");
        updateStatus(true, "Limited to Pointing Up only");
    }
}

// Format gesture name for display
function formatGestureName(gesture) {
    return gesture.replace('_', ' ');
}

// Simple utility to draw hand landmarks on canvas
function drawHandLandmarks(landmarks, ctx, canvas) {
    if (!landmarks || !ctx || !canvas) return;
    
    // Draw landmarks as simple red dots
    ctx.fillStyle = 'red';
    
    for (const landmark of landmarks) {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Connect landmarks with green lines (simplified)
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    
    // Connect fingers (basic connections)
    const fingerGroups = [
        [0, 1, 2, 3, 4],          // Thumb
        [0, 5, 6, 7, 8],          // Index finger
        [0, 9, 10, 11, 12],       // Middle finger
        [0, 13, 14, 15, 16],      // Ring finger
        [0, 17, 18, 19, 20]       // Pinky
    ];
    
    fingerGroups.forEach(group => {
        for (let i = 1; i < group.length; i++) {
            if (landmarks[group[i-1]] && landmarks[group[i]]) {
                ctx.beginPath();
                ctx.moveTo(
                    landmarks[group[i-1]].x * canvas.width,
                    landmarks[group[i-1]].y * canvas.height
                );
                ctx.lineTo(
                    landmarks[group[i]].x * canvas.width,
                    landmarks[group[i]].y * canvas.height
                );
                ctx.stroke();
            }
        }
    });
}

// Predict gestures from webcam
async function predictWebcam() {
    if (!webcamRunning) {
        return;
    }
    
    if (!gestureRecognizer) {
        // If recognizer isn't ready yet, try again in a moment
        log("Gesture recognizer not ready yet, waiting...");
        setTimeout(() => {
            window.requestAnimationFrame(predictWebcam);
        }, 500);
        return;
    }
    
    const webcamElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output-canvas');
    const canvasCtx = canvasElement.getContext('2d');
    
    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    try {
        // Make sure webcam is actually playing and has dimensions
        if (!webcamElement.videoWidth || !webcamElement.videoHeight) {
            log("Webcam not fully initialized yet, waiting...");
            window.requestAnimationFrame(predictWebcam);
            return;
        }
        
        // Process current frame
        const nowInMs = Date.now();
        
        if (webcamElement.currentTime !== lastVideoTime) {
            lastVideoTime = webcamElement.currentTime;
            try {
                gestureResults = gestureRecognizer.recognizeForVideo(webcamElement, nowInMs);
                
                if (gestureResults.gestures.length > 0) {
                    log(`Gesture detected: ${gestureResults.gestures[0][0].categoryName} (${(gestureResults.gestures[0][0].score * 100).toFixed(1)}%)`);
                }
            } catch (error) {
                log(`Error in gesture recognition: ${error.message}`);
                // Continue the loop even if there's an error
                window.requestAnimationFrame(predictWebcam);
                return;
            }
        }
        
        // Draw hand landmarks
        if (gestureResults && gestureResults.landmarks && gestureResults.landmarks.length > 0) {
            // Use our simplified drawing function
            for (const landmarks of gestureResults.landmarks) {
                drawHandLandmarks(landmarks, canvasCtx, canvasElement);
            }
        }
        
        // Process gestures
        if (gestureResults && gestureResults.gestures && gestureResults.gestures.length > 0) {
            const detectedGesture = gestureResults.gestures[0][0].categoryName;
            const confidenceScore = gestureResults.gestures[0][0].score;
            
            // Only process gestures that have a high confidence score to reduce false detections
            if (confidenceScore > 0.7) {
                processGesture(detectedGesture);
            } else {
                // Log low confidence gesture but don't process it
                log(`Low confidence gesture detected: ${detectedGesture} (${(confidenceScore * 100).toFixed(1)}%)`);
            }
        } else {
            // No gestures detected at all
            
            // If we were in continuous action mode but no gesture is detected,
            // end the continuous action
            if (continuousActionActive) {
                log(`Continuous action ended: ${formatGestureName(currentGesture)}`);
                continuousActionActive = false;
                // Apply a shorter cooldown after continuous actions
                lastGestureExecutionTime = Date.now();
            }
            
            if (gestureInProgress) {
                // If we were tracking a gesture but lost it, reset the tracking
                resetGestureTracking();
            }
            
            // Check if we're in cooldown period
            const now = Date.now();
            if (now - lastGestureExecutionTime < gestureCooldownPeriod) {
                const remainingCooldown = Math.ceil((gestureCooldownPeriod - (now - lastGestureExecutionTime)) / 1000);
                updateStatus(true, `Cooldown: ${remainingCooldown}s remaining`);
            } else {
                updateStatus(true, fullGestureTrackingEnabled ? 
                    "Waiting for gesture..." : 
                    "Limited mode - make Pointing Up gesture to enable full tracking");
            }
        }
    } catch (error) {
        log(`Error in gesture processing: ${error.message}`);
        console.error(error);
    }
    
    // Continue loop if webcam is running
    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}