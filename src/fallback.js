(function () {
  const fallbackDelay = 1400;
  let fallbackCount = 0;
  let mode = "map";
  let fallbackScene = null;

  function get(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const element = get(selector);
    if (element) element.textContent = value;
  }

  function showToast(message) {
    const toast = get("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  function colorFor(index) {
    return ["#7cffb2", "#55d8ff", "#ffd36b", "#ff4d2d", "#b38cff"][index % 5];
  }

  function loadAiConfig() {
    return {
      apiKey: localStorage.getItem("mwe.apiKey") || window.MWE_TEMP_API_KEY || "",
      baseUrl: localStorage.getItem("mwe.baseUrl") || window.MWE_TEMP_BASE_URL || "https://api.openai.com/v1",
      model: localStorage.getItem("mwe.model") || window.MWE_TEMP_MODEL || "gpt-4o-mini"
    };
  }

  function updateKeyUiFromConfig() {
    const config = loadAiConfig();
    const apiKeyInput = get("#api-key");
    const baseUrlInput = get("#base-url");
    const modelInput = get("#model-name");
    if (apiKeyInput) apiKeyInput.value = config.apiKey;
    if (baseUrlInput) baseUrlInput.value = config.baseUrl;
    if (modelInput) modelInput.value = config.model;
    setText("#key-state", config.apiKey ? "Key saved" : "No key saved");
    setText("#settings-status", config.apiKey ? "Key loaded. Generate will call the configured AI endpoint." : "No key saved yet. Generate will use local mode.");
  }

  function promptFor(seed) {
    return [
      "Return strict JSON only for a semantic weather map.",
      "Shape: {title, summary, concepts, relationships, tensions, questions, motionProfile}.",
      "Each concept: {id,label,kind,weight,mood,note,tags}. Use 6 to 10 concepts. ids are c1, c2, etc. weight is 0.05 to 1.",
      "Each relationship: {from,to,kind,strength}. strength is 0.05 to 1 and ids must exist.",
      "Make it strange, useful, coherent, and visually suggestive.",
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

  async function generateAiMap(seed) {
    const config = loadAiConfig();
    if (!config.apiKey) return null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 22000);
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.9,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You generate valid JSON for a visual semantic simulation." },
          { role: "user", content: promptFor(seed) }
        ]
      })
    }).finally(() => window.clearTimeout(timeout));
    if (!response.ok) throw new Error(apiErrorMessage(await response.text(), response.status));
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("The AI response had no content.");
    return JSON.parse(content);
  }

  function createFallbackScene(seed, title, concepts) {
    const words = seed.split(/\s+/).filter((word) => word.length > 3);
    fallbackScene = {
      title,
      nodes: Array.from({ length: concepts }, (_, index) => ({
        label: words[index % Math.max(1, words.length)] || `Concept ${index + 1}`,
        angle: (Math.PI * 2 * index) / concepts,
        radius: 0.18 + (index % 4) * 0.055,
        size: 8 + (index % 5) * 3,
        color: colorFor(index),
        phase: Math.random() * Math.PI * 2
      }))
    };
  }

  function createSceneFromAiMap(map) {
    const concepts = Array.isArray(map?.concepts) ? map.concepts.slice(0, 10) : [];
    fallbackScene = {
      title: String(map?.title || "AI weather map"),
      nodes: concepts.map((concept, index) => ({
        label: String(concept.label || `Concept ${index + 1}`),
        angle: (Math.PI * 2 * index) / Math.max(1, concepts.length),
        radius: 0.18 + Math.min(0.18, Math.max(0.02, Number(concept.weight || 0.45) * 0.16)) + (index % 3) * 0.035,
        size: 9 + Math.max(0, Math.min(1, Number(concept.weight || 0.5))) * 14,
        color: colorFor(index),
        phase: Math.random() * Math.PI * 2
      }))
    };
  }

  function drawFallbackScene(time) {
    if (!document.body.classList.contains("fallback-active")) return;
    const canvas = get("#weather-canvas");
    const context = canvas?.getContext?.("2d");
    if (!canvas || !context) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const seconds = time * 0.001;
    const centerX = width * 0.6;
    const centerY = height * 0.52;
    const scale = Math.min(width, height);

    context.clearRect(0, 0, width, height);
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 0.8);
    gradient.addColorStop(0, "rgba(124, 255, 178, 0.16)");
    gradient.addColorStop(0.45, "rgba(85, 216, 255, 0.08)");
    gradient.addColorStop(1, "rgba(5, 7, 7, 0.96)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const nodes = fallbackScene?.nodes || [];
    context.lineWidth = 1.2;
    nodes.forEach((node, index) => {
      const next = nodes[(index + 2) % nodes.length];
      if (!next) return;
      const x1 = centerX + Math.cos(node.angle + seconds * 0.12) * node.radius * scale;
      const y1 = centerY + Math.sin(node.angle + seconds * 0.16) * node.radius * scale;
      const x2 = centerX + Math.cos(next.angle + seconds * 0.12) * next.radius * scale;
      const y2 = centerY + Math.sin(next.angle + seconds * 0.16) * next.radius * scale;
      context.strokeStyle = `rgba(85, 216, 255, ${0.22 + (index % 3) * 0.08})`;
      context.beginPath();
      context.moveTo(x1, y1);
      context.quadraticCurveTo(centerX, centerY - 80 - index * 5, x2, y2);
      context.stroke();
    });

    nodes.forEach((node, index) => {
      const pulse = 1 + Math.sin(seconds * 2 + node.phase) * 0.22;
      const x = centerX + Math.cos(node.angle + seconds * 0.12) * node.radius * scale;
      const y = centerY + Math.sin(node.angle + seconds * 0.16) * node.radius * scale;
      context.shadowColor = node.color;
      context.shadowBlur = 24;
      context.fillStyle = node.color;
      context.beginPath();
      context.arc(x, y, node.size * pulse, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      if (index < 5) {
        context.fillStyle = "rgba(246, 244, 234, 0.82)";
        context.font = "700 12px system-ui, sans-serif";
        context.fillText(node.label.slice(0, 18), x + 12, y - 10);
      }
    });

    context.fillStyle = "rgba(246, 244, 234, 0.78)";
    context.font = "800 18px system-ui, sans-serif";
    context.fillText(fallbackScene?.title || "Local weather map", Math.max(24, width * 0.46), 42);
    requestAnimationFrame(drawFallbackScene);
  }

  function updateMetricsFromMap(map, fallbackConcepts) {
    const concepts = Array.isArray(map?.concepts) ? map.concepts.length : fallbackConcepts;
    const links = Array.isArray(map?.relationships) ? map.relationships.length : Math.max(5, concepts - 1);
    const tensions = Array.isArray(map?.tensions) ? map.tensions.length : mode === "tensions" ? 4 : 2;
    setText("#concept-count", String(concepts));
    setText("#link-count", String(links));
    setText("#tension-count", String(tensions));
  }

  function localMap(action) {
    fallbackCount += 1;
    const seed = get("#seed-input")?.value.trim() || "ambient imagination";
    const title = `${action === "Remix" ? "Remix" : "Local weather"} ${fallbackCount}: ${mode[0].toUpperCase()}${mode.slice(1)}`;
    const concepts = Math.max(6, Math.min(10, seed.split(/\s+/).filter(Boolean).length));
    setText("#status-line", title);
    updateMetricsFromMap(null, concepts);
    setText("#run-status", `Generated ${title}. Local canvas mode is active.`);
    setText("#detail-title", "Local map generated");
    setText("#detail-body", `Seed: ${seed}`);
    createFallbackScene(seed, title, concepts);
    showToast(action === "Remix" ? "Demo remix generated." : "Local weather generated.");
  }

  async function fallbackMap(action) {
    if (action === "Remix") {
      localMap(action);
      return;
    }

    const seed = get("#seed-input")?.value.trim() || "ambient imagination";
    const button = get("#generate-btn");
    if (button) {
      button.disabled = true;
      button.textContent = "Generating...";
    }
    setText("#run-status", "Generating with AI key...");
    try {
      const map = await generateAiMap(seed);
      if (!map) {
        localMap(action);
        return;
      }
      fallbackCount += 1;
      createSceneFromAiMap(map);
      updateMetricsFromMap(map, 7);
      setText("#status-line", String(map.title || `AI weather ${fallbackCount}`));
      setText("#run-status", `AI generated ${map.title || "a semantic weather map"}. Local canvas renderer is active.`);
      setText("#detail-title", String(map.title || "AI map generated"));
      setText("#detail-body", String(map.summary || `Seed: ${seed}`));
      showToast("AI weather generated.");
    } catch (error) {
      console.error(error);
      setText("#run-status", error.message || "AI call failed, so a local canvas map was generated instead.");
      showToast(error.message || "AI call failed.");
      setText("#status-line", "AI generation blocked");
      setText("#detail-title", "AI generation blocked");
      setText("#detail-body", error.message || "The AI request failed before a semantic map could be returned.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Generate weather";
      }
    }
  }

  function saveSettings(event) {
    if (window.__mweReady) return;
    event.preventDefault();
    const apiKey = get("#api-key")?.value.trim() || "";
    const baseUrl = get("#base-url")?.value.trim() || "https://api.openai.com/v1";
    const model = get("#model-name")?.value.trim() || "gpt-4o-mini";
    try {
      localStorage.setItem("mwe.apiKey", apiKey);
      localStorage.setItem("mwe.baseUrl", baseUrl);
      localStorage.setItem("mwe.model", model);
      setText("#key-state", apiKey ? "Key saved" : "No key saved");
      setText("#settings-status", apiKey ? "Saved. Generate will use this key for AI when available." : "Saved with no key. Demo mode stays active.");
      showToast(apiKey ? "AI key saved locally." : "No key saved. Demo mode stays active.");
    } catch (error) {
      console.error(error);
      setText("#settings-status", "Could not save settings. Browser storage may be blocked.");
      showToast("Could not save AI settings.");
    }
  }

  function attachFallbackControls() {
    if (window.__mweReady) return;
    updateKeyUiFromConfig();
    document.body.classList.add("fallback-active");
    setText("#run-status", loadAiConfig().apiKey ? "AI key loaded. Generate will call AI; Remix stays local." : "Local canvas mode ready. Generate and Remix will respond immediately.");
    setText("#status-line", "Local canvas mode ready");
    setText("#concept-count", "7");
    setText("#link-count", "6");
    setText("#tension-count", "2");
    createFallbackScene(get("#seed-input")?.value.trim() || "ambient imagination", "Local canvas weather", 7);
    requestAnimationFrame(drawFallbackScene);

    document.querySelectorAll(".mode").forEach((button) => {
      button.addEventListener("click", () => {
        if (window.__mweReady) return;
        document.querySelectorAll(".mode").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        mode = button.dataset.mode || "map";
        setText("#run-status", `Mode set to ${mode}. Press Generate weather or Remix demo.`);
      });
    });

    get("#generate-btn")?.addEventListener("click", () => {
      if (window.__mweReady) return;
      fallbackMap("Generate");
    });

    get("#demo-btn")?.addEventListener("click", () => {
      if (window.__mweReady) return;
      fallbackMap("Remix");
    });

    get("#settings-form")?.addEventListener("submit", saveSettings);
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(attachFallbackControls, fallbackDelay);
  });
})();