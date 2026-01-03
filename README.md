# Hair Field

A GPU-accelerated interactive hair/tendril simulation with OSC output for audio-visual performance and sonification.


## Features

- **GPU-Accelerated Rendering**: WebGL2-based simulation with thousands of physics-driven hair strands
- **Touch/Mouse Interaction**: Push through the hair field with natural physics response
- **Real-time OSC Output**: Stream motion data for sonification via configurable grid resolution
- **Comprehensive Parameter Control**: All parameters controllable via UI, OSC, or Max API
- **Cross-Platform**: Runs in any modern browser, optimized for both desktop and iPad
- **Flexible Architecture**: Browser → WebSocket → Node.js → OSC pipeline works across network

## Quick Start

### Standalone (No OSC)
Just open `index.html` in a browser. Works offline, no server needed.

### With OSC Output

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

3. **Open in browser:**
   ```
   http://localhost:8080
   ```

4. **Receive OSC** on port 9000 (default) in Max/MSP, SuperCollider, etc.

## Network Setups

### Local (everything on one machine)
```bash
node server.js
# Browser: http://localhost:8080
# OSC sent to: 127.0.0.1:9000
```

### iPad Input → Computer receives OSC
```bash
# On the computer, find your IP (e.g., 192.168.1.100)
node server.js --osc-host 127.0.0.1 --osc-port 9000

# On iPad, open Safari:
# http://192.168.1.100:8080
```

### iPad Input → Different Computer receives OSC
```bash
# On server machine:
node server.js --osc-host 192.168.1.200 --osc-port 9000

# Where 192.168.1.200 is the OSC receiver's IP
```

### Architecture
```
┌─────────────┐    WebSocket     ┌─────────────┐     UDP/OSC      ┌─────────────┐
│   Browser   │─────────────────▶│   Node.js   │─────────────────▶│ OSC Receiver│
│ (iPad/Desktop)                 │   Server    │                  │ (Max/SC/etc)│
└─────────────┘   Port 8080      └─────────────┘    Port 9000     └─────────────┘
```

## Server Options

```bash
node server.js [options]

Options:
  --http-port <port>   HTTP/WebSocket server port (default: 8080)
  --osc-host <host>    OSC destination IP address (default: 127.0.0.1)
  --osc-port <port>    OSC destination port (default: 9000)
  --help               Show help message
```

## Parameters

All parameters can be controlled via the UI, and most via OSC/Max API input.

### Field Setup
| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `cameraTilt` | 0.1 - 1.5 | 1 | Camera angle (low = front view, high = top-down) |
| `cameraDistance` | 5 - 50 | 23 | Camera zoom level |
| `hairCount` | 256, 512, 1024, 2048, 4096 | 2048 | Number of hair strands (powers of 2) |
| `hairLength` | 0.5 - 8 | 5.6 | Length of each hair |
| `hairThickness` | 0.5 - 20 | 0.5 | Visual thickness of hairs |
| `segments` | 3 - 12 | 6 | Physics segments per hair |
| `gridPlacement` | on/off | off | Grid vs random hair placement |
| `fieldSize` | 5 - 30 | 15 | Size of the hair field |

### Physics
| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `stiffness` | 0.1 - 2 | 0.95 | Hair spring stiffness |
| `damping` | 0.8 - 0.99 | 0.88 | Motion damping (lower = more movement) |
| `gravity` | 0 - 1 | 0.1 | Downward gravity force |
| `windStrength` | 0 - 0.5 | 0.31 | Ambient wind force |
| `windSpeed` | 0.1 - 3 | 1.9 | Wind animation speed |

### Interaction
| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `showSphere` | on/off | off | Show metallic interaction sphere |
| `interactionStrength` | 0.5 - 10 | 2.4 | Push force strength |
| `interactionRadius` | 0.5 - 5 | 1.3 | Interaction area size |
| `interactionFalloff` | 0.5 - 3 | 1.3 | Force falloff curve |
| `impulseStrength` | 1 - 20 | 10.5 | Random impulse strength |

### Colors
| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `baseHue` | 0 - 360 | 91 | Base hair color hue (91 = green) |
| `hueRange` | 0 - 180 | 60 | Color variation range |
| `saturation` | 50 - 100 | 100 | Color saturation |
| `tipBrightness` | 0.5 - 2 | 1.4 | Brightness increase at tips |
| `glowIntensity` | 0 - 3 | 1 | Motion-based glow strength |
| `glowHue` | -1 - 360 | 326 | Glow color (-1 = auto/white, 326 = pink) |

### OSC Output
| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `oscEnabled` | on/off | on | Enable/disable all OSC output |
| `oscRate` | 10 - 60 | 30 | Output rate in Hz |
| `oscSummaryOnly` | on/off | off | Only send summary, not per-hair data |
| `oscGridEnabled` | on/off | on | Enable grid-aggregated output |
| `oscGridResX` | 2, 4, 8, 16, 32, 64 | 8 | Grid horizontal resolution |
| `oscGridResY` | 2, 4, 8, 16, 32, 64 | 8 | Grid vertical resolution |
| `oscAddress` | string | /hairfield | Base OSC address |

## OSC Output Messages

All messages are prefixed with your configured `oscAddress` (default: `/hairfield`).

### Summary (every frame)
```
/hairfield/summary <avgAmplitude> <maxAmplitude> <activity> <activeCount>
```
- `avgAmplitude`: Average displacement of all hairs (float)
- `maxAmplitude`: Maximum displacement (float)  
- `activity`: Ratio of active hairs 0-1 (float)
- `activeCount`: Number of hairs currently moving (int)

### Grid Data (every frame, if enabled)
```
/hairfield/grid/amplitude <resX> <resY> <value0> <value1> ... <valueN>
/hairfield/grid/phase <resX> <resY> <value0> <value1> ... <valueN>
/hairfield/grid/angle <resX> <resY> <value0> <value1> ... <valueN>
/hairfield/grid/count <resX> <resY> <value0> <value1> ... <valueN>
```
Grid data is row-major order (left-to-right, top-to-bottom). For an 8×8 grid, you get 64 values.

- `amplitude`: Average motion magnitude per cell
- `phase`: Average oscillation phase (0-1) per cell
- `angle`: Average bend direction (radians) per cell
- `count`: Number of hairs in each cell

### Per-Hair Data (if not summary-only mode)
```
/hairfield/amplitudes <startIndex> <value0> <value1> ... <valueN>
/hairfield/phases <startIndex> <value0> <value1> ... <valueN>
/hairfield/angles <startIndex> <value0> <value1> ... <valueN>
```
Chunked in groups of 128 for OSC packet size limits.

### Events
```
/hairfield/impulse <strength>
/hairfield/regenerated <hairCount>
/hairfield/reset
```

### Parameter Changes
```
/hairfield/param/<paramName> <value>
```

## OSC/Max API Input

When running in Max/MSP (via jweb), all parameters can be controlled via messages:

### Generic Setter
```
setParam <paramName> <value>
```

### Direct Parameter Messages
```
cameraTilt 1.0
cameraDistance 25
hairCount 1024
baseHue 180
glowHue 60
... (any parameter name)
```

### Actions
```
regenerate          # Rebuild the hair field
reset               # Reset all hairs to rest position
impulse             # Apply random impulse (uses impulseStrength)
impulse 2.0         # Apply impulse with multiplier
getParams           # Request all current parameter values
getParam <name>     # Request single parameter value
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `H` | Toggle UI visibility |

## Tips for Sonification

### FFT Mapping
Hair count and grid resolution are all powers of 2, making it easy to map to FFT bins:
- 1024 hairs → 1024-bin FFT
- 32×32 grid = 1024 values
- 64×64 grid = 4096 values

### Recommended Grid Sizes
| Use Case | Grid Size | Values |
|----------|-----------|--------|
| Simple stereo panning | 2×1 | 2 |
| Quadraphonic | 2×2 | 4 |
| Spectral mapping | 1×64 | 64 |
| Spatial grid | 8×8 | 64 |
| High-res FFT | 32×32 | 1024 |

### Example Max/MSP Setup
1. Create `udpreceive 9000`
2. Route messages by address using `route /hairfield/summary /hairfield/grid/amplitude`
3. Unpack values: `unpack f f f i` for summary

### Example SuperCollider Setup
```supercollider
OSCdef(\hairfield, { |msg|
    msg.postln;
}, '/hairfield/summary');
```

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari (macOS/iOS)**: Full support
- **Mobile browsers**: Touch interaction supported

Requires WebGL2 support.

## Files

```
hair-field/
├── index.html      # Main application (standalone capable)
├── server.js       # Node.js WebSocket→OSC bridge server
├── package.json    # Node.js dependencies
└── README.md       # This file
```

## License

MIT

## Credits

Built with WebGL2, vanilla JavaScript, and love for generative audio-visual performance.
