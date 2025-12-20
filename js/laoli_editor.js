import { app } from "../../scripts/app.js";
import * as THREE from "./three.module.js";
import { GLTFLoader } from "./GLTFLoader.js";
import { OrbitControls } from "./OrbitControls.js";
import { TransformControls } from "./TransformControls.js";

app.registerExtension({
    name: "Comfy.Laoli3DPoseEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Laoli_3DPoseEditor") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated?.apply(this, arguments);
                const node = this;

                // === 1. 隐藏 Widget 逻辑 ===
                const fixWidgets = () => {
                    const namesToHide = ["client_data", "pose_data"];
                    if (node.widgets) {
                        node.widgets.forEach(w => {
                            if (namesToHide.includes(w.name)) {
                                w.type = "converted-widget";
                                w.options = w.options || {};
                                w.options.hidden = true;
                                w.computeSize = () => [0, -4];
                                w.draw = () => {}; 
                                if (w.inputEl) { w.inputEl.style.display = "none"; w.inputEl.hidden = true; }
                            }
                        });
                    }
                };

                let clientWidget = node.widgets?.find(w => w.name === "client_data");
                if (!clientWidget) {
                    clientWidget = { name: "client_data", type: "STRING", value: "", options: { hidden: true } };
                    node.widgets = node.widgets || [];
                    node.widgets.push(clientWidget);
                }

                // === 2. 构建 DOM ===
                const container = document.createElement("div");
                container.id = "laoli-3d-container";
                container.style.cssText = "display:flex; width:100%; height:100%; background:#111; position:relative; overflow:hidden; user-select:none;";

                // 2.1 截图框选层
                const cropLayer = document.createElement("div");
                cropLayer.id = "cropLayer";
                cropLayer.style.cssText = "display:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index:2000; background:rgba(0,0,0,0.3); cursor:crosshair;";
                cropLayer.innerHTML = `
                    <div id="cropBox" style="position:absolute; width:300px; height:300px; border:2px solid #00e5ff; box-shadow:0 0 0 9999px rgba(0,0,0,0.7); min-width:50px; min-height:50px;">
                        <div id="cropHeader" style="width:100%; height:100%; cursor:move; position:absolute; top:0; left:0;"></div>
                        <div id="cropResize" style="position:absolute; bottom:-5px; right:-5px; width:15px; height:15px; background:#00e5ff; cursor:nwse-resize; border-radius:50%;"></div>
                        <div style="position:absolute; bottom:-35px; right:0; display:flex; gap:8px;">
                            <div style="background:rgba(0,0,0,0.8); color:#00e5ff; font-size:10px; padding:4px 8px; border-radius:4px; white-space:nowrap;">锁定比例中</div>
                            <button id="cropCancel" style="cursor:pointer; background:#d32f2f; color:white; border:none; border-radius:4px; padding:4px 10px; font-weight:bold;">✕ 取消</button>
                            <button id="cropConfirm" style="cursor:pointer; background:#2e7d32; color:white; border:none; border-radius:4px; padding:4px 10px; font-weight:bold;">✓ 确认输出</button>
                        </div>
                    </div>
                `;
                container.appendChild(cropLayer);

                // 2.2 顶部栏
                const topBar = document.createElement("div");
                topBar.style.cssText = "position:absolute; top:0; left:0; width:100%; height:40px; background:rgba(20,20,20,0.95); display:flex; align-items:center; justify-content:space-between; padding:0 10px; z-index:999; border-bottom:1px solid #333;";
                topBar.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="color:#00e5ff; font-weight:bold; font-size:14px;">🦴 V0.0.1 Fixed</div>
                        <select id="modelSelect" style="background:#333; color:#eee; border:1px solid #555; padding:2px 5px; border-radius:4px; max-width:120px; font-size:12px;"><option value="">Loading...</option></select>
                        <button id="addCharBtn" class="tool-btn" style="background:#2e7d32; color:white;" title="添加角色">➕</button>
                        <button id="delCharBtn" class="tool-btn" style="background:#c62828; color:white;" title="删除当前">🗑️</button>
                    </div>
                    <div style="display:flex; gap:6px;">
                         <button id="snapBtn" class="tool-btn" style="background:#f57c00; color:white;" title="框选截图">📷 截图</button>
                         <div style="width:1px; background:#555; margin:0 2px;"></div>
                         <button id="modeRotate" class="tool-btn active-mode" title="旋转 (R)">🔄</button>
                         <button id="modeScale" class="tool-btn" title="缩放 (S)">📏</button>
                         <div style="width:1px; background:#555; margin:0 2px;"></div>
                         <button id="helpBtn" class="tool-btn">❓</button>
                         <button id="fullscreenBtn" class="tool-btn" style="background:#1976d2; color:#fff;">⛶</button>
                    </div>
                    <style>
                        .tool-btn { cursor:pointer; background:#333; color:#bbb; border:1px solid #555; padding:4px 10px; border-radius:4px; font-size:12px; transition:0.2s; outline:none; }
                        .tool-btn:hover { background:#444; color:white; }
                        .active-mode { background:#2e7d32 !important; color:white !important; border-color:#2e7d32 !important; }
                        .mini-reset { cursor:pointer; color:#777; padding:0 6px; font-size:14px; transition:0.2s; user-select:none; }
                        .mini-reset:hover { color:#fff; transform:rotate(-90deg); }
                        .bone-item { padding:4px 8px; cursor:pointer; border-radius:4px; margin-bottom:2px; color:#ccc; display:flex; justify-content:space-between; border-left: 3px solid transparent; font-size:12px; }
                        .bone-item:hover { background:#333; color:white; }
                        .bone-item.selected { background:#1565c0; color:white; border-left: 3px solid #ffeb3b; }
                        #charBar { position: absolute; top: 45px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 1001; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 20px; backdrop-filter: blur(4px); border: 1px solid #444; }
                        .char-tab { cursor: pointer; background: rgba(255,255,255,0.1); color: #ccc; padding: 4px 10px; border-radius: 10px; font-size: 11px; transition: 0.2s; }
                        .char-tab:hover { background: #555; color: white; }
                        .char-tab.active { background: #00e5ff; color: #000; font-weight: bold; box-shadow: 0 0 8px rgba(0,229,255,0.5); }
                        .pose-category { margin-bottom: 8px; border:1px solid #333; border-radius:4px; background:#1a1a1a; overflow:hidden; transition:0.2s; }
                        .pose-category.drag-over { border-color:#00e5ff; background:#333; box-shadow:0 0 10px rgba(0,229,255,0.3); }
                        .pose-cat-header { display:flex; justify-content:space-between; align-items:center; background:#2a2a2a; padding:6px 8px; cursor:pointer; border-left:3px solid #ff9800; font-size:12px; font-weight:bold; color:#ddd; }
                        .pose-cat-header:hover { background:#333; }
                        .pose-list { display:none; grid-template-columns: 1fr; gap:6px; padding:6px; }
                        .pose-list.expanded { display:grid; }
                        .pose-card { position:relative; background:#000; border:1px solid #444; border-radius:4px; overflow:hidden; cursor:grab; transition:0.2s; }
                        .pose-card:active { cursor:grabbing; }
                        .pose-card:hover { border-color:#00e5ff; transform:translateY(-2px); box-shadow:0 4px 8px rgba(0,0,0,0.5); }
                        .pose-img { width:100%; aspect-ratio: 16/9; object-fit:cover; display:block; opacity:0.85; }
                        .pose-card:hover .pose-img { opacity:1; }
                        .pose-info { padding:4px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.8); position:absolute; bottom:0; width:100%; }
                        .pose-name { font-size:11px; color:#eee; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px; }
                        .cat-tools, .pose-tools { display:none; gap:6px; }
                        .pose-cat-header:hover .cat-tools, .pose-card:hover .pose-tools { display:flex; }
                        .icon-btn { padding:0 4px; font-size:11px; cursor:pointer; opacity:0.7; color:#fff; }
                        .icon-btn:hover { opacity:1; transform:scale(1.2); color:#00e5ff; }
                    </style>
                `;
                container.appendChild(topBar);

                const charBar = document.createElement("div"); charBar.id = "charBar"; container.appendChild(charBar);

                // 2.3 左侧 UI
                const uiDiv = document.createElement("div");
                uiDiv.style.cssText = "position:absolute; top:50px; left:10px; width:220px; bottom:10px; display:flex; flex-direction:column; gap:10px; pointer-events:none; z-index:1000;";
                uiDiv.innerHTML = `
                    <div style="background:rgba(25,25,25,0.95); border-radius:8px; border:1px solid #444; display:flex; flex-direction:column; height:100%; pointer-events:auto; overflow:hidden;">
                        <div style="padding:10px; background:#202020; border-bottom:1px solid #444;">
                            <div style="color:#888; font-size:10px;">当前编辑:</div>
                            <div id="activeCharDisplay" style="font-size:12px; color:#00e5ff; margin-bottom:5px;">无角色</div>
                            <div id="boneNameDisplay" style="font-size:16px; font-weight:bold; color:#ffeb3b;">未选择</div>
                        </div>
                        <div id="boneListContainer" style="flex:1; overflow-y:auto; padding:5px;"></div>
                        <div style="padding:8px 10px; background:#252525; border-top:1px solid #555; display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#ccc;">
                            <span>输出尺寸:</span>
                            <div style="display:flex; align-items:center; gap:5px;">
                                <input type="number" id="outWidth" value="1024" style="width:60px; background:#111; color:#fff; border:1px solid #444; border-radius:3px; padding:4px; text-align:center;">
                                <span>x</span>
                                <input type="number" id="outHeight" value="1024" style="width:60px; background:#111; color:#fff; border:1px solid #444; border-radius:3px; padding:4px; text-align:center;">
                            </div>
                        </div>
                        <div style="padding:10px; background:#333; border-top:1px solid #555;">
                            <div style="font-size:10px; color:#00e5ff; margin-bottom:5px;">🛠️ 全局位移 (Global)</div>
                            <div class="slider-row"><label style="color:#ff8a80">X</label><input type="range" id="manX" min="-5.0" max="5.0" step="0.1" value="0"><span class="mini-reset" data-axis="mx">↺</span></div>
                            <div class="slider-row"><label style="color:#82b1ff">Z</label><input type="range" id="manZ" min="-5.0" max="5.0" step="0.1" value="0"><span class="mini-reset" data-axis="mz">↺</span></div>
                            <div class="slider-row"><label style="color:#b9f6ca">Y</label><input type="range" id="manY" min="-2.0" max="2.0" step="0.1" value="0"><span class="mini-reset" data-axis="my">↺</span></div>
                            <div class="slider-row"><label style="color:#fff">S</label><input type="range" id="manScale" min="0.01" max="2.0" step="0.01" value="1"><span class="mini-reset" data-axis="ms">↺</span></div>
                        </div>
                        <div id="sliderGroup" style="padding:15px 10px; background:#202020; border-top:1px solid #444; opacity:0.5; pointer-events:none;">
                            <div class="slider-row"><label style="color:#ff5252">RX</label><input type="range" id="rotX" min="-3.14" max="3.14" step="0.1" value="0"><span class="mini-reset" data-axis="x">↺</span></div>
                            <div class="slider-row"><label style="color:#69f0ae">RY</label><input type="range" id="rotY" min="-3.14" max="3.14" step="0.1" value="0"><span class="mini-reset" data-axis="y">↺</span></div>
                            <div class="slider-row"><label style="color:#448aff">RZ</label><input type="range" id="rotZ" min="-3.14" max="3.14" step="0.1" value="0"><span class="mini-reset" data-axis="z">↺</span></div>
                            <div style="margin-top:15px; display:flex; gap:8px;">
                                <button id="resetBoneBtn" style="flex:1; background:#444; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer;">↺ 部位归位</button>
                                <button id="resetAllBtn" style="flex:1; background:#b71c1c; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer;">⚠️ 全身重置</button>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(uiDiv);

                // 2.4 右侧 UI
                const rightUI = document.createElement("div");
                rightUI.style.cssText = "position:absolute; top:50px; right:10px; width:240px; bottom:10px; display:flex; flex-direction:column; pointer-events:none; z-index:1000;";
                rightUI.innerHTML = `
                    <div style="background:rgba(25,25,25,0.95); border-radius:8px; border:1px solid #444; display:flex; flex-direction:column; height:100%; pointer-events:auto; overflow:hidden;">
                        <div style="padding:8px; background:#202020; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:12px; font-weight:bold; color:#ddd;">📚 动作库</span>
                            <div style="display:flex; gap:4px;">
                                <button id="refreshLibBtn" style="font-size:12px; background:#333; color:white; border:none; padding:4px 6px; cursor:pointer; border-radius:3px;" title="刷新列表">🔄</button>
                                <button id="createCatBtn" style="font-size:11px; background:#333; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius:3px;">📁 新建</button>
                            </div>
                        </div>
                        <div style="padding:4px; display:flex; gap:4px; background:#222; border-bottom:1px solid #444;">
                             <button id="importPoseBtn" style="flex:1; font-size:11px; background:#444; color:white; border:none; padding:4px 0; cursor:pointer; border-radius:3px;">📥 导入</button>
                             <button id="saveBtnShow" style="flex:1; font-size:11px; background:#f57c00; color:white; border:none; padding:4px 0; cursor:pointer; border-radius:3px;">💾 保存</button>
                        </div>
                        <div id="poseLibraryContainer" style="flex:1; overflow-y:auto; padding:6px;"></div>
                        <input type="file" id="poseFileInput" accept=".json" style="display:none;" />
                    </div>
                `;
                container.appendChild(rightUI);

                // 2.5 弹窗
                const saveModal = document.createElement("div");
                saveModal.id = "saveModal";
                saveModal.style.cssText = "display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:3000; align-items:center; justify-content:center; backdrop-filter:blur(2px);";
                saveModal.innerHTML = `
                    <div style="background:#2a2a2a; width:300px; padding:20px; border-radius:8px; border:1px solid #555; color:#eee; box-shadow:0 10px 30px #000;">
                        <h3 style="margin:0 0 15px 0; color:#ff9800;">💾 保存动作</h3>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:12px;color:#aaa;">分类:</label>
                            <div style="display:flex; gap:5px; margin-top:5px;">
                                <select id="saveCatSelect" style="flex:1; background:#111; color:#eee; border:1px solid #444; padding:4px; border-radius:4px;"></select>
                            </div>
                            <input id="saveCatInput" type="text" placeholder="新分类..." style="width:100%; margin-top:5px; background:#111; color:#fff; border:1px solid #444; padding:4px; border-radius:4px; display:none;">
                            <div style="text-align:right; margin-top:2px;"><a id="toggleCatInput" style="font-size:10px; color:#2196f3; cursor:pointer;">✏️ 手动输入</a></div>
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="font-size:12px;color:#aaa;">名称:</label>
                            <input id="saveNameInput" type="text" value="NewPose" style="width:100%; margin-top:5px; background:#111; color:#fff; border:1px solid #444; padding:4px; border-radius:4px;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:10px;">
                            <button id="cancelSaveBtn" style="padding:5px 15px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;">取消</button>
                            <button id="confirmSaveBtn" style="padding:5px 15px; background:#2e7d32; color:#fff; border:none; border-radius:4px; cursor:pointer;">保存</button>
                        </div>
                    </div>
                `;
                container.appendChild(saveModal);

                // === 详细版使用指南 ===
                const helpModal = document.createElement("div");
                helpModal.style.cssText = "display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:4000; align-items:center; justify-content:center; backdrop-filter:blur(5px);";
                helpModal.innerHTML = `
                    <div style="background:#1e1e1e; width:800px; padding:0; border-radius:12px; border:1px solid #444; color:#eee; font-family:'Microsoft YaHei'; max-height:85vh; overflow-y:auto; box-shadow:0 30px 60px rgba(0,0,0,0.8);">
                        <div style="padding:20px; background:#252525; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                            <h2 style="margin:0; color:#00e5ff; font-size:20px;">📖 Laoli3D 使用指南</h2>
                            <button id="closeHelpBtn" style="background:none; border:none; color:#888; font-size:24px; cursor:pointer;">&times;</button>
                        </div>
                        <div style="padding:30px; display:grid; grid-template-columns: 1fr 1fr; gap:40px;">
                            <div>
                                <h3 style="color:#ffea00; margin-bottom:15px; border-left:4px solid #ffea00; padding-left:10px;">🖱️ 基础操作</h3>
                                <ul style="line-height:1.8; color:#ccc; font-size:13px; padding-left:20px;">
                                    <li><b>左键 (蒙皮)</b>：自动选中最近骨骼并<span style="color:#ffea00">高亮显示</span>。</li>
                                    <li><b>左键 (空白)</b>：旋转视角。</li>
                                    <li><b>右键</b>：平移视角。</li>
                                    <li><b>滚轮</b>：缩放视角。</li>
                                    <li><b>拖拽圆环</b>：调节骨骼角度。</li>
                                </ul>
                                <h3 style="color:#2196f3; margin-top:25px; margin-bottom:15px; border-left:4px solid #2196f3; padding-left:10px;">⌨️ 快捷键</h3>
                                <ul style="line-height:1.8; color:#ccc; font-size:13px; padding-left:20px;">
                                    <li><kbd style="background:#333;padding:2px 6px;border-radius:4px">R</kbd> 旋转 <kbd>S</kbd> 缩放 <kbd>W</kbd> 移动。</li>
                                    <li><kbd>↑↓←→</kbd> 微调骨骼旋转。</li>
                                </ul>
                            </div>
                            <div>
                                <h3 style="color:#4caf50; margin-bottom:15px; border-left:4px solid #4caf50; padding-left:10px;">📷 截图与输出</h3>
                                <div style="background:rgba(76,175,80,0.1); padding:10px; border-radius:4px; margin-bottom:15px; border:1px solid #4caf50;">
                                    <p style="margin:0; font-size:13px; color:#fff; line-height:1.6;">
                                        🆕 <b>高清框选截图</b>：<br>
                                        点击上方橙色 <b>截图</b> 按钮，即可进入框选模式。该模式下截图框会自动锁定为您设置的输出比例 (1024x1024等)，确保所见即所得，无拉伸，无黑边。
                                    </p>
                                </div>
                                <h3 style="color:#9c27b0; margin-top:25px; margin-bottom:15px; border-left:4px solid #9c27b0; padding-left:10px;">💾 自定义模型</h3>
                                <ul style="line-height:1.8; color:#ccc; font-size:13px; padding-left:20px;">
                                    <li><b>自动识别新模型</b>：请自行网络下载自己喜欢角色的glb模型文件存入本插件js\assests文件夹中。推荐一个网站 https://readyplayer.me/zh/avatar</li>
                                </ul>
                            </div>
                        </div>
                        <div style="padding:20px; background:#252525; text-align:center;">
                            <button id="knowBtn" style="padding:10px 40px; background:#1976d2; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">我学会了</button>
                        </div>
                    </div>
                `;
                container.appendChild(helpModal);

                node.addDOMWidget("3d_canvas", "canvas", container, { serialize: false });
                node.setSize([1000, 650]);
                const placeholder = document.createElement("div");
                placeholder.style.cssText = "width:100%; height:100%; background:#111; display:flex; align-items:center; justify-content:center; color:#555; font-size:14px;";
                placeholder.innerText = "全屏模式...";
                
                // === 3. 初始化：确保DOM已挂载 ===
                container.editorData = { node, clientWidget, placeholder, helpModal, saveModal };
                
                requestAnimationFrame(() => {
                    fixWidgets(); 
                    initLaoli3D(container);
                });
            };
        }
    },
});

const BONE_DICT = { "HeadTop": "头顶", "Head": "头部", "Neck": "脖子", "Hips": "盆骨", "Pelvis": "盆骨", "Root": "根骨", "Spine3": "胸椎", "Spine2": "脊柱上", "Spine1": "脊柱中", "Spine": "脊柱", "UpperChest": "上胸", "Chest": "胸部", "Shoulder": "肩膀", "Clavicle": "锁骨", "UpArm": "大臂", "UpperArm": "大臂", "Arm": "大臂", "ForeArm": "小臂", "Forearm": "小臂", "LowerArm": "小臂", "Hand": "手掌", "HandThumb": "拇指", "Thumb": "拇指", "HandIndex": "食指", "Index": "食指", "HandMiddle": "中指", "Middle": "中指", "HandRing": "无名指", "Ring": "无名指", "HandPinky": "小指", "Pinky": "小指", "Little": "小指", "UpLeg": "大腿", "Thigh": "大腿", "LowerLeg": "小腿", "Calf": "小腿", "Leg": "小腿", "Foot": "脚掌", "Toe": "脚趾", "Toes": "脚趾" };

function translateBone(name) {
    let clean = name.replace(/mixamorig:|skeleton:|anim_00|:|J_Bip_C_|Bip001_/gi, "");
    let side = "";
    if (/Left|L_|L\b|_L/.test(clean)) { side = "左-"; clean = clean.replace(/Left|L_|L\b|_L/g, ""); }
    else if (/Right|R_|R\b|_R/.test(clean)) { side = "右-"; clean = clean.replace(/Right|R_|R\b|_R/g, ""); }
    let baseName = clean.replace(/^L(?=[A-Z])/, "").replace(/^R(?=[A-Z])/, "");
    const sortedKeys = Object.keys(BONE_DICT).sort((a, b) => b.length - a.length);
    let cnName = baseName;
    for(const k of sortedKeys) { if(baseName.toLowerCase().includes(k.toLowerCase())) { cnName = BONE_DICT[k]; break; } }
    if (["拇指","食指","中指","无名指","小指"].some(f => cnName.includes(f))) { if(name.match(/1$|1_|_01/)) cnName += "(根)"; else if(name.match(/2$|2_|_02/)) cnName += "(中)"; else if(name.match(/3$|3_|_03/)) cnName += "(尖)"; }
    return { full: side + cnName, name: cnName };
}

function initLaoli3D(container) {
    if (container.dataset.initialized === "true") return;
    container.dataset.initialized = "true";
    const { node, clientWidget, placeholder, helpModal, saveModal } = container.editorData;

    // Scene
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x222222);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000); camera.position.set(0, 1.5, 4.0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("tabindex", "1");
    renderer.domElement.style.outline = "none";
    
    const orbit = new OrbitControls(camera, renderer.domElement); 
    orbit.target.set(0, 1.0, 0); 
    orbit.update();

    function animate() { requestAnimationFrame(animate); orbit.update(); renderer.render(scene, camera); }
    animate();

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
            }
        }
    });
    resizeObserver.observe(container);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); scene.add(ambientLight);
    const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(2, 5, 5); scene.add(dl);
    const bl = new THREE.DirectionalLight(0xaaddff, 0.8); bl.position.set(-2, 3, -5); scene.add(bl);
    const grid = new THREE.GridHelper(20, 20, 0x666666, 0x333333); scene.add(grid);

    let transformControl;
    requestAnimationFrame(() => {
        if(renderer && renderer.domElement) {
            try {
                transformControl = new TransformControls(camera, renderer.domElement);
                transformControl.setMode("rotate"); transformControl.setSize(0.8); scene.add(transformControl); 
                transformControl.addEventListener('dragging-changed', (event) => { orbit.enabled = !event.value; });
                transformControl.addEventListener('change', () => { if(currentBone) updateSliders(); updateOutput(); });
            } catch (e) { console.warn("Laoli3D Warning:", e); }
        }
    });

    const boneMarker = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest:false, transparent:true, opacity:0.8 }));
    boneMarker.visible = false; boneMarker.renderOrder = 999; scene.add(boneMarker);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let mouseDownPos = new THREE.Vector2();
    let characters = [], activeCharacter = null, currentBone = null;
    let existingCategories = [];

    // === UI Elements Binding ===
    const ui = {
        charBar: container.querySelector("#charBar"),
        charName: container.querySelector("#activeCharDisplay"),
        name: container.querySelector("#boneNameDisplay"),
        list: container.querySelector("#boneListContainer"),
        sliderGroup: container.querySelector("#sliderGroup"),
        manScale: container.querySelector("#manScale"),
        manX: container.querySelector("#manX"), manY: container.querySelector("#manY"), manZ: container.querySelector("#manZ"),
        rx: container.querySelector("#rotX"), ry: container.querySelector("#rotY"), rz: container.querySelector("#rotZ"),
        outW: container.querySelector("#outWidth"),
        outH: container.querySelector("#outHeight"),
        modelSelect: container.querySelector("#modelSelect"),
        addBtn: container.querySelector("#addCharBtn"), delBtn: container.querySelector("#delCharBtn"),
        snapBtn: container.querySelector("#snapBtn"),
        cropLayer: container.querySelector("#cropLayer"), 
        cropBox: container.querySelector("#cropBox"),     
        cropHeader: container.querySelector("#cropHeader"), 
        cropResize: container.querySelector("#cropResize"), 
        cropCancel: container.querySelector("#cropCancel"),
        cropConfirm: container.querySelector("#cropConfirm"),
        poseLib: container.querySelector("#poseLibraryContainer"),
        refreshLibBtn: container.querySelector("#refreshLibBtn"),
        saveBtnShow: container.querySelector("#saveBtnShow"),
        createCatBtn: container.querySelector("#createCatBtn"),
        importPoseBtn: container.querySelector("#importPoseBtn"),
        fileInput: container.querySelector("#poseFileInput"),
        saveCatSelect: saveModal.querySelector("#saveCatSelect"),
        saveCatInput: saveModal.querySelector("#saveCatInput"),
        saveNameInput: saveModal.querySelector("#saveNameInput"),
        toggleCatInput: saveModal.querySelector("#toggleCatInput"),
        cancelSaveBtn: saveModal.querySelector("#cancelSaveBtn"),
        confirmSaveBtn: saveModal.querySelector("#confirmSaveBtn"),
        btns: { rot: container.querySelector("#modeRotate"), scale: container.querySelector("#modeScale"), full: container.querySelector("#fullscreenBtn"), help: container.querySelector("#helpBtn"), closeHelp: container.querySelector("#closeHelpBtn"), resetBone: container.querySelector("#resetBoneBtn"), resetAll: container.querySelector("#resetAllBtn"), knowBtn: container.querySelector("#knowBtn") },
        miniResets: container.querySelectorAll(".mini-reset")
    };

    // 绑定帮助弹窗关闭事件
    if(ui.btns.closeHelp) ui.btns.closeHelp.onclick = () => helpModal.style.display = "none";
    if(ui.btns.knowBtn) ui.btns.knowBtn.onclick = () => helpModal.style.display = "none";
    
    // === 截图框逻辑 (升级版：锁定比例 + 视口偏移) ===
    let isCropping = false;
    
    // 初始化截图框：根据输出比例设置初始大小
    function resetCropBox() {
        const outW = parseInt(ui.outW.value) || 1024;
        const outH = parseInt(ui.outH.value) || 1024;
        const aspect = outW / outH;
        
        const containerH = container.clientHeight;
        const initH = containerH * 0.6; 
        const initW = initH * aspect;
        
        ui.cropBox.style.width = initW + "px";
        ui.cropBox.style.height = initH + "px";
        ui.cropBox.style.left = "50%";
        ui.cropBox.style.top = "50%";
        ui.cropBox.style.transform = "translate(-50%, -50%)";
    }

    ui.snapBtn.onclick = () => {
        isCropping = true;
        resetCropBox();
        ui.cropLayer.style.display = "block";
    };
    ui.cropCancel.onclick = () => {
        isCropping = false;
        ui.cropLayer.style.display = "none";
    };
    ui.cropConfirm.onclick = () => {
        updateOutput(true); // 传入 true 表示启用裁切模式
        isCropping = false;
        ui.cropLayer.style.display = "none";
    };

    // 拖拽移动
    let isDraggingBox = false, dragOffset = {x:0, y:0};
    ui.cropHeader.addEventListener("mousedown", (e) => {
        isDraggingBox = true;
        const rect = ui.cropBox.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        e.stopPropagation();
    });

    // 拖拽缩放 (锁定比例)
    let isResizing = false;
    let startX = 0, startW = 0;
    ui.cropResize.addEventListener("mousedown", (e) => {
        isResizing = true;
        startX = e.clientX;
        startW = ui.cropBox.offsetWidth;
        e.stopPropagation();
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        if (isDraggingBox) {
            const containerRect = container.getBoundingClientRect();
            let left = e.clientX - dragOffset.x - containerRect.left;
            let top = e.clientY - dragOffset.y - containerRect.top;
            
            ui.cropBox.style.left = left + "px";
            ui.cropBox.style.top = top + "px";
            ui.cropBox.style.transform = "none"; // 移除居中变换
        }
        else if (isResizing) {
            const dx = e.clientX - startX;
            let newW = Math.max(50, startW + dx);
            
            // === 核心修复：强制锁定宽高比 ===
            const outW = parseInt(ui.outW.value) || 1024;
            const outH = parseInt(ui.outH.value) || 1024;
            const aspect = outW / outH;
            
            let newH = newW / aspect;
            
            ui.cropBox.style.width = newW + "px";
            ui.cropBox.style.height = newH + "px";
        }
    });

    window.addEventListener("mouseup", () => { isDraggingBox = false; isResizing = false; });
    ui.cropBox.addEventListener("mousedown", e => e.stopPropagation()); 

    // 加载逻辑
    fetch("/laoli/get_models").then(r => r.json()).then(files => {
        ui.modelSelect.innerHTML = "";
        if (!files || files.length === 0) { ui.modelSelect.innerHTML = "<option>无模型</option>"; return; }
        files.forEach(f => { const opt = document.createElement("option"); opt.value = f; opt.text = f; ui.modelSelect.appendChild(opt); });
        
        const savedState = tryParseState();
        if (savedState && savedState.characters && savedState.characters.length > 0) {
            restoreScene(savedState);
        } else {
            loadModel(files[0]);
        }
    }).catch(err => { console.error(err); ui.modelSelect.innerHTML = "<option>加载失败</option>"; });

    function tryParseState() {
        try {
            if(clientWidget && clientWidget.value) {
                const data = JSON.parse(clientWidget.value);
                if(data.sceneState) return data.sceneState;
            }
        } catch(e) {}
        return null;
    }

    async function restoreScene(state) {
        if(state.outW) ui.outW.value = state.outW;
        if(state.outH) ui.outH.value = state.outH;
        for (const charInfo of state.characters) {
            await new Promise(resolve => {
                loadModel(charInfo.modelName, (char) => {
                    if(charInfo.pos) char.group.position.set(...charInfo.pos);
                    if(charInfo.scale) char.group.scale.setScalar(charInfo.scale);
                    if(charInfo.pose) {
                        for(const [bName, rot] of Object.entries(charInfo.pose)) {
                            const bone = char.bones.find(b => b.name === bName);
                            if(bone && rot.r) bone.rotation.set(...rot.r);
                        }
                    }
                    resolve();
                });
            });
        }
        updateOutput(); 
    }

    ui.addBtn.onclick = () => { if(ui.modelSelect.value) loadModel(ui.modelSelect.value); };
    ui.delBtn.onclick = () => { if (activeCharacter) removeCharacter(activeCharacter); };
    
    ui.outW.onchange = () => updateOutput();
    ui.outH.onchange = () => updateOutput();

    function loadModel(filename, callback) {
        const url = `/extensions/Laoli3D/assets/${filename}`;
        fetch(url).then(res => res.arrayBuffer()).then(buffer => {
            new GLTFLoader().parse(buffer, "", (gltf) => {
                const raw = gltf.scene;
                const cid = Date.now() + Math.random();
                const grp = new THREE.Group(); grp.userData.charId = cid; scene.add(grp);
                raw.position.set(0,0,0); grp.add(raw);
                const charData = { id: cid, name: filename, group: grp, bones: [], meshes: [], helper: null };
                raw.traverse(o => {
                    o.userData.charId = cid;
                    if (o.isSkinnedMesh) { o.frustumCulled = false; if (o.material) o.material.skinning = true; charData.meshes.push(o); }
                    if (o.isBone && !o.name.includes("End")) { if (!o.userData.initial) o.userData.initial = { rot: o.rotation.clone() }; charData.bones.push(o); }
                });
                
                grp.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(grp);
                let sc = 1.0; const size = new THREE.Vector3(); box.getSize(size);
                if (size.y > 100) sc = 0.01; else if (size.y > 0.5 && size.y < 5) sc = 1.8 / size.y;
                grp.scale.set(sc, sc, sc);
                const center = new THREE.Vector3(); box.getCenter(center);
                grp.position.set(-center.x + (characters.length * 0.8), -box.min.y * sc, -center.z);
                
                const helper = new THREE.SkeletonHelper(raw); scene.add(helper); charData.helper = helper;
                characters.push(charData); activateCharacter(charData); updateCharBar(); 
                if (callback) callback(charData); else updateOutput();
            });
        }).catch(err => console.error("Model load failed:", err));
    }

    function updateCharBar() {
        ui.charBar.innerHTML = "";
        characters.forEach((c, i) => {
            const btn = document.createElement("div"); btn.className = "char-tab"; if (c === activeCharacter) btn.classList.add("active");
            btn.innerText = `${c.name.split('.')[0]} #${i + 1}`; btn.onclick = () => activateCharacter(c);
            ui.charBar.appendChild(btn);
        });
    }

    function removeCharacter(c) {
        scene.remove(c.group); scene.remove(c.helper); characters = characters.filter(x => x.id !== c.id);
        if(transformControl) transformControl.detach();
        boneMarker.visible = false;
        if (characters.length > 0) activateCharacter(characters[characters.length-1]);
        else { activeCharacter = null; ui.charName.innerText = "无角色"; ui.list.innerHTML = ""; ui.charBar.innerHTML = ""; }
        updateOutput();
    }

    function activateCharacter(c) {
        if (activeCharacter === c) return; activeCharacter = c;
        ui.charName.innerText = c.name; ui.list.innerHTML = "";
        ui.manScale.value = c.group.scale.x; ui.manX.value = c.group.position.x; ui.manY.value = c.group.position.y; ui.manZ.value = c.group.position.z;
        c.bones.forEach(b => {
            const info = translateBone(b.name);
            const div = document.createElement("div"); div.className = "bone-item"; div.innerText = info.full; div.dataset.uuid = b.uuid;
            div.onclick = () => selectBone(b); ui.list.appendChild(div);
        });
        characters.forEach(ch => { const active = (ch === c); ch.helper.material.opacity = active ? 1 : 0.2; ch.helper.material.transparent = !active; ch.helper.material.depthTest = false; });
        selectBone(null); updateCharBar();
    }

    renderer.domElement.addEventListener("pointerdown", e => mouseDownPos.set(e.clientX, e.clientY));
    renderer.domElement.addEventListener("pointerup", e => {
        if (Math.abs(e.clientX - mouseDownPos.x) > 2 || isCropping) return; 
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        let all = []; characters.forEach(c => all.push(...c.meshes));
        const hits = raycaster.intersectObjects(all);
        if (hits.length > 0) { 
            const char = characters.find(c => c.id === hits[0].object.userData.charId); 
            if (char) {
                if (char !== activeCharacter) activateCharacter(char);
                let bestBone = null; let minDist = Infinity; const hitPoint = hits[0].point;
                char.bones.forEach(b => {
                    const bPos = new THREE.Vector3(); b.getWorldPosition(bPos);
                    const d = hitPoint.distanceTo(bPos);
                    if (d < minDist) { minDist = d; bestBone = b; }
                });
                if (bestBone && minDist < 0.2) selectBone(bestBone);
            }
        } else { selectBone(null); }
    });

    function selectBone(b) {
        currentBone = b;
        ui.list.querySelectorAll(".selected").forEach(e => e.classList.remove("selected"));
        if (b && activeCharacter) {
            if(transformControl) {
                transformControl.detach(); transformControl.attach(b); transformControl.setSize(0.8 / activeCharacter.group.scale.x);
                if (b.name.match(/Hips|Pelvis/i)) { if(transformControl.mode==='scale') setMode('rotate'); } else setMode('rotate');
            }
            boneMarker.position.setFromMatrixPosition(b.matrixWorld); boneMarker.visible = true;
            const info = translateBone(b.name); ui.name.innerText = info.full;
            ui.sliderGroup.style.opacity = "1"; ui.sliderGroup.style.pointerEvents = "auto";
            updateSliders();
            const item = ui.list.querySelector(`div[data-uuid='${b.uuid}']`); if(item) { item.classList.add("selected"); item.scrollIntoView({block:"center"}); }
        } else {
            if(transformControl) transformControl.detach();
            boneMarker.visible = false;
            ui.name.innerText = "未选择"; ui.sliderGroup.style.opacity = "0.5"; ui.sliderGroup.style.pointerEvents = "none";
        }
    }

    // === 核心：输出与裁切逻辑 (修正版：使用 setViewOffset 替代 Scissor) ===
    function updateOutput(doCrop = false) {
        const prevBone = currentBone; 
        if(transformControl) transformControl.detach(); 
        boneMarker.visible = false; grid.visible = false;
        characters.forEach(c => c.helper.visible = false);

        // 获取目标分辨率
        let outW = parseInt(ui.outW.value) || 1024;
        let outH = parseInt(ui.outH.value) || 1024;
        const canvasRect = renderer.domElement.getBoundingClientRect();
        const canvasW = canvasRect.width;
        const canvasH = canvasRect.height;
        
        // 设置渲染尺寸为输出尺寸
        renderer.setSize(outW, outH);

        if (doCrop) {
            const cropRect = ui.cropBox.getBoundingClientRect();
            // 计算裁切框相对于 Canvas 的坐标和尺寸
            const relX = cropRect.left - canvasRect.left;
            const relY = cropRect.top - canvasRect.top;
            const relW = cropRect.width;
            const relH = cropRect.height;
            
            // 使用 setViewOffset 实现"变焦"效果
            const fullW = outW * (canvasW / relW);
            const fullH = outH * (canvasH / relH);
            const offX = outW * (relX / relW);
            const offY = outH * (relY / relH);

            camera.setViewOffset(fullW, fullH, offX, offY, outW, outH);
        } else {
            camera.clearViewOffset();
        }

        // 渲染 RGB (背景自动填充 Scene Background)
        renderer.render(scene, camera);
        const rgb = renderer.domElement.toDataURL("image/png");

        const oldFar = camera.far; camera.far = 6.0; camera.updateProjectionMatrix();
        scene.overrideMaterial = new THREE.MeshDepthMaterial();
        renderer.render(scene, camera);
        const depth = renderer.domElement.toDataURL("image/png");
        camera.far = oldFar; camera.updateProjectionMatrix();

        scene.overrideMaterial = new THREE.MeshNormalMaterial();
        renderer.render(scene, camera);
        const normal = renderer.domElement.toDataURL("image/png");
        
        scene.overrideMaterial = null; scene.background = new THREE.Color(0x000000); 
        characters.forEach(c => { 
            c.meshes.forEach(m => m.visible = false);
            if(c.helper) {
                if (c.group) c.group.updateMatrixWorld(true);
                if (c.helper && typeof c.helper.update === 'function') c.helper.update();
                c.helper.visible = true; c.helper.material.linewidth = 3; c.helper.material.color.set(0xffffff);
                c.helper.material.depthTest = false; c.helper.material.transparent = true; c.helper.material.opacity = 1.0;
            }
        }); 
        renderer.render(scene, camera);
        const poseImg = renderer.domElement.toDataURL("image/png");

        // 恢复现场
        camera.clearViewOffset(); // 清除偏移，恢复正常视图
        scene.background = new THREE.Color(0x222222); grid.visible = true; 
        characters.forEach(c => { 
            c.meshes.forEach(m => m.visible = true);
            if(c.helper) {
                c.helper.visible = (c === activeCharacter);
                c.helper.material.depthTest = false; c.helper.material.transparent = !(c === activeCharacter); c.helper.material.opacity = (c === activeCharacter) ? 1 : 0.2;
            }
        }); 
        
        if(prevBone) selectBone(prevBone);
        renderer.setSize(canvasW, canvasH); // 恢复 Canvas 视觉大小

        const sceneState = {
            outW, outH,
            characters: characters.map(c => ({
                modelName: c.name,
                pos: [c.group.position.x, c.group.position.y, c.group.position.z],
                scale: c.group.scale.x,
                pose: (() => { const p = {}; c.bones.forEach(b => p[b.name] = {r: [b.rotation.x, b.rotation.y, b.rotation.z]}); return p; })()
            }))
        };
        const activePose = {}; if(activeCharacter) activeCharacter.bones.forEach(b => activePose[b.name] = {r:[b.rotation.x, b.rotation.y, b.rotation.z]});
        if(clientWidget) clientWidget.value = JSON.stringify({ rgb, depth, normal, pose_img: poseImg, pose_data: activePose, sceneState: sceneState });
    }

    [ui.rx, ui.ry, ui.rz].forEach(el => { el.oninput = () => { if(currentBone) currentBone.rotation.set(parseFloat(ui.rx.value), parseFloat(ui.ry.value), parseFloat(ui.rz.value)); }; });
    ui.manScale.oninput = (e) => { if(activeCharacter) activeCharacter.group.scale.setScalar(parseFloat(e.target.value)); };
    ui.manX.oninput = (e) => { if(activeCharacter) activeCharacter.group.position.x = parseFloat(e.target.value); };
    ui.manY.oninput = (e) => { if(activeCharacter) activeCharacter.group.position.y = parseFloat(e.target.value); };
    ui.manZ.oninput = (e) => { if(activeCharacter) activeCharacter.group.position.z = parseFloat(e.target.value); };
    
    function updateSliders() { if(!currentBone) return; ui.rx.value = currentBone.rotation.x; ui.ry.value = currentBone.rotation.y; ui.rz.value = currentBone.rotation.z; const worldPos = new THREE.Vector3(); currentBone.getWorldPosition(worldPos); boneMarker.position.copy(worldPos); }
    ui.btns.resetBone.onclick = () => { if(currentBone && currentBone.userData.initial) { currentBone.rotation.copy(currentBone.userData.initial.rot); updateSliders(); updateOutput(); } };
    ui.btns.resetAll.onclick = () => { if(activeCharacter) { activeCharacter.bones.forEach(b => { if(b.userData.initial) b.rotation.copy(b.userData.initial.rot); }); updateSliders(); updateOutput(); } };

    refreshLibrary();
    function refreshLibrary() {
        fetch(`/laoli/get_library?t=${Date.now()}`).then(r=>r.json()).then(lib => {
            ui.poseLib.innerHTML = ""; existingCategories = Object.keys(lib);
            ui.saveCatSelect.innerHTML = "";
            existingCategories.forEach(c => { const opt=document.createElement("option"); opt.value=c; opt.text=c; ui.saveCatSelect.appendChild(opt); });
            if(!existingCategories.length) { ui.poseLib.innerHTML="<div style='color:#666;text-align:center;padding:10px;'>暂无动作</div>"; return; }
            for(const [cat, poses] of Object.entries(lib)) {
                const catDiv = document.createElement("div"); catDiv.className = "pose-category";
                const header = document.createElement("div"); header.className = "pose-cat-header";
                header.innerHTML = `<span>${cat}</span><div class="cat-tools"><span class="icon-btn" data-act="rename_cat">✏️</span><span class="icon-btn" data-act="del_cat">🗑️</span></div>`;
                header.onclick = (e) => { if(!e.target.dataset.act) list.classList.toggle('expanded'); };
                header.ondragover = (e) => { e.preventDefault(); catDiv.classList.add("drag-over"); };
                header.ondragleave = () => catDiv.classList.remove("drag-over");
                header.ondrop = (e) => { e.preventDefault(); catDiv.classList.remove("drag-over"); const data = JSON.parse(e.dataTransfer.getData("text")); if(data.cat !== cat) manageLibrary("move_pose", { src_category: data.cat, tgt_category: cat, name: data.name }); };
                header.querySelector('[data-act="rename_cat"]').onclick = () => { const n = prompt("重命名分类:", cat); if(n&&n!==cat) manageLibrary('rename_cat',{old:cat,new:n}); };
                header.querySelector('[data-act="del_cat"]').onclick = () => { if(confirm("删除分类?")) manageLibrary('del_cat',{category:cat}); };
                const list = document.createElement("div"); list.className = "pose-list expanded";
                poses.forEach(p => {
                    const card = document.createElement("div"); card.className = "pose-card"; card.draggable = true;
                    card.innerHTML = `<img class="pose-img" src="${p.thumbnail||''}"><div class="pose-info"><div class="pose-name">${p.name}</div><div class="pose-tools"><span class="icon-btn" data-act="ren">✏️</span><span class="icon-btn" data-act="del">🗑️</span></div></div>`;
                    card.ondragstart = (e) => e.dataTransfer.setData("text", JSON.stringify({ cat: cat, name: p.name }));
                    card.onclick = (e) => { if(!e.target.dataset.act) applyPose(p.data); };
                    card.querySelector('[data-act="ren"]').onclick = () => { const n=prompt("重命名:",p.name); if(n&&n!==p.name) manageLibrary('rename_pose',{category:cat,old:p.name,new:n}); };
                    card.querySelector('[data-act="del"]').onclick = () => { if(confirm("删除?")) manageLibrary('del_pose',{category:cat,name:p.name}); };
                    list.appendChild(card);
                });
                catDiv.appendChild(header); catDiv.appendChild(list); ui.poseLib.appendChild(catDiv);
            }
        });
    }

    function manageLibrary(action, payload) { fetch("/laoli/manage_library", { method: "POST", body: JSON.stringify({ action, ...payload }) }).then(r => r.json()).then(res => { if(res.status === "success") refreshLibrary(); else alert(res.message); }); }
    ui.refreshLibBtn.onclick = () => refreshLibrary();
    ui.createCatBtn.onclick = () => { const n = prompt("新分类名称:"); if(n) manageLibrary('create_cat', { name: n }); };
    ui.saveBtnShow.onclick = () => { if(!activeCharacter) return alert("请先选择角色"); saveModal.style.display="flex"; };
    ui.cancelSaveBtn.onclick = () => saveModal.style.display="none";
    ui.toggleCatInput.onclick = () => { if(ui.saveCatInput.style.display==="none") { ui.saveCatInput.style.display="block"; ui.saveCatSelect.style.display="none"; ui.toggleCatInput.innerText="📋 选择现有"; } else { ui.saveCatInput.style.display="none"; ui.saveCatSelect.style.display="block"; ui.toggleCatInput.innerText="✏️ 手动输入"; } };
    ui.confirmSaveBtn.onclick = () => { const cat = (ui.saveCatInput.style.display==="block") ? ui.saveCatInput.value : ui.saveCatSelect.value; const name = ui.saveNameInput.value; if(!cat || !name) return alert("信息不完整"); const prevBone = currentBone; selectBone(null); characters.forEach(c => { if(c.helper) c.helper.visible=false; }); grid.visible=false; renderer.render(scene, camera); const img = renderer.domElement.toDataURL("image/png"); grid.visible=true; characters.forEach(c => { if(c.helper && c===activeCharacter) c.helper.visible=true; }); if(prevBone) selectBone(prevBone); const data={}; if(activeCharacter) activeCharacter.bones.forEach(b=>data[b.name]={r:[b.rotation.x,b.rotation.y,b.rotation.z]}); fetch("/laoli/save_pose", { method: "POST", body: JSON.stringify({ category:cat, name, poseData:data, image:img }) }).then(() => { saveModal.style.display="none"; refreshLibrary(); }); };
    ui.importPoseBtn.onclick = () => ui.fileInput.click();
    ui.fileInput.onchange = (e) => { const f = e.target.files[0]; if(f) { const r = new FileReader(); r.onload = (ev) => applyPose(JSON.parse(ev.target.result)); r.readAsText(f); } };
    function applyPose(data) { if(!activeCharacter) return; activeCharacter.bones.forEach(b => { if(b.userData.initial) b.rotation.copy(b.userData.initial.rot); }); for(const [key, val] of Object.entries(data)) { const b = activeCharacter.bones.find(b => b.name===key || b.name.endsWith(key)); if(b && val.r) b.rotation.set(...val.r); } updateOutput(); }
    let isFullscreen = false, parentNode = null;
    ui.btns.full.onclick = () => { isFullscreen = !isFullscreen; if (isFullscreen) { parentNode = container.parentNode; parentNode.insertBefore(placeholder, container); document.body.appendChild(container); container.style.cssText += "position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:99999;"; ui.btns.full.innerText = "❌ 退出"; ui.btns.full.style.background = "#d32f2f"; } else { document.body.removeChild(container); parentNode.removeChild(placeholder); parentNode.appendChild(container); container.style.cssText = "display:flex; width:100%; height:100%; background:#111; position:relative; overflow:hidden; user-select:none;"; ui.btns.full.innerText = "⛶ 全屏"; ui.btns.full.style.background = "#1976d2"; } requestAnimationFrame(() => { const rect = container.getBoundingClientRect(); camera.aspect = rect.width/rect.height; camera.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height); }); };
    function setMode(m) { if(transformControl) { transformControl.setMode(m); if(m==='rotate') { ui.btns.rot.classList.add('active-mode'); ui.btns.scale.classList.remove('active-mode'); } else { ui.btns.rot.classList.remove('active-mode'); ui.btns.scale.classList.add('active-mode'); } } }
    ui.btns.rot.onclick = () => setMode('rotate'); ui.btns.scale.onclick = () => setMode('scale');
    ui.btns.help.onclick = () => helpModal.style.display = "flex"; ui.btns.help.onclick = () => helpModal.style.display = "flex";
    window.onkeydown = (e) => { if(!activeCharacter) return; if(e.key.toLowerCase()==='r') setMode('rotate'); if(e.key.toLowerCase()==='s') setMode('scale'); if(e.key.toLowerCase()==='w' && currentBone && currentBone.name.match(/Hips|Pelvis/i)) setMode('translate'); if(e.key==='Escape' && isFullscreen) ui.btns.full.click(); const step=0.1; if(currentBone){ if(e.key==="ArrowUp") currentBone.rotation.x-=step; if(e.key==="ArrowDown") currentBone.rotation.x+=step; if(e.key==="ArrowLeft") currentBone.rotation.y-=step; if(e.key==="ArrowRight") currentBone.rotation.y+=step; if(e.key==="+"||e.key==="=") currentBone.rotation.z+=step; if(e.key==="-"||e.key==="_") currentBone.rotation.z-=step; updateOutput(); updateSliders(); } };
}