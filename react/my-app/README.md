# MMSS - Modular Motion Sound System

A sophisticated React-based modular synthesizer and visual performance system that combines generative audio synthesis, dynamic visual rendering, and interactive controls for creating immersive multimedia experiences.

## Overview

MMSS (Modular Motion Sound System) is an advanced web-based application that integrates multiple systems for real-time audio-visual performance. The system features a matrix-based sequencer, orbital motion controls, image analysis, and natural language intent processing to create evolving soundscapes and visuals.

## Key Features

### 🎵 Audio Engine
- **Web Audio API Integration**: Real-time synthesis using oscillators, modulation, and effects
- **Matrix Sequencer**: 24x12 grid for pattern-based music composition
- **Dynamic Voice Generation**: Multi-oscillator voices with frequency modulation
- **Real-time Transport**: Precise timing and tempo control

### 🎨 Visual System
- **Canvas Rendering**: High-performance visual effects with gradient backgrounds
- **Audio Visualization**: Real-time oscilloscope and waveform display
- **Orbital Animation**: Smooth state transitions between different visual configurations
- **Theme System**: Dynamic color palettes and visual parameters

### 🎛️ Control Systems
- **Matrix Editor**: Interactive pattern creation and editing
- **Orbital Motion**: Automated parameter interpolation and collision-based randomization
- **Image Analysis**: Computer vision for extracting audio parameters from images
- **Text Intent Processing**: Natural language commands for system control

### 🔄 State Management
- **Progressive Levels**: System evolves through L0-L4 complexity levels
- **Checkpoint System**: State persistence and progression tracking
- **Reducer Architecture**: Centralized state management with React hooks

## Architecture

The application is structured around 8 interconnected systems:

### 1. Initialization System
- React app bootstrapping
- Audio context setup
- Core system launch and initialization

### 2. State Management
- Central `mmssReducer` for all state mutations
- Progressive level system with checkpoints
- Transport state and audio parameter management

### 3. Audio Engine (`useAudioEngine`)
- Web Audio API context management
- Transport loop with precise timing
- Voice triggering and note scheduling
- Oscillator creation with modulation chains

### 4. Visual Rendering (`StageCanvas`)
- Dual-canvas system (stage + scope)
- Gradient backgrounds and ring animations
- Real-time audio waveform visualization
- Theme-based color management

### 5. Matrix Editor
- Interactive 24x12 grid for pattern creation
- Touch and mouse support
- Real-time playhead visualization
- Cell painting and erasing modes

### 6. Orbital Motion (`useOrbitMotion`)
- Automated parameter interpolation
- Collision detection and randomization
- Multi-state blending with easing functions
- Audio and vision parameter mixing

### 7. Image Analysis
- File upload and processing
- Canvas-based image data extraction
- Contrast, edge density, and symmetry calculation
- Parameter mapping to audio controls

### 8. Intent Processing
- Natural language command parsing
- Scene switching via keywords
- Audio parameter adjustment
- Preset configurations

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd my-app

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:3000`.

## Usage

### Getting Started
1. Launch the application - the system initializes automatically
2. The audio engine starts when you first interact with controls
3. Use the matrix editor to create patterns
4. Experiment with orbital motion for automated evolution

### Controls

#### Transport
- **Play/Pause**: Toggle playback of the sequence
- **BPM**: Adjust tempo (affects timing of all operations)

#### Matrix Editor
- **Click/Drag**: Paint or erase cells in the 24x12 grid
- **Colors**: Each row represents a different pitch/note
- **Playhead**: Visual indicator of current sequence position

#### Orbital Motion
- **Enable/Disable**: Toggle automated parameter interpolation
- **Speed**: Control rate of orbital movement
- **Collision**: Random parameter changes on state boundaries

#### Image Analysis
- **Upload Image**: Drag and drop or select image files
- **Auto-Analysis**: Extracts contrast, edges, and symmetry
- **Parameter Mapping**: Translates visual metrics to audio controls

#### Text Intent
- **Input Text**: Natural language commands like "glass orbit", "aurora gate"
- **Scene Switching**: Keywords trigger preset configurations
- **Parameter Adjustment**: Words like "calm", "intense" modify settings

### Keyboard Shortcuts
- Space: Play/Pause transport
- Mouse wheel: Adjust parameters (context-dependent)

## Technical Details

### Audio Architecture
- **Sample Rate**: Browser-dependent (typically 44.1kHz)
- **Voice Structure**: Primary oscillator + secondary oscillator + modulation
- **Effects Chain**: Gain staging with Web Audio nodes
- **Timing**: High-precision scheduling with `setTimeout` loops

### Visual Performance
- **Frame Rate**: 60fps target with `requestAnimationFrame`
- **Canvas Resolution**: Dynamic scaling to container size
- **Color Depth**: 32-bit RGBA for smooth gradients
- **Memory Management**: Efficient buffer reuse and cleanup

### State Persistence
- **Local State**: React useReducer with immutable updates
- **Level Progression**: Checkpoint-based advancement system
- **Parameter Ranges**: Clamped values for stable operation

## Browser Compatibility

- **Chrome/Edge**: Full support with Web Audio API
- **Firefox**: Supported with minor timing differences
- **Safari**: Limited support (Web Audio API quirks)
- **Mobile**: Touch-optimized interface

## Development

### Project Structure
```
src/
├── App.js                 # Main application component
├── index.js              # React entry point
├── components/
│   ├── MatrixEditor.jsx  # Pattern grid interface
│   └── StageCanvas.jsx   # Visual rendering
├── mmss/
│   ├── reducer.js        # State management
│   ├── useAudioEngine.js # Audio synthesis hook
│   ├── useOrbitMotion.js # Animation system
│   └── utils.js          # Helper functions
└── styles/
    └── App.css           # Component styling
```

### Building for Production

```bash
npm run build
```

Builds the app for production to the `build` folder.

### Testing

```bash
npm test
```

Launches the test runner in interactive watch mode.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

Built with React, Web Audio API, and Canvas 2D API. Inspired by modular synthesis concepts and generative art principles.
