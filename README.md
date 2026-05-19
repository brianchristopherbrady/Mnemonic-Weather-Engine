# Mnemonic Weather Engine

A demonstrable AI art experiment that turns a text prompt into a living 3D weather system of ideas. Concepts become glowing bodies, relationships become arcs, tensions create hot fronts, and the whole thing can be remixed locally or generated with an OpenAI-compatible API key.

Open [index.html](index.html) in a modern browser. It uses Three.js from a CDN import map, so there is no install step.

## Demo Flow

1. Type or keep the prompt in the left panel.
2. Choose a mode: Map, Tensions, Ritual, or Strategy.
3. Click `Generate weather`.
4. Without an API key, the built-in demo map is remixed locally.
5. With an API key, the model returns structured JSON that drives the scene.

## AI Key

Use the `AI key` button in the app to save local settings:

- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4o-mini`, or another chat-completions model
- API key: your provider key

This browser-only prototype stores the key in `localStorage`. Production should proxy AI calls through a server.

## Controls

- Drag to orbit.
- Scroll or pinch to zoom.
- Hover or click glowing concepts to inspect them.
- `Export JSON` downloads the current semantic map.
- `Capture PNG` saves the current canvas image.
