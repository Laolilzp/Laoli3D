import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { buildUI } from "./laoli_ui.js";
import { LaoliScene } from "./laoli_scene.js";
import { translateBone, findBone, showToast } from "./laoli_utils.js"; 
import * as THREE from "./LaoliThree.js";

const LAOLI_INSTANCES = {};

// === 灯光预设数据 (保持高亮度默认值) ===
const LIGHT_PRESETS = {
    "default": { env: 1.2, key: { i: 2.5, a: 0, e: 45 }, fill: { i: 1.5, a: -45, e: 30 }, rim: { i: 2.0, a: 180, e: 45 } },
    "rembrandt": { env: 0.3, key: { i: 2.5, a: 60, e: 50 }, fill: { i: 0.5, a: -45, e: 20 }, rim: { i: 1.0, a: 150, e: 30 } },
    "rim": { env: 0.0, key: { i: 0.0, a: 0, e: 45 }, fill: { i: 0.0, a: 0, e: 45 }, rim: { i: 4.0, a: 180, e: 20 } },
    "dark": { env: 0.05, key: { i: 1.5, a: 0, e: 85 }, fill: { i: 0.1, a: -45, e: 10 }, rim: { i: 0.5, a: 180, e: 10 } },
    "butterfly": { env: 0.8, key: { i: 2.2, a: 0, e: 60 }, fill: { i: 0.8, a: 0, e: -10 }, rim: { i: 1.2, a: 180, e: 40 } },
    "split": { env: 0.2, key: { i: 2.5, a: 90, e: 0 }, fill: { i: 0.0, a: -90, e: 0 }, rim: { i: 0.8, a: 180, e: 10 } },
    "hard": { env: 0.3, key: { i: 3.0, a: 45, e: 80 }, fill: { i: 0.3, a: -45, e: 10 }, rim: { i: 0.5, a: 180, e: 60 } },
    "soft": { env: 1.0, key: { i: 1.2, a: 30, e: 30 }, fill: { i: 1.2, a: -30, e: 30 }, rim: { i: 0.2, a: 0, e: 0 } },
    "cyber": { env: 0.3, key: { i: 2.0, a: 135, e: 20 }, fill: { i: 2.0, a: -45, e: 20 }, rim: { i: 2.0, a: 0, e: 80 } }
};

app.registerExtension({
    name: "Comfy.Laoli3DPoseEditor",
    setup() {
        api.addEventListener("executed", (event) => {
            const detail = event.detail;
            if (!detail || !detail.output || !detail.output.ui) return;
            const instance = LAOLI_INSTANCES[detail.node];
            if (instance && detail.output.ui.ai_pose) {
                instance.scene.applyPose(detail.output.ui.ai_pose);
                instance.updateOutput();
                showToast("✅ AI 姿势已同步", "#2e7d32");
                if (instance.refreshLibrary) { setTimeout(() => { instance.refreshLibrary(); showToast("📂 动作库已更新", "#1565c0"); }, 200); }
            }
        });
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Laoli_3DPoseEditor") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                const node = this;
                
                const widgetsToHide = ["pose_data_json", "model_asset", "light_config_text"];
                if (node.widgets) {
                    node.widgets.forEach(w => {
                        if (widgetsToHide.includes(w.name)) {
                            w.computeSize = () => [0, -4]; w.options = w.options || {}; w.options.hidden = true; w.onDraw = function(){}; 
                            if (w.inputEl) { w.inputEl.style.display = "none"; }
                        }
                    });
                }

                const mainNodeContainer = document.createElement("div");
                mainNodeContainer.id = `laoli-3d-${node.id}`;
                mainNodeContainer.style.cssText = "display:flex; width:100%; height:100%; background:#222; position:relative; overflow:hidden; user-select:none;";
                const ui = buildUI(mainNodeContainer);
                node.addDOMWidget("3d_canvas", "canvas", mainNodeContainer, { serialize: false });
                node.setSize([1000, 750]);
                
                const placeholder = document.createElement("div"); 
                placeholder.style.cssText = "width:100%; height:100%; background:#111; display:flex; align-items:center; justify-content:center; color:#555; font-size:14px;";
                placeholder.innerText = "全屏模式中...";
                mainNodeContainer._placeholder = placeholder;
                
                let currentLibType = "Body"; 
                let currentLibData = {}; 
                let activeCategory = "Default"; 
                
                const historyStack = [];
                const MAX_HISTORY = 20;
                let isRestoring = false;

                const saveState = (label) => {
                    if (isRestoring || !scene.activeCharacter) return;
                    const char = scene.activeCharacter;
                    const state = {
                        label: label || `Action ${historyStack.length + 1}`,
                        timestamp: Date.now(),
                        bones: {},
                        root: { pos: char.group.position.toArray(), rot: char.group.rotation.toArray(), scl: char.group.scale.toArray() }
                    };
                    char.bones.forEach(b => { state.bones[b.name] = b.quaternion.toArray(); });
                    historyStack.push(state);
                    if (historyStack.length > MAX_HISTORY) historyStack.shift();
                    updateHistoryUI();
                };

                const updateHistoryUI = () => {
                    if(!ui.historySelect) return;
                    ui.historySelect.innerHTML = `<option value="-1">-- 历史记录 (${historyStack.length}) --</option>`;
                    historyStack.slice().reverse().forEach((state, i) => {
                        const opt = document.createElement("option");
                        opt.value = historyStack.length - 1 - i; 
                        opt.text = `${state.label}`;
                        ui.historySelect.appendChild(opt);
                    });
                };

                const restoreState = (index) => {
                    if (index < 0 || index >= historyStack.length || !scene.activeCharacter) return;
                    isRestoring = true;
                    const state = historyStack[index];
                    const char = scene.activeCharacter;
                    char.group.position.fromArray(state.root.pos);
                    char.group.rotation.fromArray(state.root.rot);
                    char.group.scale.fromArray(state.root.scl);
                    char.bones.forEach(b => { if(state.bones[b.name]) b.quaternion.fromArray(state.bones[b.name]); });
                    
                    if(ui.manX) ui.manX.value = char.group.position.x;
                    if(ui.manY) ui.manY.value = char.group.position.y;
                    if(ui.manZ) ui.manZ.value = char.group.position.z;
                    if(ui.manScale) ui.manScale.value = char.group.scale.x;
                    const hips = findBone(char, "Hips");
                    if(hips) {
                        if(ui.manRotX) ui.manRotX.value = THREE.MathUtils.radToDeg(hips.rotation.x);
                        if(ui.manRotY) ui.manRotY.value = THREE.MathUtils.radToDeg(hips.rotation.y);
                        if(ui.manRotZ) ui.manRotZ.value = THREE.MathUtils.radToDeg(hips.rotation.z);
                    }
                    scene.selectBone(scene.currentBone); 
                    updateOutput();
                    historyStack.length = index + 1; 
                    updateHistoryUI();
                    setTimeout(() => isRestoring = false, 100);
                };

                const scene = new LaoliScene(mainNodeContainer, {
                    onBoneSelect: (bone) => {
                        if(ui.list) ui.list.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
                        if (bone) {
                            const nameInfo = translateBone(bone.name);
                            if(ui.name) ui.name.innerText = nameInfo.full;
                            if(ui.rx) ui.rx.value = bone.rotation.x; if(ui.ry) ui.ry.value = bone.rotation.y; if(ui.rz) ui.rz.value = bone.rotation.z;
                            if(ui.list) {
                                const item = ui.list.querySelector(`div[data-uuid='${bone.uuid}']`);
                                if (item) { item.classList.add("selected"); item.scrollIntoView({ block: "center", behavior: "smooth" }); }
                            }
                        } else { if(ui.name) ui.name.innerText = "未选择"; }
                    },
                    onCharacterActivated: (char) => {
                        if(ui.charName) ui.charName.innerText = char ? char.name : "无角色";
                        if(ui.list) ui.list.innerHTML = ""; if(ui.charBar) ui.charBar.innerHTML = "";
                        if (!char) return;
                        if(ui.manScale) ui.manScale.value = char.group.scale.x;
                        if(ui.manX) ui.manX.value = char.group.position.x; if(ui.manY) ui.manY.value = char.group.position.y; if(ui.manZ) ui.manZ.value = char.group.position.z;
                        const hips = findBone(char, "Hips");
                        if (hips) {
                            if(ui.manRotX) ui.manRotX.value = THREE.MathUtils.radToDeg(hips.rotation.x);
                            if(ui.manRotY) ui.manRotY.value = THREE.MathUtils.radToDeg(hips.rotation.y);
                            if(ui.manRotZ) ui.manRotZ.value = THREE.MathUtils.radToDeg(hips.rotation.z);
                        }
                        if(ui.list) { char.bones.forEach(b => { const div = document.createElement("div"); div.className = "bone-item"; div.innerText = translateBone(b.name).full; div.dataset.uuid = b.uuid; div.onclick = () => scene.selectBone(b); ui.list.appendChild(div); }); }
                        if(ui.charBar) { scene.characters.forEach((c, i) => { const btn = document.createElement("div"); btn.className = `char-tab ${c === char ? 'active' : ''}`; btn.innerText = `${c.name} #${i + 1}`; btn.onclick = () => scene.activateCharacter(c); ui.charBar.appendChild(btn); }); }
                        saveState("Initial");
                    }
                });

                const initLightingSystem = () => {
                    if (!scene.scene) return;
                    const existingLights = [];
                    scene.scene.traverse(o => { if(o.isLight) existingLights.push(o); });
                    existingLights.forEach(l => scene.scene.remove(l));

                    const createLight = (type, intensity, shadow=false) => {
                        let l;
                        if (type === 'hemi') {
                            l = new THREE.HemisphereLight(0xffffff, 0x333333, intensity);
                            l.position.set(0, 20, 0);
                        } else {
                            l = new THREE.DirectionalLight(0xffffff, intensity);
                            if (shadow) {
                                l.castShadow = true;
                                l.shadow.mapSize.width = 2048; 
                                l.shadow.mapSize.height = 2048;
                                l.shadow.bias = -0.0001;
                                l.shadow.radius = 4; 
                            }
                        }
                        scene.scene.add(l);
                        return l;
                    };

                    const lights = {
                        hemi: createLight('hemi', 1.2),
                        key: createLight('dir', 2.5, true),
                        fill: createLight('dir', 1.5, false),
                        rim: createLight('dir', 2.0, false)
                    };

                    let activeLight = "key";

                    const updateLightPos = (key, azi, ele, dist=5) => {
                        const l = lights[key];
                        if (!l || key === 'hemi') return;
                        const phi = THREE.MathUtils.degToRad(90 - ele);
                        const theta = THREE.MathUtils.degToRad(azi);
                        l.position.setFromSphericalCoords(dist, phi, theta);
                        l.lookAt(0, 1, 0);
                        if (l.shadow) l.shadow.camera.updateProjectionMatrix();
                    };

                    // 🔥🔥完整的 AI 智能光影提示词生成器 🔥🔥
                    const generateLightPrompt = () => {
                        const key = lights.key; const fill = lights.fill;
                        const rim = lights.rim; const env = lights.hemi;
                        
                        let descParts = [];
                        let weightedTags = [];

                        const getW = (v) => Math.min(1.6, 1.0 + (v * 0.15)).toFixed(2);

                        // 1. 全局光影氛围
                        const ambientLevel = env.intensity + (fill.intensity * 0.5);
                        const contrast = key.intensity / (ambientLevel + 0.05);
                        
                        if (ambientLevel < 0.5 || (ambientLevel < 1.0 && contrast > 3.0)) {
                            descParts.push("Cinematic low-key photography, shadows dominating the frame.");
                            weightedTags.push(`(low key:${getW(2.0 - ambientLevel)})`, "(dark background:1.3)", "(black background:1.2)", "moody", "mystery");
                        } else if (ambientLevel > 2.5) {
                            descParts.push("High-key studio photography with bright, uniform illumination.");
                            weightedTags.push("(high key:1.2)", "clean white background");
                        } else {
                            descParts.push("Professional studio photography with neutral lighting.");
                            weightedTags.push("studio lighting", "neutral background");
                        }

                        // 2. 主光分析
                        if (key.intensity > 0.1) {
                            const rawAzi = key.userData ? parseInt(key.userData.azi) : 0;
                            const ele = key.userData ? parseInt(key.userData.ele) : 0;
                            let normAzi = (rawAzi) % 360; 
                            if (normAzi > 180) normAzi -= 360; if (normAzi < -180) normAzi += 360;
                            const absAzi = Math.abs(normAzi);
                            
                            let verb = "illuminates";
                            if (key.intensity > 1.5) verb = "strikes";
                            if (key.intensity > 2.5) verb = "blasts";

                            // 2.1 硬度
                            if (key.castShadow && (key.intensity > 1.3 || contrast > 2.0)) {
                                weightedTags.push(`(hard shadows:${getW(key.intensity)})`, "high contrast", "(specular highlights:1.2)");
                            } else {
                                weightedTags.push("soft shadows", "diffused lighting");
                            }

                            // 2.2 角度逻辑
                            const side = normAzi > 0 ? "right" : "left";
                            
                            if (ele > 65) {
                                descParts.push(`A harsh overhead light ${verb} the subject from above.`);
                                weightedTags.push(`(top down lighting:${getW(key.intensity)})`, "dramatic shadows");
                            } else if (ele < -10) {
                                descParts.push(`An eerie light ${verb} the subject from below.`);
                                weightedTags.push(`(bottom up lighting:${getW(key.intensity)})`, "horror lighting");
                            } else {
                                if (absAzi < 20) {
                                    if (ele > 30) {
                                        descParts.push(`Butterfly lighting sculpts the face features.`);
                                        weightedTags.push("(butterfly lighting:1.2)");
                                    } else {
                                        descParts.push(`Flat front lighting ${verb} the face evenly.`);
                                        weightedTags.push("(front lighting:1.2)", "flat lighting");
                                    }
                                } else if (absAzi < 70) {
                                    descParts.push(`Classic Rembrandt lighting ${verb} the subject from the front-${side}.`);
                                    weightedTags.push(`(light from ${side}:1.2)`, "(rembrandt lighting:1.2)", "chiaroscuro");
                                } else if (absAzi < 110) {
                                    descParts.push(`High-contrast split lighting hits from the ${side}.`);
                                    weightedTags.push(`(side lighting:${getW(key.intensity)})`, "split lighting");
                                } else if (absAzi < 160) {
                                    descParts.push(`A kicker light accents the rear-${side} edge.`);
                                    weightedTags.push("kicker light");
                                } else {
                                    descParts.push(`Strong backlighting creates a silhouette.`);
                                    weightedTags.push("(backlighting:1.3)", "silhouette");
                                }
                            }
                        }

                        // 3. 辅助光
                        if (rim.intensity > 0.2) {
                            descParts.push("A rim light separates the subject from the background.");
                            weightedTags.push(`(rim light:${getW(rim.intensity)})`, "backlight hair", "halo effect");
                        }

                        // 4. 画质
                        weightedTags.push("masterpiece, best quality, 8k, raw photo, detailed skin texture");

                        return descParts.join(" ") + " " + weightedTags.join(", ");
                    };
                    
                    scene.getLightPrompt = generateLightPrompt;

                    const applyPreset = (name) => {
                        const p = LIGHT_PRESETS[name] || LIGHT_PRESETS['default'];
                        lights.hemi.intensity = p.env !== undefined ? p.env : 0.6;
                        lights.key.intensity = p.key.i;
                        lights.key.userData = { azi: p.key.a, ele: p.key.e };
                        updateLightPos('key', p.key.a, p.key.e);
                        lights.fill.intensity = p.fill.i;
                        lights.fill.userData = { azi: p.fill.a, ele: p.fill.e };
                        updateLightPos('fill', p.fill.a, p.fill.e);
                        lights.rim.intensity = p.rim.i;
                        lights.rim.userData = { azi: p.rim.a, ele: p.rim.e };
                        updateLightPos('rim', p.rim.a, p.rim.e);
                        syncUI();
                        updateOutput();
                    };

                    const syncUI = () => {
                        const l = lights[activeLight];
                        ui.light.intensity.value = l.intensity;
                        ui.light.valInt.innerText = l.intensity.toFixed(1);
                        if (activeLight === 'hemi') {
                            ui.light.azimuth.disabled = true;
                            ui.light.elevation.disabled = true;
                            ui.light.valAzi.innerText = "--";
                            ui.light.valEle.innerText = "--";
                        } else if (l.userData) {
                            ui.light.azimuth.value = l.userData.azi;
                            ui.light.valAzi.innerText = parseInt(l.userData.azi) + "°";
                            ui.light.elevation.value = l.userData.ele;
                            ui.light.valEle.innerText = parseInt(l.userData.ele) + "°";
                            ui.light.azimuth.disabled = false;
                            ui.light.elevation.disabled = false;
                        }
                    };

                    ui.light.tabs.forEach(tab => {
                        tab.onclick = () => {
                            ui.light.tabs.forEach(t => t.classList.remove('active'));
                            tab.classList.add('active');
                            activeLight = tab.dataset.target;
                            syncUI();
                        };
                    });

                    ui.light.presets.forEach(btn => {
                        btn.onclick = () => {
                            ui.light.presets.forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            applyPreset(btn.dataset.id);
                        };
                    });

                    ui.light.intensity.oninput = (e) => {
                        const v = parseFloat(e.target.value);
                        lights[activeLight].intensity = v;
                        ui.light.valInt.innerText = v.toFixed(1);
                        updateOutput();
                    };

                    ui.light.azimuth.oninput = (e) => {
                        if (activeLight === 'hemi') return;
                        const v = parseFloat(e.target.value);
                        if(lights[activeLight].userData) {
                            lights[activeLight].userData.azi = v;
                            updateLightPos(activeLight, v, lights[activeLight].userData.ele);
                            ui.light.valAzi.innerText = parseInt(v) + "°";
                            updateOutput();
                        }
                    };

                    ui.light.elevation.oninput = (e) => {
                        if (activeLight === 'hemi') return;
                        const v = parseFloat(e.target.value);
                        if(lights[activeLight].userData) {
                            lights[activeLight].userData.ele = v;
                            updateLightPos(activeLight, lights[activeLight].userData.azi, v);
                            ui.light.valEle.innerText = parseInt(v) + "°";
                            updateOutput();
                        }
                    };

                    ui.light.shadowCheck.onchange = (e) => {
                        lights.key.castShadow = e.target.checked;
                        updateOutput();
                    };

                    applyPreset('default');
                };
                
                setTimeout(initLightingSystem, 100);

                if (scene.transform) { scene.transform.addEventListener('dragging-changed', (e) => { if (e.value) saveState("Gizmo Edit"); }); }
                const trackSliderInputs = () => {
                    const sliders = mainNodeContainer.querySelectorAll("input[type=range]");
                    sliders.forEach(s => { s.addEventListener('mousedown', () => saveState("Slider Edit")); });
                };
                setTimeout(trackSliderInputs, 500); 

                if(ui.undoBtn) ui.undoBtn.onclick = () => { if(historyStack.length > 1) { restoreState(historyStack.length - 2); } };
                if(ui.historySelect) ui.historySelect.onchange = (e) => { restoreState(parseInt(e.target.value)); };

                const updateOutput = (doCrop = false) => {
                    const valW = ui.outW ? parseInt(ui.outW.value) : 1024;
                    const valH = ui.outH ? parseInt(ui.outH.value) : 1024;
                    const w = valW || 1024;
                    const h = valH || 1024;
                    
                    let cropRect = null; if(doCrop && ui.crop && ui.crop.box) cropRect = ui.crop.box.getBoundingClientRect();
                    const snaps = scene.getSnapshot(w, h, cropRect);
                    const activeChar = scene.activeCharacter;
                    const poseData = activeChar ? { body: {}, hands: {} } : {};
                    if(activeChar) activeChar.bones.forEach(b => poseData.body[b.name] = { q: b.quaternion.toArray() });
                    let poseWidget = node.widgets?.find(w => w.name === "pose_data_json");
                    const finalJson = { meta: { source: "Laoli_Native", version: "2.0" }, body: poseData.body, hands: poseData.hands, pose_img: snaps.pose_img, rgb: snaps.rgb, normal: snaps.normal };
                    if(poseWidget) poseWidget.value = JSON.stringify(finalJson);

                    // 🔥 更新 prompt 输出
                    let lightWidget = node.widgets?.find(w => w.name === "light_config_text");
                    if (lightWidget && scene.getLightPrompt) {
                        lightWidget.value = scene.getLightPrompt();
                    }
                };

                const load = (f) => { if(!f || f==="Loading...") return; let modelWidget = node.widgets?.find(w => w.name === "model_asset"); if (!modelWidget && node.widgets) modelWidget = node.widgets[0]; scene.loadModel(`/extensions/Laoli3D/assets/${f}`, () => { updateOutput(); if(modelWidget) modelWidget.value = f; }); };
                fetch("/laoli/get_models").then(r => r.json()).then(files => { if(ui.modelSelect) { ui.modelSelect.innerHTML = ""; files.forEach(f => { const opt = document.createElement("option"); opt.value = f; opt.text = f; ui.modelSelect.appendChild(opt); }); if(files.length > 0) ui.modelSelect.value = files[0]; } });
                if(ui.addBtn) ui.addBtn.onclick = () => ui.modelSelect && load(ui.modelSelect.value);
                if(ui.delBtn) ui.delBtn.onclick = () => { scene.removeActiveCharacter(); updateOutput(); };
                if(ui.snapBtn) ui.snapBtn.onclick = () => { if(ui.crop && ui.crop.layer) { ui.crop.layer.style.display = "block"; const r = mainNodeContainer.getBoundingClientRect(); const boxSize = Math.min(r.width, r.height) * 0.6; ui.crop.box.style.width = boxSize + "px"; ui.crop.box.style.height = boxSize + "px"; ui.crop.box.style.left = (r.width/2 - boxSize/2) + "px"; ui.crop.box.style.top = (r.height/2 - boxSize/2) + "px"; } };
                if(ui.crop && ui.crop.cancel) ui.crop.cancel.onclick = () => { ui.crop.layer.style.display = "none"; };
                if(ui.crop && ui.crop.confirm) ui.crop.confirm.onclick = () => { updateOutput(true); ui.crop.layer.style.display = "none"; };
                [ui.rx, ui.ry, ui.rz].forEach(el => { if (el) el.oninput = () => { if(scene.currentBone) { scene.currentBone.rotation.set(parseFloat(ui.rx.value), parseFloat(ui.ry.value), parseFloat(ui.rz.value)); updateOutput(); } }; });
                
                const rotateHips = (axis, val) => { if(!scene.activeCharacter) return; const hips = findBone(scene.activeCharacter, "Hips"); if(hips) hips.rotation[axis] = THREE.MathUtils.degToRad(parseFloat(val)); updateOutput(); };
                if(ui.manRotX) ui.manRotX.oninput = (e) => rotateHips('x', e.target.value);
                if(ui.manRotY) ui.manRotY.oninput = (e) => rotateHips('y', e.target.value);
                if(ui.manRotZ) ui.manRotZ.oninput = (e) => rotateHips('z', e.target.value);
                
                if(ui.btns.faceFront) ui.btns.faceFront.onclick = () => { 
                    saveState("Face Front Toggle");
                    if(scene.activeCharacter) { 
                        const hips = findBone(scene.activeCharacter, "Hips"); 
                        if(hips) { 
                            const currentY = hips.rotation.y;
                            const isZero = Math.abs(currentY) < 0.1;
                            const targetY = isZero ? Math.PI : 0;
                            hips.rotation.set(0, targetY, 0); 
                            if(ui.manRotX) ui.manRotX.value = 0; 
                            if(ui.manRotY) ui.manRotY.value = THREE.MathUtils.radToDeg(targetY); 
                            if(ui.manRotZ) ui.manRotZ.value = 0; 
                            updateOutput(); 
                        } 
                    } 
                };
                
                if(ui.manScale) ui.manScale.oninput = (e) => { if(scene.activeCharacter) scene.activeCharacter.group.scale.setScalar(parseFloat(e.target.value)); };
                if(ui.manX) ui.manX.oninput = (e) => { if(scene.activeCharacter) scene.activeCharacter.group.position.x = parseFloat(e.target.value); };
                if(ui.manY) ui.manY.oninput = (e) => { if(scene.activeCharacter) scene.activeCharacter.group.position.y = parseFloat(e.target.value); };
                if(ui.manZ) ui.manZ.oninput = (e) => { if(scene.activeCharacter) scene.activeCharacter.group.position.z = parseFloat(e.target.value); };

                const refreshLib = () => {
                    fetch(`/laoli/get_library?libType=${currentLibType}&t=${Date.now()}`).then(r=>r.json()).then(lib => { 
                        currentLibData = lib; 
                        renderLibrary(); 
                    });
                };

                const switchLib = (type) => { currentLibType = type; ui.tabBody.classList.toggle("active", type === "Body"); ui.tabHands.classList.toggle("active", type === "Hands"); ui.saveTypeDisplay.innerText = type === "Body" ? "全身动作" : "手部特写"; refreshLib(); };
                ui.tabBody.onclick = () => switchLib("Body"); ui.tabHands.onclick = () => switchLib("Hands");
                const manageLibrary = (action, payload) => { fetch("/laoli/manage_library", { method: "POST", body: JSON.stringify({ action, libType: currentLibType, ...payload }) }).then(r => r.json()).then(res => { if(res.status === "success") refreshLib(); }); };

                const createPoseCard = (cat, p) => {
                    const c = document.createElement("div"); c.className="pose-card"; c.draggable = true;
                    c.innerHTML=`<img src="${p.thumbnail}" class="pose-img"><div class="pose-info">${p.name}</div><div class="tools"><span class="icon-btn" data-act="ren">✏️</span><span class="icon-btn" data-act="del">🗑️</span></div>`;
                    c.onclick=(e)=> { 
                        if(!e.target.dataset.act) { 
                            saveState(`Apply ${p.name}`);
                            if (currentLibType === "Hands") {
                                const sel = scene.currentBone; let targetSide = null;
                                if (sel) { if (sel.name.includes("Left")) targetSide = "Left"; else if (sel.name.includes("Right")) targetSide = "Right"; }
                                if (!targetSide) targetSide = p.data.meta && p.data.meta.side ? p.data.meta.side : "Right";
                                scene.applyPose({ meta: { source: "Laoli_Native", version: "2.0", type: "Hands", targetSide: targetSide, side: p.data.meta.side || "Right" }, body: p.data.body, hands: {} });
                                showToast(`✋ 已应用到 ${targetSide === 'Left' ? '左手' : '右手'}`, "#2e7d32");
                            } else { scene.applyPose(p.data); }
                            updateOutput(); 
                        } 
                    };
                    c.ondragstart = (e) => e.dataTransfer.setData("text", JSON.stringify({ cat: cat, name: p.name }));
                    c.querySelector('[data-act="ren"]').onclick = () => { const n = prompt("Rename:", p.name); if(n&&n!==p.name) manageLibrary('rename_pose', {category:cat, old:p.name, new:n}); };
                    c.querySelector('[data-act="del"]').onclick = () => { if(confirm("Delete Pose?")) manageLibrary('del_pose', {category:cat, name:p.name}); };
                    return c;
                };

                const renderLibrary = () => {
                    const lib = currentLibData;
                    const container = ui.poseLib;
                    container.innerHTML = "";
                    ui.saveCatSelect.innerHTML = "";
                    const cats = Object.keys(lib).sort();
                    cats.forEach(c => { const opt=document.createElement("option"); opt.value=c; opt.text=c; ui.saveCatSelect.appendChild(opt); });
                    
                    const isFullscreen = mainNodeContainer.classList.contains("fullscreen-mode");

                    if (isFullscreen) {
                        const wrapper = document.createElement("div"); wrapper.className = "fs-container";
                        const sidebar = document.createElement("div"); sidebar.className = "fs-sidebar";
                        const content = document.createElement("div"); content.className = "fs-content";
                        if (!cats.includes(activeCategory) && cats.length > 0) activeCategory = cats[0];
                        
                        cats.forEach(cat => {
                            const btn = document.createElement("div");
                            btn.className = `fs-folder-item ${cat === activeCategory ? 'active' : ''}`;
                            btn.innerHTML = `<span>📂 ${cat}</span><div class="fs-tools"><span data-act="ren_cat" class="laoli-btn">✏️</span><span data-act="del_cat" class="laoli-btn">🗑️</span></div>`;
                            btn.onclick = (e) => {
                                if(e.target.dataset.act) {
                                    if(e.target.dataset.act === "ren_cat") { const n = prompt("Rename:", cat); if(n&&n!==cat) manageLibrary('rename_cat', {old:cat, new:n}); }
                                    if(e.target.dataset.act === "del_cat") { if(confirm("Delete Category?")) manageLibrary('del_cat', {category:cat}); }
                                    return;
                                }
                                activeCategory = cat; renderLibrary();
                            };
                            btn.ondragover = e => { e.preventDefault(); btn.classList.add("active"); };
                            btn.ondrop = e => { e.preventDefault(); try { const d = JSON.parse(e.dataTransfer.getData("text")); if(d.cat!==cat) manageLibrary("move_pose", {src_category:d.cat, tgt_category:cat, name:d.name}); } catch(err){} };
                            sidebar.appendChild(btn);
                        });
                        
                        if (activeCategory && lib[activeCategory]) {
                            const grid = document.createElement("div"); grid.className = "pose-grid"; 
                            const sortedPoses = [...lib[activeCategory]].sort((a, b) => b.name.localeCompare(a.name));
                            sortedPoses.forEach(p => grid.appendChild(createPoseCard(activeCategory, p)));
                            content.appendChild(grid);
                        }
                        
                        wrapper.appendChild(sidebar); wrapper.appendChild(content); container.appendChild(wrapper);
                    } else {
                        cats.forEach(cat => {
                            const catDiv = document.createElement("div"); catDiv.className = "pose-category";
                            const header = document.createElement("div"); header.className = "cat-header";
                            header.innerHTML = `<span class="cat-title">${cat}</span><div class="tools"><span class="icon-btn" data-act="ren_cat">✏️</span><span class="icon-btn" data-act="del_cat">🗑️</span></div>`;
                            
                            const grid = document.createElement("div"); 
                            grid.className = "pose-grid expanded"; 
                            
                            if (lib[cat]) {
                                const sortedPoses = [...lib[cat]].sort((a, b) => b.name.localeCompare(a.name));
                                sortedPoses.forEach(p => grid.appendChild(createPoseCard(cat, p)));
                            }

                            header.onclick = (e) => { 
                                if(!e.target.dataset.act) {
                                    grid.style.display = (grid.style.display === "none") ? "grid" : "none";
                                } 
                            };
                            header.querySelector('[data-act="ren_cat"]').onclick = () => { const n = prompt("Rename:", cat); if(n&&n!==cat) manageLibrary('rename_cat', {old:cat, new:n}); };
                            header.querySelector('[data-act="del_cat"]').onclick = () => { if(confirm("Delete Category?")) manageLibrary('del_cat', {category:cat}); };
                            catDiv.ondragover = e => { e.preventDefault(); catDiv.classList.add("drag-over"); }; catDiv.ondragleave = () => catDiv.classList.remove("drag-over"); catDiv.ondrop = e => { e.preventDefault(); catDiv.classList.remove("drag-over"); try { const d = JSON.parse(e.dataTransfer.getData("text")); if(d.cat!==cat) manageLibrary("move_pose", {src_category:d.cat, tgt_category:cat, name:d.name}); } catch(err){} };
                            
                            catDiv.appendChild(header); 
                            catDiv.appendChild(grid); 
                            container.appendChild(catDiv);
                        });
                    }
                };
                
                if(ui.refreshLibBtn) ui.refreshLibBtn.onclick = refreshLib;
                refreshLib(); 
                
                if(ui.createCatBtn) ui.createCatBtn.onclick = () => { const n = prompt("New Category:"); if(n) manageLibrary('create_cat', { name:n }); };
                if(ui.importPoseBtn) ui.importPoseBtn.onclick = () => ui.fileInput && ui.fileInput.click();
                if(ui.fileInput) ui.fileInput.onchange = (e) => { const f = e.target.files[0]; if(f) { const r = new FileReader(); r.onload = (ev) => { scene.applyPose(JSON.parse(ev.target.result)); updateOutput(); }; r.readAsText(f); } };

                if(ui.saveBtnShow) ui.saveBtnShow.onclick = () => ui.saveModal.style.display="flex";
                if(ui.cancelSaveBtn) ui.cancelSaveBtn.onclick = () => ui.saveModal.style.display="none";
                if(ui.confirmSaveBtn) ui.confirmSaveBtn.onclick = () => {
                    const cat = ui.saveCatInput.style.display === "block" ? ui.saveCatInput.value : ui.saveCatSelect.value;
                    const name = ui.saveNameInput.value || "Pose";
                    if(!cat) return alert("请选择分类");
                    const activeChar = scene.activeCharacter; if(!activeChar) return;
                    const poseData = { body: {}, hands: {} };
                    if (currentLibType === "Hands") {
                        const sel = scene.currentBone; let saveSide = null;
                        if (sel) { if (sel.name.includes("Left")) saveSide = "Left"; else if (sel.name.includes("Right")) saveSide = "Right"; }
                        if (!saveSide) return alert("⚠️ 请先点击选中一只手，以便系统知道要保存哪只手！");
                        activeChar.bones.forEach(b => { const n = b.name; if ((n.includes("Hand") || n.includes("Finger") || n.includes("Thumb") || n.includes("Index") || n.includes("Middle") || n.includes("Ring") || n.includes("Pinky")) && n.includes(saveSide)) { poseData.body[n] = { q: b.quaternion.toArray() }; } });
                        const snap = scene.getSnapshot(512, 512, null, saveSide);
                        const finalJson = { meta: { source: "Laoli_Native", version: "2.0", type: "Hands", side: saveSide }, body: poseData.body, hands: {} };
                        fetch("/laoli/save_pose", { method:"POST", body:JSON.stringify({ libType: "Hands", category:cat, name, poseData:finalJson, image:snap.rgb }) }).then(()=>{ ui.saveModal.style.display="none"; refreshLib(); });
                    } else {
                        activeChar.bones.forEach(b => poseData.body[b.name] = { q: b.quaternion.toArray() });
                        const snap = scene.getSnapshot(768, 1024);
                        const finalJson = { meta: { source: "Laoli_Native", version: "2.0", type: "Body" }, body: poseData.body, hands: {} };
                        fetch("/laoli/save_pose", { method:"POST", body:JSON.stringify({ libType: "Body", category:cat, name, poseData:finalJson, image:snap.rgb }) }).then(()=>{ ui.saveModal.style.display="none"; refreshLib(); });
                    }
                };

                if(ui.helpBtn) ui.helpBtn.onclick = () => ui.helpModal.style.display = "flex";
                if(ui.closeHelpBtn) ui.closeHelpBtn.onclick = () => ui.helpModal.style.display = "none";
                if(ui.btns && ui.btns.resetBone) ui.btns.resetBone.onclick = () => { if(scene.currentBone) { if(scene.currentBone.userData.bindQ) scene.currentBone.quaternion.copy(scene.currentBone.userData.bindQ); else scene.currentBone.rotation.set(0,0,0); scene.selectBone(scene.currentBone); updateOutput(); } };
                
                if(ui.btns && ui.btns.full) ui.btns.full.onclick = () => { 
                    const isFull = mainNodeContainer.style.position === "fixed"; 
                    if (isFull) { 
                        mainNodeContainer.style.cssText = "display:flex; width:100%; height:100%; background:#222; position:relative; overflow:hidden; user-select:none;"; 
                        mainNodeContainer.classList.remove("fullscreen-mode");
                        ui.btns.full.innerText = "⛶"; ui.btns.full.style.background = "#1976d2"; 
                        if(ui.rightPanel) ui.rightPanel.style.width = "300px";
                        if (mainNodeContainer.parentNode === document.body) document.body.removeChild(mainNodeContainer); 
                        if (mainNodeContainer._placeholder && mainNodeContainer._placeholder.parentNode) mainNodeContainer._placeholder.parentNode.replaceChild(mainNodeContainer, mainNodeContainer._placeholder); 
                    } else { 
                        if (mainNodeContainer.parentNode) mainNodeContainer.parentNode.replaceChild(mainNodeContainer._placeholder, mainNodeContainer); 
                        document.body.appendChild(mainNodeContainer); 
                        mainNodeContainer.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:99999; background:#222; display:flex;"; 
                        mainNodeContainer.classList.add("fullscreen-mode");
                        ui.btns.full.innerText = "❌"; ui.btns.full.style.background = "#d32f2f"; 
                        if(ui.rightPanel) ui.rightPanel.style.width = "600px";
                    } 
                    refreshLib(); 
                    const r = mainNodeContainer.getBoundingClientRect(); 
                    if(scene.renderer && scene.camera) { scene.renderer.setSize(r.width, r.height); scene.camera.aspect = r.width/r.height; scene.camera.updateProjectionMatrix(); } 
                };
                
                LAOLI_INSTANCES[node.id] = { 
                    scene, 
                    updateOutput,
                    refreshLibrary: refreshLib
                };
            };
        }
    },
});