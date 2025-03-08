# Gesture Tube: Control YouTube with Hand Gestures

A modern web application that lets you control a YouTube video player using hand gestures captured through your webcam.

## Introduction

This project demonstrates how modern web technologies can be combined with computer vision to create intuitive human-computer interfaces. It leverages several key technologies:

- **MediaPipe**: Google's machine learning solution for hand gesture recognition
- **YouTube API**: For controlling video playback
- **HTML/CSS/JavaScript**: The foundation for our web application

## System Architecture

The application follows a classic front-end architecture with these main components:

- **Video Input**: Webcam feed processed by MediaPipe
- **Gesture Recognition**: MediaPipe machine learning models
- **Video Output**: YouTube player controlled via its JavaScript API
- **UI Components**: Status indicators, debug log, gesture guide

The data flow works like this:
1. Webcam captures video frames
2. MediaPipe processes frames to detect hand landmarks
3. Our JavaScript code interprets landmarks to recognize gestures
4. Recognized gestures trigger YouTube API commands
5. YouTube player responds to commands
6. UI updates to reflect the current state

## Gesture Controls

| Gesture | Action |
|---------|--------|
| ☝️ Pointing Up | Toggle full gesture tracking on/off |
| ✌️ Victory | Play/Pause video |
| 👍 Thumb Up | Fast Forward (hold for continuous) |
| 👎 Thumb Down | Rewind (hold for continuous) |
| 🖐 Open Palm | Increase Volume (hold for continuous) |
| ✊ Closed Fist | Decrease Volume (hold for continuous) |

## Features

The gesture recognition system includes several sophisticated features:

1. **Gesture Hold Detection**: Gestures must be held for 1 second to trigger actions, preventing accidental triggers
2. **Cooldown Period**: A 2-second cooldown between gesture actions to prevent rapid-fire triggers
3. **Continuous Actions**: Gestures like volume control can be held for continuous adjustment
4. **Limited Tracking Mode**: A special mode where only the "Pointing Up" gesture is recognized, acting as a toggle for full gesture recognition
5. **Visual Feedback**: Multiple indicators help users understand what the system is detecting:
   - Hand landmarks drawn on the webcam overlay
   - Status text updates showing detected gestures
   - Visual indicator that pulses when recognition is active
   - Debug log showing detailed system events

## Technical Implementation

### MediaPipe Integration

The application uses MediaPipe's Gesture Recognizer, which:
- Uses the GPU for acceleration when available
- Is configured to detect a single hand
- Runs in "VIDEO" mode, optimized for frame-by-frame processing
- Recognizes several predefined gestures (None, Closed_Fist, Open_Palm, Pointing_Up, Thumb_Down, Thumb_Up, Victory, ILoveYou)

```javascript
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
```

### Gesture Processing Pipeline

The system processes webcam frames in a continuous loop:
1. Checks if the video time has changed to avoid redundant processing
2. Sends the current frame to MediaPipe for gesture recognition
3. Draws the detected hand landmarks on the canvas overlay
4. Processes any detected gestures if they meet the confidence threshold (>0.7)

### Performance Optimizations

To ensure smooth performance:
- Only processes frames when the video time has changed
- Uses `requestAnimationFrame()` for efficient animation loop
- Implements confidence thresholds to filter out uncertain detections
- Controls rate of continuous actions with timing intervals

## UI Design

The application uses a clean, modern UI with a dark theme:

- **Responsive Two-Column Layout**: Adapts to different screen sizes using CSS Grid
- **Mirrored Webcam Feed**: Creates a natural "mirror" experience with CSS transforms
- **Visual Feedback**: Animated status indicators show when gesture recognition is active
- **Card-Based Components**: Consistent styling across different sections

## Installation and Usage

1. Clone the repository
2. Open `index.html` in a modern web browser
3. Allow camera access when prompted
4. Click "Start Gesture Control" to enable gesture recognition
5. Enter a YouTube video ID or use the default video
6. Use the gestures shown in the guide panel to control playback

## Future Extensions

This architecture could be extended to:
- Support additional or custom gestures
- Integrate with other web APIs
- Add custom gesture training
- Improve gesture recognition with personalized calibration

## Requirements

- Modern web browser with WebRTC support
- Webcam
- JavaScript enabled
- Internet connection (to load MediaPipe models and YouTube videos)