# ComfyUI Laoli 3D Pose Editor (老李 3D 姿势编辑器)


<img width="2813" height="1277" alt="Laoli3D" src="https://github.com/user-attachments/assets/1a4c3e4e-d6c7-4ccc-bd8a-de125ecb8f94" />

请确保路径是*\custom_nodes\Laoli3D，而不是Laoli3D-main。因为没写动态地址，插件名字不一致会不能正常使用。
模型优先选用HanMeimei.glb。

## 🎯 目的：为什么开发这个插件？

在使用 Comfyui 进行 AI 绘图时，我们经常面临一个痛点：**提示词（Prompt）无法精准控制人物的动作**。

无论你如何详细地描述“左手举高45度”、“右腿后撤半步”，AI 往往难以理解具体的空间关系，导致生成的肢体扭曲或动作不达标。现有的 ControlNet 虽然强大，但寻找完美的参考图往往是大海捞针。

**Laoli 3D Pose Editor** 旨在解决这个问题。它在 ComfyUI 内部提供了一个轻量级、可视化的 3D 编辑环境，让你像玩游戏捏人一样，精准地调整人物的每一个关节，并直接生成 ControlNet 所需的各种控制图。**所见即所得，让 AI 严格按照你的意愿画图。**

## ✨ 核心特点

*   **👥 多人同屏编辑**：支持在同一场景中添加无限数量的角色，轻松构建复杂的双人互动或多人构图场景。
*   **🖼️ 多种 ControlNet 输出**：一次渲染，同时输出四种图像，满足不同 ControlNet 模型的需求：
    *   **RGB 渲染图**：所见即所得的预览。
    *   **OpenPose 骨骼图**：精准对应标准 OpenPose 格式。
    *   **Depth 深度图**：用于控制空间前后关系。
    *   **Normal 法线图**：用于控制物体表面凹凸细节。
*   **🧩 自定义模型导入**：不局限于内置模型！支持导入你自己的 `.glb` 格式 3D 模型（如 Mixamo 角色或动漫模型），只需放入本插件js\assets文件夹即可识别。
*   **📷 高清框选截图**：内置高级截图功能，支持**比例锁定**和**视口偏移**。无论你在屏幕上怎么缩放，都能截取指定分辨率（如 1024x1024）的高清局部特写，且无黑边、无拉伸。
*   **💾 状态自动保存**：刷新网页或重启 ComfyUI，场景中的人物、姿势和位置会自动恢复，无需重新摆放。

## 🛠️ 功能列表

*   **骨骼操作**：支持旋转 (Rotate)、缩放 (Scale)。
*   **全局位移**：支持移动人物在场景中的 X/Y/Z 位置及整体缩放。
*   **姿势库**：内置姿势保存与读取功能，建立你自己的动作素材库。
*   **UI 交互**：优化的 3D 视口，支持鼠标左键旋转、右键平移、滚轮缩放。

## 🚀 安装方法

1.  进入你的 ComfyUI 插件目录：
    ```bash
    cd ComfyUI/custom_nodes/
    ```
2.  克隆本仓库：
    ```bash
    git clone https://github.com/Laolilzp/Laoli3D.git
    ```
3.  重启 ComfyUI。

## 📖 使用指南

### 1. 基础操作
*   **添加节点**：在 ComfyUI 画布中右键 -> `Laoli3D` -> `Laoli 3D Pose Editor`。
*   **选择关节**：在 3D 视窗中直接点击人物身上的蒙皮，或在左侧列表中选择骨骼。
*   **快捷键**：
    *   `R`：切换到旋转模式 (Rotate)。
    *   `S`：切换到缩放模式 (Scale)。
    *   `W`：切换到移动模式 (仅限根骨骼 Hips/Root)。
    *   `↑ ↓、← →、+-`：微调选中骨骼的角度。
*   **相机控制**：
    *   左键拖拽（空白处）：旋转视角。
    *   右键拖拽：平移视角。
    *   滚轮：缩放视角。

### 2. 输出与 ControlNet 连接
节点提供 4 个图像输出端口，建议连接方式（待测试。。。）：
*   `OpenPose_Map` -> 连接到 ControlNet (预处理器选择 `None` 或手动指定 OpenPose)。
*   `Depth_Map` -> 连接到 ControlNet (预处理器选择 `None`，模型选 Depth)。
*   `Normal_Map` -> 连接到 ControlNet (预处理器选择 `None`，模型选 Normal)。

### 3. 如何导入自定义模型
1.  准备 `.glb` 格式的 3D 模型文件（建议带有标准骨骼绑定，如 Mixamo 导出的模型）。
2.  将文件放入插件目录下的 `assets` 文件夹：
    ```
    ComfyUI/custom_nodes/Laoli3D/js/assets/你的模型.glb
    ```
3.  刷新 ComfyUI 网页，在编辑器的顶部下拉菜单中即可看到新模型。

QA：

> **无需额外依赖 (No Extra Dependencies)**:
> 本插件仅使用 ComfyUI 原生环境库 (torch, numpy, pillow) 和内置的 Three.js 库，无需安装任何额外的 Python 包，解压即可运行。

### 1. 是否需要用户安装新依赖？
**不需要。** 这是一个非常“绿色”的插件。

*   **Python 后端 (`__init__.py`)**：
    *   使用的库包括：`os`, `json`, `base64`, `shutil`, `io`（这些是 Python 自带的标准库）。
    *   `torch`, `numpy`, `PIL` (Pillow), `aiohttp`, `server`（这些是 ComfyUI 运行 **必须** 具备的基础环境，用户只要能运行 ComfyUI，就一定有这些库）。
    *   **结论**：不需要提供 `requirements.txt` 文件，也不需要用户运行 `pip install`。

*   **JavaScript 前端 (`js/` 文件夹)**：
    *   使用了 `three.module.js`, `OrbitControls.js` 等。
    *   **关键点**：这些文件都已经包含在 `js` 文件夹里了（本地引用）。用户不需要去下载 Three.js，也不需要联网去加载 CDN。
    *   **结论**：前端是自包含的，开箱即用。

### 2. 会不会与其他插件冲突？
**冲突概率极低（几乎为零）。**

*   **Python 类名冲突**：
    *   节点类名是 `Laoli_3DPoseEditor`，分类是 `Laoli3D`。只要没有其他开发者恰好也叫 Laoli 并且写了同名节点，就不会冲突。ComfyUI 是通过类名映射加载节点的。
*   **前端代码冲突**：
    *   **变量隔离**：JS 代码使用了 ES Module (`import ...`), 这意味着变量（如 `scene`, `camera`）都运行在模块作用域内，不会污染全局变量 `window`。
    *   **Three.js 版本**：因为引用的是本地的 `./three.module.js`，即使其他插件也用了 Three.js（比如用了不同版本），因为路径不同，它们互不干扰。
    *   **DOM 元素 ID**：在创建 UI 时使用了 `laoli-3d-container`, `cropLayer` 等 ID。除非有其他插件使用了完全一样的 ID（概率极低），否则 CSS 和 DOM 操作不会冲突。

### 3. 唯一的“软性”限制（不算冲突，但值得注意）
*   **WebGL 上下文限制**：浏览器对同时运行的 WebGL 上下文数量有限制（通常是 16 个左右）。如果用户在同一个工作流里一次性打开了 20 个 `Laoli 3D Pose Editor` 节点，或者混用了其他大量 3D 预览节点，可能会导致部分窗口黑屏。这是浏览器机制决定的。

## ⚠️ 不足与已知问题 (Limitations)

虽然本插件已经能够满足大部分绘图辅助需求，但仍有以下改进空间，欢迎社区贡献：

1.  **没有反向动力学 (IK)**：目前采用正向动力学 (FK)，即调整手部位置需要分别调整大臂、小臂和手掌的角度，无法直接拖拽手掌带动胳膊（这也是为了保证骨骼旋转的绝对精准）。
2.  **骨骼命名兼容性**：目前主要适配 Mixamo 和标准 VRM/GLTF 骨骼命名规范。如果导入的自定义模型骨骼命名非常规，可能会导致无法识别或控制。
3.  **浏览器性能**：场景中如果放入过多高面数的 3D 模型，可能会导致网页端卡顿，建议使用低模。
4.  **撤销/重做**：暂不支持 Ctrl+Z 撤销操作，请谨慎调整或勤用保存功能。

## 🤝 贡献 (Contributing)

欢迎提交 Issues 和 Pull Requests！如果你有更好的想法或发现了 Bug，请随时告诉我。

## 📄 许可证 (License)

[MIT License](LICENSE)

***
