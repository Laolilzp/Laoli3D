export function buildUI(container) {
    const style = document.createElement('style');
    style.innerHTML = `
        /* === 基础通用 === */
        .bone-item { padding:5px 8px; cursor:pointer; color:#bbb; border-left:3px solid transparent; font-size:13px; display:flex; justify-content:space-between; transition:0.2s; align-items: center; border-bottom: 1px solid #2a2a2a; } 
        .bone-item:hover { background:#333; color:white; } 
        .bone-item.selected { background:#1565c0; color:white; border-left:3px solid #ffeb3b; font-weight:bold; } 
        
        .char-tab { cursor:pointer; padding:4px 12px; color:#aaa; border-radius:12px; font-size:12px; transition:0.2s; white-space:nowrap; border:1px solid transparent; background: #222; } 
        .char-tab:hover { background:#444; color:#fff; }
        .char-tab.active { color:#000; background:#00e5ff; font-weight:bold; box-shadow:0 0 8px rgba(0,229,255,0.5); border-color:#00e5ff; } 
        
        .laoli-btn { background:#333; color:#ccc; border:1px solid #555; padding:3px 8px; cursor:pointer; border-radius:3px; font-size:12px; display:flex; align-items:center; justify-content:center; transition:0.1s; white-space: nowrap; }
        .laoli-btn:hover { background:#555; color:#fff; border-color:#888; }
        .laoli-btn.active { background:#2e7d32; color:white; border-color:#2e7d32; }
        
        .toolbar-btn { font-size: 16px; width: 34px; height: 30px; margin: 0 3px; }
        
        /* 区域标题 */
        .section-header { font-size:12px; margin-bottom:6px; font-weight:bold; display:flex; justify-content:space-between; align-items:center; white-space: nowrap; overflow: hidden; background: #2a2a2a; padding: 3px 6px; border-radius: 3px; border-left: 3px solid #666; }
        .section-header span { flex: 1; overflow: hidden; text-overflow: ellipsis; margin-right: 5px; }

        .slider-row { display:grid; grid-template-columns: 75px 1fr 35px; gap:6px; align-items:center; font-size:12px; color:#bbb; margin-bottom:5px; padding-right: 2px; }
        .slider-row label { text-align:right; padding-right:4px; font-weight: normal; white-space: nowrap; }
        .slider-row input[type=range] { height:4px; cursor:pointer; width: 100%; accent-color: #00e5ff; }
        
        .mini-reset { cursor:pointer; text-align:center; user-select:none; font-size:12px; opacity:0.6; width: 100%; display:block; } 
        .mini-reset:hover { color:#fff; opacity:1; transform:scale(1.2); }
        
        #charBar { overflow-x:auto; max-width:90%; scrollbar-width:none; display:flex; gap:6px; }
        
        /* === 动作库 (窗口模式) === */
        .pose-category { border:1px solid #333; border-radius:4px; margin-bottom:4px; background:#181818; }
        .cat-header { display:flex; justify-content:space-between; padding:6px 8px; cursor:pointer; border-left:3px solid #ff9800; background:#252525; align-items:center; position: relative; }
        .cat-title { font-size: 12px; font-weight: bold; color: #ddd; }
        .pose-grid { display:grid; grid-template-columns: 1fr; gap:6px; padding:6px; }
        .pose-card { background:#000; border:1px solid #333; cursor:grab; position:relative; border-radius:3px; overflow:hidden; transition: border-color 0.2s; }
        .pose-card:hover { border-color:#00e5ff; box-shadow: 0 0 5px rgba(0, 229, 255, 0.3); }
        
        /* 缩略图核心样式 */
        .pose-img { width: 100%; height: auto; object-fit: contain; background-color: #000; display: block; }
        
        .pose-info { position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.8); color:#fff; font-size:10px; padding:4px 2px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; backdrop-filter:blur(2px); }
        .tools { display:none; gap:2px; position:absolute; top:2px; right:2px; }
        .pose-card:hover .tools, .cat-header:hover .tools { display:flex; }
        .tools .laoli-btn { cursor: pointer; padding: 2px 5px; font-size: 10px; opacity: 0.9; }

        /* === 动作库 (全屏模式 - 双栏布局) === */
        .fs-container { display: flex; height: 100%; width: 100%; overflow: hidden; border-top: 1px solid #444; background: #111; }
        .fs-sidebar { width: 160px; background: #181818; border-right: 1px solid #444; overflow-y: auto; display: flex; flex-direction: column; flex-shrink: 0; }
        .fs-content { flex: 1; background: #222; overflow-y: auto; padding: 10px; }
        
        .fs-folder-item { padding: 10px 12px; cursor: pointer; color: #aaa; border-bottom: 1px solid #2a2a2a; font-size: 13px; text-align: left; position: relative; transition: 0.2s; word-break: break-word; display:flex; justify-content:space-between; align-items:center;}
        .fs-folder-item:hover { background: #2a2a2a; color: #fff; }
        .fs-folder-item.active { background: #333; color: #00e5ff; font-weight: bold; border-right: 4px solid #00e5ff; }
        .fs-tools { display: none; gap: 4px; }
        .fs-folder-item:hover .fs-tools { display: flex; }

        /* 🔥 全屏右侧网格修复：强制多列，固定宽度，顶头显示 */
        .fs-content .pose-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); /* 固定最小宽，自动填满 */
            gap: 10px; 
            padding: 0; 
            align-content: start; /* 内容靠上 */
        }
        .fs-content .pose-card { border: 1px solid #444; }
        .fs-content .pose-img { 
            height: 180px; 
            object-fit: contain; /* 按长边显示 */
            width: 100%;
            background: #000;
        }

        /* === 灯光 === */
        .preset-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:4px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #333; }
        .preset-btn { background:#252525; border:1px solid #333; color:#888; padding:5px 0; font-size:11px; cursor:pointer; text-align:center; border-radius:3px; transition:0.2s; white-space:nowrap; }
        .preset-btn:hover { background:#333; color:#fff; border-color:#555; }
        .preset-btn.active { border-color:#ff9800; color:#ff9800; background:#3e2723; font-weight:bold; }

        .light-tabs { display:flex; gap:2px; margin-bottom:8px; background:#111; padding:2px; border-radius:4px; }
        .light-tab { flex:1; text-align:center; padding:5px 0; font-size:11px; cursor:pointer; color:#666; border-radius:3px; transition:0.2s; border-bottom:2px solid transparent; }
        .light-tab:hover { color:#ccc; background:#222; }
        .light-tab.active { background:#333; color:#00e5ff; font-weight:bold; border-bottom:2px solid #00e5ff; }

        .lib-type-tabs { display:flex; margin-bottom: 0; border-bottom: 2px solid #444; }
        .lib-tab { flex:1; text-align:center; padding:10px 0; cursor:pointer; font-size:13px; color:#888; background:#222; transition: 0.2s; }
        .lib-tab:hover { color:#fff; background:#333; }
        .lib-tab.active { color:#00e5ff; font-weight:bold; background:#2a2a2a; border-bottom: 2px solid #00e5ff; margin-bottom: -2px; }
        
        /* 帮助文档样式 */
        .help-section { margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .help-h3 { color: #ffd700; margin: 5px 0 10px 0; font-size: 14px; display: flex; align-items: center; gap: 5px; }
        .help-ul { margin: 0; padding-left: 20px; color: #ccc; line-height: 1.6; }
        .help-li { margin-bottom: 4px; }
        .help-key { background: #333; padding: 2px 6px; border-radius: 4px; color: #fff; font-family: monospace; border: 1px solid #555; font-size: 11px; }
        .help-tip { background: #1a1a1a; border-left: 3px solid #00e5ff; padding: 8px; margin-top: 8px; font-size: 12px; color: #aaa; }

        ::-webkit-scrollbar { width:8px; height:8px; } 
        ::-webkit-scrollbar-thumb { background:#444; border-radius:4px; } 
        ::-webkit-scrollbar-thumb:hover { background:#666; }
        ::-webkit-scrollbar-track { background:#222; }
    `;
    container.appendChild(style);

    container.innerHTML += `
        <div id="cropLayer" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; z-index:2000; background:rgba(0,0,0,0.5); cursor:crosshair;"><div id="cropBox" style="position:absolute; width:300px; height:300px; border:2px solid #00e5ff; box-shadow:0 0 0 9999px rgba(0,0,0,0.7); min-width:50px; min-height:50px;"><div id="cropHeader" style="width:100%; height:100%; cursor:move; position:absolute; top:0; left:0;"></div><div id="cropResize" style="position:absolute; bottom:-5px; right:-5px; width:15px; height:15px; background:#00e5ff; cursor:nwse-resize; border-radius:50%;"></div><div style="position:absolute; bottom:-35px; right:0; display:flex; gap:8px;"><button id="cropCancel" class="laoli-btn" style="background:#d32f2f;color:white;">✕ 取消</button><button id="cropConfirm" class="laoli-btn" style="background:#2e7d32;color:white;">✓ 确认</button></div></div></div>
        
        <!-- 顶部工具栏 -->
        <div style="position:absolute; top:0; left:0; width:100%; height:44px; background:#1a1a1a; display:flex; align-items:center; justify-content:space-between; padding:0 10px; z-index:999; border-bottom:1px solid #333;">
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="color:#00e5ff; font-weight:bold; font-size:14px;">🦴 Laoli Editor V5</div>
                <select id="modelSelect" style="background:#333; color:#eee; border:1px solid #555; height:26px; font-size:12px; max-width:140px; border-radius:4px; padding-left: 4px;" title="选择 3D 模型"></select>
                <button id="addCharBtn" class="laoli-btn" style="height:26px; padding: 0 10px;" title="添加选中模型">➕ 添加</button>
                <button id="delCharBtn" class="laoli-btn" style="height:26px; padding: 0 10px;" title="删除选中角色">🗑️ 删除</button>
            </div>
            
            <div style="display:flex; gap:6px; align-items:center;">
                <!-- 尺寸输入框：加大 -->
                <div style="display:flex; align-items:center; gap:4px; margin-right: 12px; background: #222; padding: 3px 8px; border-radius: 4px; border: 1px solid #333;">
                    <span style="font-size:12px; font-weight:bold; color:#888;">W:</span>
                    <input id="outWidth" type="number" value="1024" style="width:50px; background:#111; border:1px solid #444; color:#fff; font-size:13px; text-align:center; border-radius: 3px; padding: 2px;">
                    <span style="font-size:12px; font-weight:bold; color:#888; margin-left:4px;">H:</span>
                    <input id="outHeight" type="number" value="1024" style="width:50px; background:#111; border:1px solid #444; color:#fff; font-size:13px; text-align:center; border-radius: 3px; padding: 2px;">
                </div>
                
                <button id="snapBtn" class="laoli-btn toolbar-btn" style="background:#f57c00; color:white; width: 40px;" title="📷 截图发送到节点">📷</button>
                <div style="width:1px; height:24px; background:#444; margin:0 4px"></div>
                <button id="helpBtn" class="laoli-btn toolbar-btn" title="❓ 详细说明书">❓</button>
                <button id="fullscreenBtn" class="laoli-btn toolbar-btn" style="background:#1565c0; color:#fff; width: 40px;" title="⛶ 全屏编辑">⛶</button>
            </div>
        </div>
        
        <!-- 角色切换栏 -->
        <div id="charBar" style="position:absolute; top:48px; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:1001; padding-top:2px;"></div>
        
        <!-- 左侧控制面板 -->
        <div style="position:absolute; top:55px; left:10px; width:300px; bottom:10px; pointer-events:none; z-index:1000; display:flex; flex-direction:column;">
            <div style="background:rgba(25,25,25,0.95); border-radius:6px; border:1px solid #444; display:flex; flex-direction:column; height:100%; pointer-events:auto; overflow:hidden; box-shadow:4px 4px 15px rgba(0,0,0,0.5);">
                
                <div style="padding:10px 12px; border-bottom:1px solid #444; background:#202020;">
                    <div style="color:#888;font-size:12px; display:flex; justify-content:space-between;">
                        <span>当前编辑角色:</span>
                        <span id="activeCharDisplay" style="color:#00e5ff; font-weight:bold;">无</span>
                    </div>
                    <div id="boneNameDisplay" style="font-size:18px; font-weight:bold; color:#ffeb3b; margin-top:6px;">未选择骨骼</div>
                </div>
                
                <div id="boneListContainer" style="flex:1; overflow-y:auto; padding:2px;"></div>
                
                <div style="padding:10px; background:#2a2a2a; border-top:1px solid #444;">
                    <div class="light-panel">
                        <div class="section-header" style="color:#ffd700;">
                            <span>💡 专业布光台</span>
                            <label style="font-size:11px; color:#aaa; cursor:pointer;"><input type="checkbox" id="castShadowCheck" checked> 投影</label>
                        </div>
                        <div class="preset-grid" id="lightPresetContainer">
                            <div class="preset-btn active" data-id="default">默认平光</div>
                            <div class="preset-btn" data-id="rembrandt">伦勃朗</div>
                            <div class="preset-btn" data-id="butterfly">蝴蝶光</div>
                            <div class="preset-btn" data-id="split">侧面分割</div>
                            <div class="preset-btn" data-id="soft">柔和棚拍</div>
                            <div class="preset-btn" data-id="hard">硬朗强光</div>
                            <div class="preset-btn" data-id="rim">纯剪影</div>
                            <div class="preset-btn" data-id="dark">暗黑风</div>
                        </div>
                        <div class="light-tabs">
                            <div class="light-tab active" data-target="key">主光 Key</div>
                            <div class="light-tab" data-target="fill">辅光 Fill</div>
                            <div class="light-tab" data-target="rim">轮廓 Rim</div>
                            <div class="light-tab" data-target="hemi">环境 Env</div>
                        </div>
                        <div class="slider-row"><label>强度</label><input type="range" id="lightIntensity" min="0" max="3" step="0.05" value="2.5"><span id="val_lightIntensity">2.5</span></div>
                        <div class="slider-row"><label>角度</label><input type="range" id="lightAzimuth" min="-180" max="180" step="5" value="0"><span id="val_lightAzimuth">0°</span></div>
                        <div class="slider-row"><label>高度</label><input type="range" id="lightElevation" min="-10" max="90" step="5" value="45"><span id="val_lightElevation">45°</span></div>
                    </div>

                    <div style="border-top:1px solid #444; padding-top:8px; margin-bottom:6px;">
                        <div class="section-header" style="color:#00e5ff;">
                            <span>🌐 全局平移</span>
                            <span class="mini-reset" id="resetPosBtn" title="重置">↺</span>
                        </div>
                        <div class="slider-row"><label style="color:#ff8a80">X</label><input type="range" id="manX" min="-3.0" max="3.0" step="0.01" value="0"><span class="mini-reset" data-id="manX">↺</span></div>
                        <div class="slider-row"><label style="color:#82b1ff">Y</label><input type="range" id="manY" min="-3.0" max="3.0" step="0.01" value="0"><span class="mini-reset" data-id="manY">↺</span></div>
                        <div class="slider-row"><label style="color:#b9f6ca">Z</label><input type="range" id="manZ" min="-3.0" max="3.0" step="0.01" value="0"><span class="mini-reset" data-id="manZ">↺</span></div>
                        <div class="slider-row"><label style="color:#fff">缩放</label><input type="range" id="manScale" min="0.1" max="2.5" step="0.01" value="1"><span class="mini-reset" data-id="manScale" data-def="1">↺</span></div>
                    </div>

                    <div style="border-top:1px solid #444; padding-top:8px; margin-bottom:6px;">
                        <div class="section-header" style="color:#ff9800;">
                             <span>↻ 整体旋转</span>
                             <button id="faceFrontBtn" class="laoli-btn" style="padding:0 6px; font-size:11px;">😐 面向镜头</button>
                        </div>
                        <div class="slider-row"><label style="color:#82b1ff">旋转 Y</label><input type="range" id="manRotY" min="-180" max="180" step="1" value="0"><span class="mini-reset" data-id="manRotY">↺</span></div>
                        <div class="slider-row"><label style="color:#ff8a80">倾斜 X</label><input type="range" id="manRotX" min="-180" max="180" step="1" value="0"><span class="mini-reset" data-id="manRotX">↺</span></div>
                        <div class="slider-row"><label style="color:#b9f6ca">侧倾 Z</label><input type="range" id="manRotZ" min="-180" max="180" step="1" value="0"><span class="mini-reset" data-id="manRotZ">↺</span></div>
                    </div>
                    
                    <div style="border-top:1px solid #444; padding-top:8px;">
                        <div class="section-header" style="color:#b388ff;">
                            <span>🦴 选中关节微调</span>
                        </div>
                        <div class="slider-row"><label style="color:#f55">X 轴</label><input type="range" id="rotX" min="-3.14" max="3.14" step="0.1"><span class="mini-reset" data-id="rotX">↺</span></div>
                        <div class="slider-row"><label style="color:#5f5">Y 轴</label><input type="range" id="rotY" min="-3.14" max="3.14" step="0.1"><span class="mini-reset" data-id="rotY">↺</span></div>
                        <div class="slider-row"><label style="color:#55f">Z 轴</label><input type="range" id="rotZ" min="-3.14" max="3.14" step="0.1"><span class="mini-reset" data-id="rotZ">↺</span></div>
                    </div>
                    
                    <div style="display:flex; gap:6px; margin-top:10px; border-top:1px solid #444; padding-top:8px;">
                        <button id="undoBtn" class="laoli-btn" style="flex:0 0 60px; background:#444;" title="撤销">↩️ 撤销</button>
                        <select id="historySelect" style="flex:1; background:#111; color:#ccc; border:1px solid #444; font-size:11px; border-radius:3px;">
                            <option value="-1">-- 历史记录 --</option>
                        </select>
                        <button id="resetBoneBtn" class="laoli-btn" style="flex:0 0 35px;" title="重置当前关节">↺</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 右侧动作库 (动态宽度) -->
        <div id="rightPanel" style="position:absolute; top:55px; right:10px; width:300px; bottom:10px; pointer-events:none; z-index:1000; display:flex; flex-direction:column; transition: width 0.2s;">
            <div style="background:rgba(25,25,25,0.95); border-radius:6px; border:1px solid #444; display:flex; flex-direction:column; height:100%; pointer-events:auto; overflow:hidden; box-shadow:-4px 4px 15px rgba(0,0,0,0.5);">
                <div class="lib-type-tabs">
                    <div id="tabBody" class="lib-tab active">🏃 全身动作</div>
                    <div id="tabHands" class="lib-tab">✋ 手势库</div>
                </div>
                <div style="padding:10px; background:#252525; display:flex; justify-content:space-between; border-bottom:1px solid #444; align-items:center;">
                    <span style="color:#ddd; font-weight:bold; font-size:13px;">📁 动作库</span>
                    <div style="display:flex;gap:6px">
                        <button id="refreshLibBtn" class="laoli-btn" title="刷新列表">🔄</button>
                        <button id="createCatBtn" class="laoli-btn" title="新建文件夹">➕ 文件夹</button>
                    </div>
                </div>
                <div style="padding:6px; display:flex; gap:6px; background:#333; border-bottom:1px solid #444;">
                    <button id="importPoseBtn" class="laoli-btn" style="flex:1;">📥 导入 JSON</button>
                    <button id="saveBtnShow" class="laoli-btn" style="flex:1; background:#f57c00; color:white;">💾 保存当前姿势</button>
                </div>
                
                <div id="poseLibraryContainer" style="flex:1; overflow-y:auto; padding:0; display:flex; flex-direction:column;"></div>
                
                <input type="file" id="poseFileInput" accept=".json" style="display:none;" />
            </div>
        </div>
        
        <!-- 保存弹窗 -->
        <div id="saveModal" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:3000; align-items:center; justify-content:center;"><div style="background:#2a2a2a; width:300px; padding:20px; border-radius:8px; border:1px solid #555; box-shadow:0 10px 30px #000;"><h3 style="margin-top:0;color:#f57c00; border-bottom:1px solid #444; padding-bottom:10px;">💾 保存动作</h3><div style="margin-bottom:15px; margin-top:15px;"><label style="color:#aaa; font-size:12px;">类型:</label><div id="saveTypeDisplay" style="color:#00e5ff; font-weight:bold; margin-bottom:5px;">全身动作</div><label style="color:#aaa; font-size:12px;">文件夹:</label><div style="display:flex; gap:5px; margin-top:5px;"><select id="saveCatSelect" style="flex:1; padding:4px; background:#111; color:#fff; border:1px solid #555; border-radius:4px;"></select><input id="saveCatInput" type="text" style="flex:1; display:none; background:#111; color:#fff; border:1px solid #555; padding:4px; border-radius:4px;"><button id="toggleCatInput" class="laoli-btn" style="width:30px;">✏️</button></div></div><div style="margin-bottom:20px;"><label style="color:#aaa; font-size:12px;">名称:</label><input id="saveNameInput" type="text" value="NewPose" style="width:100%; padding:6px; background:#111; color:#fff; border:1px solid #555; margin-top:5px; border-radius:4px; font-size:13px;"></div><div style="display:flex; justify-content:flex-end; gap:10px;"><button id="cancelSaveBtn" class="laoli-btn" style="padding:6px 15px;">取消</button><button id="confirmSaveBtn" class="laoli-btn" style="background:#2e7d32;color:white; padding:6px 20px; font-weight:bold;">确认</button></div></div></div>
        
        <!-- 详尽版帮助弹窗 -->
        <div id="helpModal" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:4000; align-items:center; justify-content:center;">
            <div style="background:#1e1e1e; width:700px; padding:30px; border:1px solid #444; color:#eee; border-radius:10px; max-height:90vh; overflow-y:auto; box-shadow:0 0 50px rgba(0,0,0,0.9);">
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:15px;">
                    <h2 style="color:#00e5ff; margin:0; font-size: 20px;">📖 Laoli 3D Editor 使用手册</h2>
                    <button id="closeHelpBtn" class="laoli-btn" style="font-size:16px; padding:4px 12px; background:#d32f2f; color:white; border:none; border-radius:4px;">✕ 关闭</button>
                </div>

                <div style="font-size:13px;">
                    <div class="help-section">
                        <h3 class="help-h3">🖱️ 视图与操作 (Basic)</h3>
                        <ul class="help-ul">
                            <li class="help-li"><span class="help-key">鼠标左键</span>：<b>旋转</b> 摄像机 / <b>选择</b> 关节 / <b>拖拽</b> 控制器。</li>
                            <li class="help-li"><span class="help-key">鼠标右键</span>：<b>平移</b> 摄像机。</li>
                            <li class="help-li"><span class="help-key">鼠标滚轮</span>：<b>缩放</b> 视角。</li>
                        </ul>
                    </div>

                    <div class="help-section">
                        <h3 class="help-h3">🦴 调节模式 (Core Features)</h3>
                        <ul class="help-ul">
                            <li class="help-li"><b>FK 旋转模式 (关节微调)</b>：
                                <ul style="margin-top:5px; color:#aaa;">
                                    <li><b>操作：</b>直接点击角色身体的任意部位（手臂、大腿、头部等）。</li>
                                    <li><b>效果：</b>出现 <b>彩色旋转圆环</b>，拖动圆环可旋转该关节角度。</li>
                                </ul>
                            </li>
                        </ul>
                    </div>

                    <div class="help-section">
                        <h3 class="help-h3">💡 灯光与渲染 (Lighting)</h3>
                        <ul class="help-ul">
                            <li class="help-li"><b>预设系统</b>：提供 [伦勃朗]、[蝴蝶光]、[剪影] 等 8 种专业摄影布光方案。</li>
                            <li class="help-li"><b>自定义灯光</b>：支持独立调节 4 盏灯（Key, Fill, Rim, Env）的强度、角度、高度。</li>
                            <li class="help-li"><b>投影</b>：右上角勾选 [投影] 可开启实时阴影，增强立体感。</li>
                        </ul>
                    </div>

                    <div class="help-section">
                        <h3 class="help-h3">📂 动作库 (Pose Library)</h3>
                        <ul class="help-ul">
                            <li class="help-li"><b>双模式</b>：顶部页签切换 [全身动作] 或 [手部特写]。</li>
                            <li class="help-li"><b>智能镜像 (手部模式)</b>：
                                <ul style="margin-top:5px; color:#aaa;">
                                    <li>若<b>未选中</b>任何手：点击动作卡片，应用到<b>右手</b>。</li>
                                    <li>若<b>选中</b>了左手：点击动作卡片，自动镜像应用到<b>左手</b>。</li>
                                </ul>
                            </li>
                            <li class="help-li"><b>全屏模式</b>：点击右上角 <span class="help-key">⛶</span> 进入全屏，动作库会自动切换为<b>双栏布局</b>（左侧文件夹，右侧大图）。</li>
                        </ul>
                    </div>

                    <div class="help-section">
                        <h3 class="help-h3">📷 输出设置 (Output)</h3>
                        <ul class="help-ul">
                            <li class="help-li"><b>分辨率</b>：在顶部 W / H 输入框设置输出尺寸（如 512x768）。</li>
                            <li class="help-li"><b>截图</b>：点击 📷 按钮唤起裁剪框，调整构图后确认，将自动发送 OpenPose、深度图、法线图到 ComfyUI 节点。</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;

    // JS 绑定
    const ui = {
        charBar: container.querySelector("#charBar"), charName: container.querySelector("#activeCharDisplay"), name: container.querySelector("#boneNameDisplay"), list: container.querySelector("#boneListContainer"),
        manRotX: container.querySelector("#manRotX"), manRotY: container.querySelector("#manRotY"), manRotZ: container.querySelector("#manRotZ"), 
        manX: container.querySelector("#manX"), manY: container.querySelector("#manY"), manZ: container.querySelector("#manZ"), manScale: container.querySelector("#manScale"), 
        rx: container.querySelector("#rotX"), ry: container.querySelector("#rotY"), rz: container.querySelector("#rotZ"), 
        
        outW: container.querySelector("#outWidth"), outH: container.querySelector("#outHeight"),
        poseLib: container.querySelector("#poseLibraryContainer"), 
        rightPanel: container.querySelector("#rightPanel"),

        modelSelect: container.querySelector("#modelSelect"), addBtn: container.querySelector("#addCharBtn"), delBtn: container.querySelector("#delCharBtn"), snapBtn: container.querySelector("#snapBtn"),
        refreshLibBtn: container.querySelector("#refreshLibBtn"), createCatBtn: container.querySelector("#createCatBtn"), 
        importPoseBtn: container.querySelector("#importPoseBtn"), fileInput: container.querySelector("#poseFileInput"),
        saveBtnShow: container.querySelector("#saveBtnShow"), saveModal: container.querySelector("#saveModal"),
        saveCatSelect: container.querySelector("#saveCatSelect"), saveCatInput: container.querySelector("#saveCatInput"), toggleCatInput: container.querySelector("#toggleCatInput"),
        saveNameInput: container.querySelector("#saveNameInput"), cancelSaveBtn: container.querySelector("#cancelSaveBtn"), confirmSaveBtn: container.querySelector("#confirmSaveBtn"),
        helpBtn: container.querySelector("#helpBtn"), helpModal: container.querySelector("#helpModal"), closeHelpBtn: container.querySelector("#closeHelpBtn"),
        tabBody: container.querySelector("#tabBody"), tabHands: container.querySelector("#tabHands"), saveTypeDisplay: container.querySelector("#saveTypeDisplay"),
        btns: { rot: container.querySelector("#modeRotate"), full: container.querySelector("#fullscreenBtn"), resetBone: container.querySelector("#resetBoneBtn"), faceFront: container.querySelector("#faceFrontBtn") },
        crop: { layer: container.querySelector("#cropLayer"), box: container.querySelector("#cropBox"), header: container.querySelector("#cropHeader"), resize: container.querySelector("#cropResize"), cancel: container.querySelector("#cropCancel"), confirm: container.querySelector("#cropConfirm") },
        undoBtn: container.querySelector("#undoBtn"),
        historySelect: container.querySelector("#historySelect"),
        light: {
            tabs: container.querySelectorAll(".light-tab"),
            presets: container.querySelectorAll(".preset-btn"),
            intensity: container.querySelector("#lightIntensity"),
            azimuth: container.querySelector("#lightAzimuth"),
            elevation: container.querySelector("#lightElevation"),
            shadowCheck: container.querySelector("#castShadowCheck"),
            valInt: container.querySelector("#val_lightIntensity"),
            valAzi: container.querySelector("#val_lightAzimuth"),
            valEle: container.querySelector("#val_lightElevation")
        }
    };
    
    // 截图框逻辑
    let isDraggingBox = false, dragOffset = {x:0, y:0}, isResizing = false, startX = 0, startW = 0;
    ui.crop.header.onmousedown = (e) => { isDraggingBox = true; const r = ui.crop.box.getBoundingClientRect(); dragOffset.x = e.clientX - r.left; dragOffset.y = e.clientY - r.top; };
    ui.crop.resize.onmousedown = (e) => { isResizing = true; startX = e.clientX; startW = ui.crop.box.offsetWidth; e.stopPropagation(); };
    window.addEventListener("mousemove", (e) => { 
        if (ui.crop.layer.style.display === "none") return; 
        if (isDraggingBox) { 
            const r = container.getBoundingClientRect(); 
            ui.crop.box.style.left = (e.clientX - dragOffset.x - r.left) + "px"; 
            ui.crop.box.style.top = (e.clientY - dragOffset.y - r.top) + "px"; 
        } else if (isResizing) { 
            const w = Math.max(50, startW + (e.clientX - startX)); 
            const valW = ui.outW ? parseInt(ui.outW.value) : 1024;
            const valH = ui.outH ? parseInt(ui.outH.value) : 1024;
            const aspect = (valW || 1024) / (valH || 1024);
            ui.crop.box.style.width = w + "px"; 
            ui.crop.box.style.height = (w / aspect) + "px"; 
        } 
    });
    window.addEventListener("mouseup", () => { isDraggingBox = false; isResizing = false; });
    
    // 重置按钮逻辑
    container.querySelectorAll(".mini-reset").forEach(btn => { 
        btn.onclick = () => { 
            if (btn.id === "resetPosBtn") { ["manX", "manY", "manZ"].forEach(id => { const el = container.querySelector("#"+id); if(el) { el.value = 0; el.dispatchEvent(new Event('input')); } }); const elS = container.querySelector("#manScale"); if(elS) { elS.value = 1; elS.dispatchEvent(new Event('input')); } return; }
            if (btn.id === "resetRotBtn") { ["manRotX", "manRotY", "manRotZ"].forEach(id => { const el = container.querySelector("#"+id); if(el) { el.value = 0; el.dispatchEvent(new Event('input')); } }); return; }
            const el = container.querySelector("#"+btn.dataset.id); if(el) { el.value = btn.dataset.def || 0; el.dispatchEvent(new Event('input')); } 
        }; 
    });
    return ui;
}