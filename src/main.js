import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const canvas = document.querySelector("#weather-canvas");
const seedInput = document.querySelector("#seed-input");
const generateBtn = document.querySelector("#generate-btn");
const demoBtn = document.querySelector("#demo-btn");
const exportBtn = document.querySelector("#export-btn");
const captureBtn = document.querySelector("#capture-btn");
const settingsDetails = document.querySelector("#settings-details");
const settingsForm = document.querySelector("#settings-form");
const saveSettings = document.querySelector("#save-settings");
const apiKeyInput = document.querySelector("#api-key");
const baseUrlInput = document.querySelector("#base-url");
const modelInput = document.querySelector("#model-name");
const keyState = document.querySelector("#key-state");
const settingsStatus = document.querySelector("#settings-status");
const statusLine = document.querySelector("#status-line");
const runStatus = document.querySelector("#run-status");
const conceptCount = document.querySelector("#concept-count");
const linkCount = document.querySelector("#link-count");
const tensionCount = document.querySelector("#tension-count");
const detailTitle = document.querySelector("#detail-title");
const detailBody = document.querySelector("#detail-body");
const tagRow = document.querySelector("#tag-row");
const toast = document.querySelector("#toast");

const colors = {
  hot: 0xff4d2d,
  green: 0x7cffb2,
  cyan: 0x55d8ff,
  gold: 0xffd36b,
  violet: 0xb38cff,
  ink: 0xf6f4ea
};

const demoMap = {
  title: "The City of Forgotten Weather",
  summary: "A memory-city where unattended ideas condense into meteorology and citizens navigate by pressure, glow, and recurring emotional fronts.",
  concepts: [
    { id: "c1", label: "Forgotten Ideas", kind: "pressure", weight: 0.92, mood: "dense", note: "Abandoned plans, old names, and unused inventions condense into the city's atmosphere.", tags: ["memory", "archive", "fog"] },
    { id: "c2", label: "Emotional Navigation", kind: "tool", weight: 0.78, mood: "useful", note: "People steer by inner climate instead of streets, treating mood as a live compass.", tags: ["utility", "orientation"] },
    { id: "c3", label: "Civic Forecasts", kind: "institution", weight: 0.66, mood: "ritual", note: "Public forecasts predict which neighborhoods will remember, mourn, or invent next.", tags: ["city", "forecast"] },
    { id: "c4", label: "Contradiction Lightning", kind: "tension", weight: 0.88, mood: "volatile", note: "Conflicting desires ionize the sky and reveal hidden dependencies in bright fractures.", tags: ["conflict", "signal"] },
    { id: "c5", label: "Thermal Opportunity", kind: "opportunity", weight: 0.74, mood: "rising", note: "Useful ideas rise as warm columns that can be followed before they dissipate.", tags: ["prototype", "momentum"] },
    { id: "c6", label: "Archive Rain", kind: "memory", weight: 0.62, mood: "tender", note: "Old scraps return as rain, temporarily making the city easier to read.", tags: ["recall", "weather"] },
    { id: "c7", label: "Blackout District", kind: "risk", weight: 0.7, mood: "quiet", note: "A zone where over-optimization erases ambiguity and the map loses its magic.", tags: ["risk", "loss"] }
  ],
  relationships: [
    { from: "c1", to: "c2", kind: "feeds", strength: 0.86 },
    { from: "c1", to: "c6", kind: "condenses", strength: 0.72 },
    { from: "c2", to: "c3", kind: "scales", strength: 0.58 },
    { from: "c4", to: "c5", kind: "reveals", strength: 0.82 },
    { from: "c3", to: "c7", kind: "risks", strength: 0.52 },
    { from: "c6", to: "c5", kind: "nourishes", strength: 0.64 },
    { from: "c4", to: "c7", kind: "strikes", strength: 0.9 }
  ],
  tensions: [
    { id: "t1", label: "Useful vs uncanny", note: "The system must help without making the mystery sterile.", concepts: ["c2", "c7"] },
    { id: "t2", label: "Memory vs invention", note: "Every recovered idea changes what can be invented next.", concepts: ["c1", "c5"] }
  ],
  questions: ["What should the city forget on purpose?", "Can a forecast be a design tool?", "Which emotions deserve infrastructure?"],
  motionProfile: { turbulence: 0.78, pulse: 0.68, drift: 0.44, bloom: 1.2 }
};

const state = {
  map: null,
  mode: "map",
  nodes: [],
  arcs: [],
  fronts: [],
  hovered: null,
  selected: null,
  generation: 0,
  pointer: new THREE.Vector2(99, 99),
  raycaster: new THREE.Raycaster(),
  targetLookAt: new THREE.Vector3(),
  currentLookAt: new THREE.Vector3(),
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  generating: false
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050707);
scene.fog = new THREE.FogExp2(0x050707, 0.028);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 9, 23);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 7;
controls.maxDistance = 58;
controls.autoRotate = !state.reducedMotion;
controls.autoRotateSpeed = 0.35;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.12, 0.65, 0.12);
composer.addPass(bloom);

const root = new THREE.Group();
scene.add(root);
scene.add(new THREE.HemisphereLight(0xbffff0, 0xff4d2d, 1.25));
addPointLight(colors.green, -9, 11, 8, 42);
addPointLight(colors.hot, 12, -4, -16, 36);
const starField = createStarField();
scene.add(starField);

function addPointLight(color, x, y, z, intensity) {
  const light = new THREE.PointLight(color, intensity, 90);
  light.position.set(x, y, z);
  scene.add(light);
}

function clamp(value, fallback, max) {
  return Number.isFinite(value) ? Math.max(0.05, Math.min(max, value)) : fallback;
}

function createStarField() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const vertexColors = new Float32Array(count * 3);
  const choices = [colors.green, colors.cyan, colors.gold, colors.hot, colors.ink].map((color) => new THREE.Color(color));

  for (let index = 0; index < count; index += 1) {
    const radius = 24 + Math.random() * 62;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi) * 0.55;
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = choices[Math.floor(Math.random() * choices.length)];
    vertexColors[index * 3] = color.r;
    vertexColors[index * 3 + 1] = color.g;
    vertexColors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
}

function textSprite(text, color) {
  const labelCanvas = document.createElement("canvas");
  const context = labelCanvas.getContext("2d");
  context.font = "800 42px Inter, system-ui, sans-serif";
  const width = Math.min(720, Math.max(256, Math.ceil(context.measureText(text).width + 54)));
  labelCanvas.width = width;
  labelCanvas.height = 104;
  context.font = "800 42px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(0, 0, 0, 0.28)";
  context.fillRect(0, 0, width, 104);
  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.strokeRect(1, 1, width - 2, 102);
  context.fillStyle = color;
  context.fillText(text.slice(0, 34), width / 2, 54);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(width / 120, 104 / 120, 1);
  return sprite;
}

function normalizeMap(map) {
  const concepts = Array.isArray(map?.concepts) ? map.concepts.slice(0, 12) : demoMap.concepts;
  const safeConcepts = concepts.map((concept, index) => ({
    id: String(concept.id || `c${index + 1}`),
    label: String(concept.label || `Concept ${index + 1}`),
    kind: String(concept.kind || "concept"),
    weight: clamp(Number(concept.weight), 0.45 + Math.random() * 0.4, 1),
    mood: String(concept.mood || "charged"),
    note: String(concept.note || "A generated pressure body in the semantic atmosphere."),
    tags: Array.isArray(concept.tags) ? concept.tags.slice(0, 5).map(String) : []
  }));
  const ids = new Set(safeConcepts.map((concept) => concept.id));
  const relationships = Array.isArray(map?.relationships) ? map.relationships : [];

  return {
    title: String(map?.title || "Generated Weather"),
    summary: String(map?.summary || "A generated field of meaning."),
    concepts: safeConcepts,
    relationships: relationships
      .filter((link) => ids.has(String(link.from)) && ids.has(String(link.to)))
      .slice(0, 18)
      .map((link) => ({ from: String(link.from), to: String(link.to), kind: String(link.kind || "relates"), strength: clamp(Number(link.strength), 0.35, 1) })),
    tensions: Array.isArray(map?.tensions) ? map.tensions.slice(0, 5) : [],
    questions: Array.isArray(map?.questions) ? map.questions.slice(0, 6).map(String) : [],
    motionProfile: {
      turbulence: clamp(Number(map?.motionProfile?.turbulence), 0.55, 1),
      pulse: clamp(Number(map?.motionProfile?.pulse), 0.55, 1),
      drift: clamp(Number(map?.motionProfile?.drift), 0.4, 1),
      bloom: clamp(Number(map?.motionProfile?.bloom), 1, 1.45)
    }
  };
}

function conceptPosition(index, total, weight) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (index / Math.max(1, total - 1)) * 2;
  const radius = Math.sqrt(1 - y * y) * (8 + weight * 2.8);
  const theta = golden * index;
  return new THREE.Vector3(Math.cos(theta) * radius, y * 7.2, Math.sin(theta) * radius);
}

function conceptColor(kind, mood) {
  const merged = `${kind} ${mood}`.toLowerCase();
  if (merged.includes("tension") || merged.includes("risk") || merged.includes("volatile")) return colors.hot;
  if (merged.includes("opportunity") || merged.includes("rising")) return colors.gold;
  if (merged.includes("tool") || merged.includes("useful")) return colors.green;
  if (merged.includes("memory") || merged.includes("tender")) return colors.cyan;
  return colors.violet;
}

function clearRoot() {
  while (root.children.length) {
    const child = root.children.pop();
    child.traverse?.((node) => {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose?.());
      else node.material?.dispose?.();
    });
  }
  state.nodes = [];
  state.arcs = [];
  state.fronts = [];
}

function buildMap(map) {
  clearRoot();
  state.map = normalizeMap(map);
  state.selected = null;
  state.hovered = null;
  statusLine.textContent = state.map.title;
  runStatus.textContent = `Showing ${state.map.title}. ${state.map.concepts.length} concepts, ${state.map.relationships.length} links.`;
  conceptCount.textContent = state.map.concepts.length;
  linkCount.textContent = state.map.relationships.length;
  tensionCount.textContent = state.map.tensions.length;
  bloom.strength = 0.8 + state.map.motionProfile.bloom * 0.55;
  updateInspector(null);
  const positions = new Map();

  state.map.concepts.forEach((concept, index) => {
    const weight = clamp(concept.weight, 0.45, 1);
    const position = conceptPosition(index, state.map.concepts.length, weight);
    const color = conceptColor(concept.kind, concept.mood);
    const group = new THREE.Group();
    group.position.copy(position);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34 + weight * 0.62, 3), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.25, roughness: 0.28, metalness: 0.24 }));
    core.userData = { concept };
    group.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9 + weight * 1.4, 32, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(halo);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02 + weight * 1.1, 0.012 + weight * 0.014, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending }));
    ring.rotation.x = Math.PI * 0.5 + index * 0.22;
    ring.rotation.y = index * 0.37;
    group.add(ring);
    const label = textSprite(concept.label, `#${new THREE.Color(color).getHexString()}`);
    label.position.set(0, 1.6 + weight * 1.5, 0);
    group.add(label);
    root.add(group);
    state.nodes.push({ group, core, halo, ring, label, concept, base: position.clone(), weight });
    positions.set(concept.id, position);
  });

  state.map.relationships.forEach((link) => {
    const start = positions.get(link.from);
    const end = positions.get(link.to);
    if (start && end) createArc(start, end, link);
  });

  const frontCount = Math.max(4, Math.min(10, state.map.concepts.length + state.map.tensions.length));
  for (let index = 0; index < frontCount; index += 1) createFront(index, frontCount);
}

function createArc(start, end, link) {
  const mid = start.clone().add(end).multiplyScalar(0.5);
  mid.y += 2.5 + link.strength * 5;
  const geometry = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(80));
  const color = link.kind.toLowerCase().includes("strike") || link.kind.toLowerCase().includes("risk") ? colors.hot : colors.cyan;
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 + link.strength * 0.35, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Line(geometry, material);
  root.add(mesh);
  state.arcs.push({ mesh, material, link, phase: Math.random() * Math.PI * 2 });
}

function createFront(index, total) {
  const choices = [colors.hot, colors.green, colors.cyan, colors.gold, colors.violet];
  const material = new THREE.MeshBasicMaterial({ color: choices[index % choices.length], transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(4.8 + index * 1.18, 0.016 + (index % 3) * 0.011, 8, 180), material);
  mesh.rotation.x = Math.PI * 0.5 + index * 0.23;
  mesh.rotation.y = index * 0.41;
  mesh.rotation.z = index * 0.17;
  mesh.position.y = THREE.MathUtils.mapLinear(index, 0, total - 1, -3.8, 3.8);
  root.add(mesh);
  state.fronts.push({ mesh, material, phase: Math.random() * 10, speed: 0.08 + Math.random() * 0.18 });
}

function updateInspector(concept) {
  tagRow.innerHTML = "";
  if (!concept) {
    detailTitle.textContent = "Hover a glowing concept";
    detailBody.textContent = "Drag to orbit, scroll to zoom, and click a concept to focus it.";
    return;
  }
  detailTitle.textContent = concept.label;
  detailBody.textContent = concept.note || state.map.summary;
  [...(concept.tags || []), concept.kind, concept.mood].filter(Boolean).slice(0, 7).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tagRow.appendChild(chip);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
}

function loadAiConfig() {
  return {
    apiKey: localStorage.getItem("mwe.apiKey") || window.MWE_TEMP_API_KEY || "",
    baseUrl: localStorage.getItem("mwe.baseUrl") || window.MWE_TEMP_BASE_URL || "https://api.openai.com/v1",
    model: localStorage.getItem("mwe.model") || window.MWE_TEMP_MODEL || "gpt-4o-mini"
  };
}

function updateSettingsStatus(message, keyLabel) {
  const hasKey = Boolean(apiKeyInput.value.trim());
  keyState.textContent = keyLabel || (hasKey ? "Key saved" : "No key saved");
  settingsStatus.textContent = message || (hasKey ? "Key saved locally. Generate will call the configured AI endpoint." : "No key saved yet. Generate will use the demo remix.");
}

function promptFor(seed, mode) {
  return [
    "Return strict JSON only for a 3D semantic weather map.",
    "Shape: {title, summary, concepts, relationships, tensions, questions, motionProfile}.",
    "Each concept: {id,label,kind,weight,mood,note,tags}. Use 6 to 10 concepts. ids are c1, c2, etc. weight is 0.05 to 1.",
    "Each relationship: {from,to,kind,strength}. strength is 0.05 to 1 and ids must exist.",
    "motionProfile: {turbulence,pulse,drift,bloom}, numbers from 0.05 to 1.5.",
    "Make the map visually strange, useful, coherent, and rich in tensions.",
    `Mode: ${mode}`,
    `Seed: ${seed}`
  ].join("\n");
}

function apiErrorMessage(rawMessage, status) {
  try {
    const parsed = JSON.parse(rawMessage);
    const code = parsed?.error?.code || parsed?.error?.type;
    if (status === 401 || code === "invalid_api_key") return "The saved API key was rejected by OpenAI. Check or replace the key.";
    return parsed?.error?.message || `AI request failed with status ${status}.`;
  } catch {
    return status === 401 ? "The saved API key was rejected by OpenAI. Check or replace the key." : `AI request failed with status ${status}.`;
  }
}

async function generateWeatherMap(seed, mode) {
  const config = loadAiConfig();
  if (!config.apiKey) {
    showToast("No API key saved. Remixing the demo atmosphere.");
    return remixDemo(seed, mode);
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.92,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You generate valid JSON for a visual semantic simulation." },
        { role: "user", content: promptFor(seed, mode) }
      ]
    })
  }).finally(() => window.clearTimeout(timeout));
  if (!response.ok) throw new Error(apiErrorMessage(await response.text(), response.status));
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI response had no content.");
  return JSON.parse(content);
}

function remixDemo(seed, mode) {
  state.generation += 1;
  const words = seed.split(/\s+/).filter((word) => word.length > 4).slice(0, 6);
  const clone = structuredClone(demoMap);
  const baseTitle = mode === "ritual" ? "Ritual Weather for Unfinished Thoughts" : mode === "strategy" ? "Strategic Pressure Map" : mode === "tensions" ? "Contradiction Storm" : clone.title;
  clone.title = `${baseTitle} - remix ${state.generation}`;
  clone.summary = `${clone.summary} Seed resonance: ${words.join(", ") || "ambient imagination"}.`;
  clone.concepts = clone.concepts.map((concept, index) => ({
    ...concept,
    label: words[index] ? `${concept.label}: ${words[index][0].toUpperCase()}${words[index].slice(1)}` : concept.label,
    weight: Math.max(0.08, Math.min(1, concept.weight + Math.sin(seed.length + index + state.generation) * 0.14))
  }));
  clone.relationships = clone.relationships.map((link, index) => ({
    ...link,
    strength: Math.max(0.05, Math.min(1, link.strength + Math.cos(seed.length + index + state.generation) * 0.16))
  }));
  clone.motionProfile = {
    turbulence: Math.max(0.05, Math.min(1.5, clone.motionProfile.turbulence + Math.sin(state.generation) * 0.18)),
    pulse: Math.max(0.05, Math.min(1.5, clone.motionProfile.pulse + Math.cos(state.generation) * 0.18)),
    drift: Math.max(0.05, Math.min(1.5, clone.motionProfile.drift + Math.sin(state.generation * 0.7) * 0.16)),
    bloom: Math.max(0.05, Math.min(1.5, clone.motionProfile.bloom + Math.cos(state.generation * 0.6) * 0.12))
  };
  return clone;
}

async function handleGenerate() {
  if (state.generating) return;
  state.generating = true;
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  statusLine.textContent = "AI pressure forming...";
  runStatus.textContent = loadAiConfig().apiKey ? "Generating with AI..." : "No key saved, generating a local demo remix...";
  try {
    buildMap(await generateWeatherMap(seedInput.value.trim(), state.mode));
    showToast("Generated a new semantic weather map.");
  } catch (error) {
    console.error(error);
    const message = error.name === "AbortError" ? "AI request timed out. Showing demo weather." : error.message || "AI call failed. Showing demo weather.";
    showToast(message);
    if (loadAiConfig().apiKey) {
      runStatus.textContent = message;
      statusLine.textContent = "AI generation blocked";
    } else {
      buildMap(remixDemo(seedInput.value, state.mode));
      runStatus.textContent = `${message} Local demo remix is displayed below.`;
    }
  } finally {
    state.generating = false;
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate weather";
  }
}

function exportMap() {
  const blob = new Blob([JSON.stringify(state.map, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(state.map.title)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function captureCanvas() {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${slugify(state.map?.title || "mnemonic-weather")}.png`;
  link.click();
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "weather-map";
}

function pickNode(commit = false) {
  state.raycaster.setFromCamera(state.pointer, camera);
  const hit = state.raycaster.intersectObjects(state.nodes.map((node) => node.core), false)[0];
  state.hovered = hit?.object?.userData?.concept || null;
  if (commit && state.hovered) {
    state.selected = state.hovered;
    const node = state.nodes.find((item) => item.concept.id === state.hovered.id);
    if (node) state.targetLookAt.copy(node.group.position);
    updateInspector(state.hovered);
  }
}

function animate(time = 0) {
  requestAnimationFrame(animate);
  const seconds = time * 0.001;
  const motion = state.map?.motionProfile || demoMap.motionProfile;
  root.rotation.y += state.reducedMotion ? 0 : 0.0008 * motion.drift;
  starField.rotation.y -= state.reducedMotion ? 0 : 0.00045;
  state.nodes.forEach((node, index) => {
    const selected = state.selected?.id === node.concept.id;
    const hovered = state.hovered?.id === node.concept.id;
    node.group.position.y = node.base.y + Math.sin(seconds * (0.9 + motion.pulse) + index * 0.77) * 0.35 * motion.turbulence;
    node.core.rotation.x += 0.004 + node.weight * 0.004;
    node.core.rotation.y += 0.006 + index * 0.0008;
    node.halo.scale.setScalar(1 + Math.sin(seconds * 1.6 + index) * 0.08 + (selected ? 0.36 : hovered ? 0.18 : 0));
    node.halo.material.opacity = selected ? 0.19 : hovered ? 0.14 : 0.075;
    node.ring.rotation.z += 0.003 + node.weight * 0.002;
    node.label.material.opacity = selected || hovered ? 1 : 0.72;
  });
  state.arcs.forEach((arc, index) => {
    arc.material.opacity = 0.32 + Math.sin(seconds * 2.2 + arc.phase) * 0.15 + arc.link.strength * 0.22;
    arc.mesh.rotation.y = Math.sin(seconds * 0.2 + index) * 0.02;
  });
  state.fronts.forEach((front, index) => {
    front.mesh.rotation.z += front.speed * 0.01;
    front.material.opacity = 0.13 + Math.sin(seconds * 0.9 + index) * 0.05;
    front.mesh.scale.setScalar(1 + Math.sin(seconds * (0.35 + front.speed) + front.phase) * 0.04);
  });
  state.currentLookAt.lerp(state.targetLookAt, 0.035);
  controls.target.copy(state.currentLookAt);
  controls.update();
  pickNode(false);
  composer.render();
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
}

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.mode = button.dataset.mode;
  });
});
generateBtn.addEventListener("click", handleGenerate);
demoBtn.addEventListener("click", () => {
  demoBtn.disabled = true;
  demoBtn.textContent = "Remixing...";
  runStatus.textContent = "Creating local demo remix...";
  buildMap(remixDemo(seedInput.value, state.mode));
  showToast("Demo remix generated.");
  window.setTimeout(() => {
    demoBtn.disabled = false;
    demoBtn.textContent = "Remix demo";
  }, 500);
});
exportBtn.addEventListener("click", exportMap);
captureBtn.addEventListener("click", captureCanvas);
settingsDetails.addEventListener("toggle", () => {
  if (settingsDetails.open) apiKeyInput.focus({ preventScroll: true });
});

function saveAiSettings(event) {
  event.preventDefault();
  const apiKey = apiKeyInput.value.trim();
  const baseUrl = baseUrlInput.value.trim() || "https://api.openai.com/v1";
  const model = modelInput.value.trim() || "gpt-4o-mini";
  saveSettings.disabled = true;
  saveSettings.textContent = "Saving...";
  try {
    localStorage.setItem("mwe.apiKey", apiKey);
    localStorage.setItem("mwe.baseUrl", baseUrl);
    localStorage.setItem("mwe.model", model);
    updateSettingsStatus(apiKey ? "Saved. Now press Generate weather to use this AI configuration." : "Saved with no key. Generate will use the demo remix.", apiKey ? "Key saved" : "No key saved");
    saveSettings.textContent = "Saved";
    showToast(apiKey ? "AI key saved locally." : "No key saved. Demo mode stays active.");
  } catch (error) {
    console.error(error);
    updateSettingsStatus("Could not save settings. Your browser may be blocking localStorage for this page.");
    saveSettings.textContent = "Save failed";
    showToast("Could not save AI settings.");
  } finally {
    window.setTimeout(() => {
      saveSettings.disabled = false;
      saveSettings.textContent = "Save locally";
    }, 1200);
  }
}

settingsForm.addEventListener("submit", saveAiSettings);
apiKeyInput.addEventListener("input", () => updateSettingsStatus(apiKeyInput.value.trim() ? "Unsaved key entered. Click Save locally." : "No key entered. Generate will use the demo remix.", apiKeyInput.value.trim() ? "Unsaved key" : "No key saved"));
document.querySelectorAll(".demo-panel, .inspector").forEach((panel) => {
  panel.addEventListener("click", (event) => event.stopPropagation());
});
window.addEventListener("resize", resize);
window.addEventListener("pointermove", (event) => {
  state.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener("click", () => pickNode(true));
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") handleGenerate();
  if (event.key === "Escape") {
    state.selected = null;
    state.targetLookAt.set(0, 0, 0);
    updateInspector(null);
  }
});

const config = loadAiConfig();
apiKeyInput.value = config.apiKey;
baseUrlInput.value = config.baseUrl;
modelInput.value = config.model;
updateSettingsStatus();
buildMap(demoMap);
window.__mweReady = true;
animate();
