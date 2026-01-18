# ComfyUI Laoli 3D Pose Editor
（身体手部姿态识别、编辑、输出controlnet、编辑模型参考图，自动生成编辑器布光系统的光影提示词）

<img width="1009" height="553" alt="Laoli3D png" src="https://github.com/user-attachments/assets/d6078bcc-1551-4530-9d57-630d082a1a19" />


**Laoli3D** 是一个ComfyUI 插件，提供了一个强大的内置 3D 编辑器。它不仅可以手动调节人物姿势、手指细节，还拥有专业的布光系统，并集成了最先进的 AI 姿势估算模型（HMR2 & HaMeR），能够从图片中精准提取 3D 姿态。

---

## ✨ 核心功能 (Key Features)

*   **🦴 3D 姿势编辑 (FK模式)**：
    *   通过旋转圆环精准控制每一个关节。
    *   支持全身骨骼及手指关节的精细调节。
*   **💡 专业影棚布光 (Studio Lighting)**：
    *   内置 **伦勃朗、蝴蝶光、剪影** 等专业摄影预设。
    *   支持独立调节主光、辅光、轮廓光和环境光的强度、角度与颜色。
    *   自动生成对应的光影提示词（Prompt）。
*   **🤖 AI 姿势识别 (State-of-the-Art)**：
    *   集成 **HMR2 (4DHumans)**：精准还原全身 3D 姿态。
    *   集成 **HaMeR**：目前最强的单目手部重建模型，完美解决手指扭曲问题。
    *   支持从上传的图片中一键提取姿势并应用到 3D 模型。
*   **📂 动作库系统 (Pose Library)**：
    *   内置全身与手势库。
    *   支持保存自定义动作，支持智能手势镜像（点选左手即应用到左手）。
*   **📷 多通道输出**：
    *   一键输出 OpenPose 图、深度图 (Depth)、法线图 (Normal) 及蒙版。

---

## 🛠️ 安装指南 (Installation)

### 1. 安装插件
进入你的 ComfyUI `custom_nodes` 目录：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Laolilzp/Laoli3D.git
cd Laoli3D
pip install -r requirements.txt
***

### 2. 模型下载
插件首次运行 AI 识别功能时，会自动尝试从 HuggingFace 下载以下模型。如果下载失败，请手动下载并放入 `models/` 目录：

*   **HMR2**: `hmr2a_r50_773975.pth`
*   **HaMeR**: `hamer_v1a.pth`

hamer_v1a.pth下载地址 (推荐 - 德州奥斯汀大学官网直链):
https://www.cs.utexas.edu/~pavlakos/hamer/data/hamer_demo_data.tar.gz
注意：这是一个 .tar.gz 压缩包。[2]
操作：下载后解压，在文件夹里找到 checkpoints 目录，里面会有 hamer_v1a.pth。
移动：只把 hamer_v1a.pth 拿出来，放到你的 ComfyUI\custom_nodes\Laoli3D\models\ 下。


vit_h_14_lc_swag_e2e_v1.pth
下载地址：https://dl.fbaipublicfiles.com/viit/vit_h_14_lc_swag_e2e_v1.pth (这是 Facebook 官方源)
存放位置：下载后放在 C:\Users\你的用户名\.cache\torch\hub\checkpoints\ 下。建议先让它自动下载，实在不行再手动放。

ComfyUI\custom_nodes\Laoli3D\src\hamer\data\
MANO_LEFT.pkl
MANO_RIGHT.pkl
下载地址 https://mano.is.tue.mpg.de/download.php
<img width="955" height="879" alt="屏幕截图 2026-01-01 122511" src="https://github.com/user-attachments/assets/42a42b16-c932-4620-ba42-cf32e46a6be0" />

---

## 📖 使用说明 (Usage)

1.  **添加节点**：在 ComfyUI 中右键 -> `Laoli3D` -> `Laoli 3D Editor`。
2.  **加载模型**：点击顶部工具栏的 `➕` 号加载 3D 角色。
3.  **调节姿势**：
    *   点击角色身体部位，出现旋转圆环，拖动即可调节。
    *   点击空白处取消选择。
4.  **AI 识别**：
    *   将图像连接到节点的 `image` 输入端。
    *   启用 `enable_recognition`。
    *   运行工作流，AI 会自动分析图片并将姿势同步到 3D 小人。
5.  **输出**：点击编辑器右上角的 `📷` 截图，节点将输出对应的 ControlNet 图像。

---

## 🙏 致谢 (Credits & Acknowledgements)

本项目能够实现高精度的 AI 姿势识别，离不开开源社区的杰出贡献。特别感谢以下项目和作者：

The AI capabilities of this project are built upon the amazing work of the research community. Special thanks to the authors of:

*   **HMR2.0 (4DHumans)**: [Shubham Goel et al.](https://github.com/shubham-goel/4D-Humans)  
    *   *Reconstructing Human People in 4D* - 用于全身姿态的高精度估计。
*   **HaMeR**: [Georgios Pavlakos et al.](https://github.com/geopavlakos/hamer)  
    *   *Hand Mesh Recovery* - 提供了卓越的手部重建能力。
*   **Ultralytics YOLOv8**: [Ultralytics](https://github.com/ultralytics/ultralytics)  
    *   用于快速精准的人物检测裁剪。
*   **Three.js**: [mrdoob](https://github.com/mrdoob/three.js)  
    *   强大的 Web 3D 渲染引擎。
*   **SMPL-X & MANO**: [Max Planck Institute for Intelligent Systems](https://smpl-x.is.tue.mpg.de/)  
    *   人体与手部参数化模型的基础。

---

## 📄 License

本项目遵循 MIT License，但在使用 AI 模型（HMR2/HaMeR）相关功能时，请务必遵守其原始协议（通常为 CC-BY-NC 4.0，仅限非商业研究用途）。

---
