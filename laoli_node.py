import os
import sys
import inspect 
from collections import namedtuple
from unittest.mock import MagicMock
import traceback
import json
from datetime import datetime
import numpy as np
import torch
from PIL import Image
from scipy.spatial.transform import Rotation as R
import torchvision.transforms as transforms
import base64
import io
import gc

# ================= 补丁区域 =================
try:
    inspect.getargspec
except AttributeError:
    ArgSpec = namedtuple('ArgSpec', ['args', 'varargs', 'keywords', 'defaults'])
    def getargspec(func):
        spec = inspect.getfullargspec(func)
        return ArgSpec(spec.args, spec.varargs, spec.varkw, spec.defaults)
    inspect.getargspec = getargspec

try:
    patch_types = [("bool", bool), ("int", int), ("float", float), ("complex", complex), ("object", object), ("str", str), ("unicode", str), ("long", int)]
    for name, type_val in patch_types:
        if not hasattr(np, name): setattr(np, name, type_val)
except ImportError: pass

if "HOME" not in os.environ:
    os.environ["HOME"] = os.environ.get("USERPROFILE", "C:/")

MOCK_MODULES = ["pyrender", "pyrender.light", "pyrender.shader_cache", "pyrender.constants", "OpenGL", "OpenGL.GL", "OpenGL.EGL", "OpenGL.GLUT", "OpenGL.GLU", "OpenGL.platform", "OpenGL.platform.egl"]
for mod_name in MOCK_MODULES:
    sys.modules[mod_name] = MagicMock()

# ================= 路径配置 =================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(CURRENT_DIR, "src")
MODEL_DIR = os.path.join(CURRENT_DIR, "models")
ASSETS_DIR = os.path.join(CURRENT_DIR, "js", "assets")
DEBUG_DIR = os.path.join(CURRENT_DIR, "debug_crops")
HMR2_ROOT = os.path.join(SRC_DIR, "hmr2")
HAMER_ROOT = os.path.join(SRC_DIR, "hamer")
SMPL_DIR = os.path.join(HMR2_ROOT, "data") 
MANO_DATA_DIR = os.path.join(HAMER_ROOT, "data").replace("\\", "/")
MANO_MEAN_PARAMS_PATH = os.path.join(HAMER_ROOT, "data", "mano_mean_params.npz").replace("\\", "/")

if SRC_DIR not in sys.path: sys.path.insert(0, SRC_DIR)
if HMR2_ROOT not in sys.path: sys.path.insert(0, HMR2_ROOT)
if HAMER_ROOT not in sys.path: sys.path.insert(0, HAMER_ROOT)

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(DEBUG_DIR, exist_ok=True)
os.environ["CACHE_DIR_4DHUMANS"] = MODEL_DIR
AI_DEPENDENCY_OK = False
HAS_MEDIAPIPE = False
LOADING_ERROR_MSG = ""

try:
    from ultralytics import YOLO
    import mediapipe as mp
    HAS_MEDIAPIPE = True
    AI_DEPENDENCY_OK = True
except Exception as e:
    err_msg = traceback.format_exc()
    LOADING_ERROR_MSG = str(err_msg)
    print(f"[Laoli3D] 基础依赖加载失败: {e}")

# ================= 工具函数 =================
def get_model_path(filename, url=""):
    save_path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(save_path):
        if url:
            print(f"[Laoli3D] 正在下载模型: {filename} ...")
            torch.hub.download_url_to_file(url, save_path)
        else: return None
    return save_path

def ensure_hamer_config():
    config_path = os.path.join(CURRENT_DIR, "model_config.yaml")
    content = f"""
MODEL:
  IMAGE_SIZE: 256
  BACKBONE:
    TYPE: 'vit'
    NAME: 'vit_h'
    PRETRAINED_WEIGHTS: 'models/vit_h_14_lc_swag_e2e_v1.pth'
  MANO_HEAD:
    TYPE: 'transformer_decoder'
    IN_CHANNELS: 1280
    TRANSFORMER_DECODER:
      depth: 6
      heads: 8
      mlp_dim: 1024
      dim_head: 64
      dropout: 0.0
      emb_dropout: 0.0
      norm: 'layer'
      context_dim: 1280
LOSS_WEIGHTS:
  VERTICES: 1.0
  JOINTS_3D: 1.0
  JOINTS_2D: 1.0
  GLOBAL_ORIENT: 1.0
  HAND_POSE: 1.0
  BETAS: 1.0
  ADVERSARIAL: 0.0
  KEYPOINTS_3D: 1.0
  KEYPOINTS_2D: 1.0
MANO:
  MODEL_PATH: '{MANO_DATA_DIR}'
  MEAN_PARAMS: '{MANO_MEAN_PARAMS_PATH}'
  NUM_HAND_JOINTS: 15
DATA:
  IMG_SIZE: 256
"""
    with open(config_path, "w") as f:
        f.write(content)
    return config_path

def yolo_square_crop(image_pil, yolo_model):
    results = yolo_model(image_pil, verbose=False)
    target_box = None
    max_conf = 0.0
    if results and len(results) > 0:
        for box in results[0].boxes:
            if int(box.cls[0]) == 0 and float(box.conf[0]) > max_conf:
                max_conf = float(box.conf[0])
                target_box = box.xyxy[0].cpu().numpy()
    W, H = image_pil.size
    if target_box is None:
        short_side = min(W, H); cx, cy = W/2, H/2
        x1, y1 = cx - short_side/2, cy - short_side/2
        x2, y2 = cx + short_side/2, cy + short_side/2
    else:
        x1, y1, x2, y2 = target_box
        box_w, box_h = x2 - x1, y2 - y1
        cx, cy = x1 + box_w/2, y1 + box_h/2
        side_len = max(box_w, box_h) * 1.2
        x1 = max(0, cx - side_len/2); y1 = max(0, cy - side_len/2)
        x2 = min(W, cx + side_len/2); y2 = min(H, cy + side_len/2)
    
    crop = image_pil.crop((x1, y1, x2, y2))
    transform = transforms.Compose([
        transforms.Resize((256, 256)), 
        transforms.ToTensor(), 
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # 修复：返回 3 个值，增加了 crop_info (x1, y1, scale_size) 供 HMR2 坐标映射使用
    return crop, transform(crop).unsqueeze(0), (x1, y1, x2-x1)

MANO_TO_MIXAMO = [["Index1", "Index2", "Index3"], ["Middle1", "Middle2", "Middle3"], ["Pinky1", "Pinky2", "Pinky3"], ["Ring1", "Ring2", "Ring3"], ["Thumb1", "Thumb2", "Thumb3"]]

def process_hamer_output(pred_mano_params, side="right"):
    pose_data = {}
    prefix = "RightHand" if side == "right" else "LeftHand"
    hand_pose = pred_mano_params['hand_pose'][0] 
    if hasattr(hand_pose, 'cpu'): hand_pose = hand_pose.cpu().numpy()
    if hand_pose.shape[-1] == 3 and hand_pose.ndim == 2:
        hand_pose = R.from_rotvec(hand_pose).as_matrix()
    elif hand_pose.shape[-1] != 3:
        try:
            hand_pose = hand_pose.reshape(-1, 3)
            hand_pose = R.from_rotvec(hand_pose).as_matrix()
        except: return {}
    for i in range(5):
        finger_bones = MANO_TO_MIXAMO[i]
        for j in range(3):
            idx = i * 3 + j
            if idx >= len(hand_pose): break
            rot_mat = hand_pose[idx]
            quat = R.from_matrix(rot_mat).as_quat().tolist()
            pose_data[prefix + finger_bones[j]] = {"q": quat}
    return pose_data

def smpl_to_pose_spec(body_pose, global_orient):
    if isinstance(body_pose, torch.Tensor): body_pose = body_pose.cpu().numpy()
    if isinstance(global_orient, torch.Tensor): global_orient = global_orient.cpu().numpy()
    if global_orient.shape == (3,): global_orient = R.from_rotvec(global_orient).as_matrix()
    go_mat = global_orient.reshape(1, 3, 3)
    if body_pose.ndim == 1: body_pose = body_pose.reshape(23, 3); body_pose = R.from_rotvec(body_pose).as_matrix()
    elif body_pose.shape[-2:] != (3, 3): body_pose = body_pose.reshape(23, 3); body_pose = R.from_rotvec(body_pose).as_matrix()
    bp_mat = body_pose.reshape(23, 3, 3)
    full_pose = np.concatenate((go_mat, bp_mat), axis=0)
    bone_map = { 0: "Hips", 1: "LeftUpLeg", 2: "RightUpLeg", 3: "Spine", 4: "LeftLeg", 5: "RightLeg", 6: "Spine1", 7: "LeftFoot", 8: "RightFoot", 9: "Spine2", 10: "LeftToeBase", 11: "RightToeBase", 12: "Neck", 13: "LeftShoulder", 14: "RightShoulder", 15: "Head", 16: "LeftArm", 17: "RightArm", 18: "LeftForeArm", 19: "RightForeArm", 20: "LeftHand", 21: "RightHand" }
    body_data = {}
    for idx, name in bone_map.items():
        if idx >= len(full_pose): continue
        rot_mat = full_pose[idx]
        rot = R.from_matrix(rot_mat)
        body_data[name] = {"q": rot.as_quat().tolist()}
    return body_data

def calc_root_correction_roll_only(pred_keypoints_3d):
    try:
        pelvis = pred_keypoints_3d[0]
        neck = pred_keypoints_3d[12]
        dx = neck[0] - pelvis[0]
        dy = neck[1] - pelvis[1]
        if abs(dx) < 1e-6 and abs(dy) < 1e-6:
            return [0, 0, 0, 1]
        angle = np.arctan2(-dx, -dy)
        r = R.from_euler('z', -angle, degrees=False)
        return r.as_quat().tolist()
    except Exception as e:
        print(f"[Laoli3D] Correction Calc Failed: {e}")
        return [0, 0, 0, 1]

# ================= 节点定义 =================

class Laoli_3DPoseEditor:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.hmr2 = None
        self.hamer = None
        self.yolo = None
        self.mp_hands = None

    @classmethod
    def INPUT_TYPES(s):
        glb_files = [f for f in os.listdir(ASSETS_DIR) if f.lower().endswith(".glb")] if os.path.exists(ASSETS_DIR) else ["No GLB"]
        return { 
            "required": { 
                "model_asset": (glb_files, ),
                "pose_data_json": ("STRING", {"hidden": True}),
                "light_config_text": ("STRING", {"default": ""})
            }, 
            "optional": { 
                "image": ("IMAGE", ),
                "enable_recognition": ("BOOLEAN", {"default": True, "label_on": "启用识别", "label_off": "锁定(不识别)"}),
                "use_hamer": ("BOOLEAN", {"default": True, "label_on": "HaMeR (高精度)", "label_off": "MediaPipe (快速)"}),
                "force_hand_side": (["Auto", "Force Right", "Force Left", "False"], {"default": "Auto"}),
                "unload_models": ("BOOLEAN", {"default": False, "label_on": "释放显存", "label_off": "常驻显存(快)"}),
            } 
        }
    
    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE", "MASK", "IMAGE", "STRING")
    RETURN_NAMES = ("OpenPose_Map", "Screenshot", "Normal_Map", "Mask", "Mask_Preview", "light_prompt")
    FUNCTION = "run_editor"
    CATEGORY = "Laoli3D"

    def load_models(self):
        if self.yolo is None:
            self.yolo = YOLO(get_model_path("yolov8n.pt", "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt"))
        if self.hmr2 is None:
            hmr2_path = get_model_path("hmr2a_r50_773975.pth", "")
            if hmr2_path:
                cwd = os.getcwd(); os.chdir(HMR2_ROOT)
                from hmr2.models import load_hmr2
                self.hmr2, _ = load_hmr2(hmr2_path, smpl_dir=SMPL_DIR)
                self.hmr2 = self.hmr2.to(self.device).eval()
                os.chdir(cwd)
        if self.hamer is None:
            hamer_path = get_model_path("hamer_v1a.pth", "") 
            if hamer_path and os.path.exists(HAMER_ROOT):
                sys.modules["pyrender"] = MagicMock()
                ensure_hamer_config()
                from hamer.models import load_hamer
                self.hamer, _ = load_hamer(hamer_path)
                self.hamer = self.hamer.to(self.device).eval()
        if self.mp_hands is None and HAS_MEDIAPIPE:
            # 修复：降低阈值到 0.1 以适应复杂遮挡
            self.mp_hands = mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=2, min_detection_confidence=0.1)

    def run_editor(self, model_asset, pose_data_json="", light_config_text="", image=None, enable_recognition=True, use_hamer=True, force_hand_side="Auto", unload_models=False):
        if force_hand_side == "False":
            force_hand_side = "Auto"
            
        ui = { "model": model_asset, "ai_pose": None, "manual_pose": pose_data_json }
        
        if image is not None and enable_recognition and AI_DEPENDENCY_OK:
            self.load_models()
            img_np = (255. * image.cpu().numpy()[0]).astype(np.uint8)
            pil_img = Image.fromarray(img_np)
            final_pose = { "meta": { "version": "2.0", "source": "Laoli_AI", "type": "Body" }, "body": {}, "hands": {} }
            
            # 存储 HMR2 的中间结果供手部回退使用
            hmr2_kps_2d = None 
            crop_info = None

            try:
                if self.hmr2:
                    # 1. 接收修改后 yolo_square_crop 返回的 crop_info
                    _, batch_input, crop_info = yolo_square_crop(pil_img, self.yolo)
                    
                    with torch.no_grad():
                        out = self.hmr2({'img': batch_input.to(self.device).float()})
                        bp = out['pred_smpl_params']['body_pose'][0]
                        go = out['pred_smpl_params']['global_orient'][0]
                        
                        # 2. 保存 HMR2 的 2D 关键点
                        if 'pred_keypoints_2d' in out:
                            hmr2_kps_2d = out['pred_keypoints_2d'][0].cpu().numpy()

                        if 'pred_keypoints_3d' in out:
                            kps = out['pred_keypoints_3d'][0].cpu().numpy()
                            rc = calc_root_correction_roll_only(kps)
                            final_pose["meta"]["root_correction"] = rc
                        final_pose["body"] = smpl_to_pose_spec(bp, go)
            except Exception as e:
                print(f"[Laoli3D] Body Error: {e}")

            hands_bboxes = []
            if self.mp_hands:
                mp_res = self.mp_hands.process(img_np)
                if mp_res.multi_hand_landmarks:
                    h, w, _ = img_np.shape
                    for idx, hand_landmarks in enumerate(mp_res.multi_hand_landmarks):
                        lbl_obj = mp_res.multi_handedness[idx].classification[0]
                        lbl = lbl_obj.label.lower() 
                        if force_hand_side == "Force Right": lbl = "right"
                        elif force_hand_side == "Force Left": lbl = "left"
                        x_min, y_min, x_max, y_max = w, h, 0, 0
                        for lm in hand_landmarks.landmark:
                            x_min = min(x_min, lm.x * w); y_min = min(y_min, lm.y * h)
                            x_max = max(x_max, lm.x * w); y_max = max(y_max, lm.y * h)
                        margin = max(x_max-x_min, y_max-y_min) * 0.5
                        box = [max(0, x_min-margin), max(0, y_min-margin), min(w, x_max+margin), min(h, y_max+margin)]
                        hands_bboxes.append({'side': lbl, 'box': box})

            # ==================== 核心修复：HMR2 辅助回退逻辑 ====================
            # 如果 MediaPipe 没找到手，利用 HMR2 手腕坐标生成框
            if len(hands_bboxes) == 0 and hmr2_kps_2d is not None and crop_info is not None:
                print("[Laoli3D] MP failed. Using HMR2 wrist fallback.")
                cx_crop, cy_crop, scale_crop = crop_info
                wrist_indices = {'right': 4, 'left': 7}
                for side, kidx in wrist_indices.items():
                    if hmr2_kps_2d.shape[0] > kidx and hmr2_kps_2d[kidx][2] > 0.3:
                        local_x, local_y = hmr2_kps_2d[kidx][:2]
                        global_x = cx_crop + (local_x / 256.0) * scale_crop
                        global_y = cy_crop + (local_y / 256.0) * scale_crop
                        hand_size = scale_crop * 0.15 # 手部框大小估算
                        x1, y1 = global_x - hand_size, global_y - hand_size
                        x2, y2 = global_x + hand_size, global_y + hand_size
                        box = [max(0, x1), max(0, y1), min(pil_img.width, x2), min(pil_img.height, y2)]
                        hands_bboxes.append({'side': side, 'box': box})
            # ===============================================================

            if use_hamer and self.hamer is not None and len(hands_bboxes) > 0:
                for hand_info in hands_bboxes:
                    try:
                        box = hand_info['box']
                        hand_crop = pil_img.crop((box[0], box[1], box[2], box[3]))
                        transform = transforms.Compose([transforms.Resize((256, 256)), transforms.ToTensor(), transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])])
                        hand_input = transform(hand_crop).unsqueeze(0).to(self.device).float()
                        with torch.no_grad():
                            out = self.hamer({'img': hand_input})
                            hand_pose_data = process_hamer_output(out['pred_mano_params'], hand_info['side'])
                            if final_pose["body"]: final_pose["body"].update(hand_pose_data)
                            else: final_pose["body"] = hand_pose_data
                    except: pass
            
            ui["ai_pose"] = final_pose

            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                save_dir = os.path.join(CURRENT_DIR, "pose", "Body", "Default")
                if not os.path.exists(save_dir): os.makedirs(save_dir, exist_ok=True)
                json_path = os.path.join(save_dir, f"{timestamp}.json")
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(final_pose, f, ensure_ascii=False, indent=2)
                img_file = os.path.join(save_dir, f"{timestamp}.png")
                tgt_w, tgt_h = 300, 400
                scale = min(tgt_w/pil_img.width, tgt_h/pil_img.height)
                new_w, new_h = int(pil_img.width*scale), int(pil_img.height*scale)
                thumb = pil_img.resize((new_w, new_h), Image.LANCZOS if hasattr(Image, 'LANCZOS') else Image.Resampling.LANCZOS)
                final_thumb = Image.new("RGB", (tgt_w, tgt_h), (0,0,0))
                final_thumb.paste(thumb, ((tgt_w-new_w)//2, (tgt_h-new_h)//2))
                final_thumb.save(img_file)
            except Exception as e:
                print(f"[Laoli3D] Auto-save failed: {e}")

            if unload_models:
                if self.hmr2: del self.hmr2
                if self.hamer: del self.hamer
                if self.yolo: del self.yolo
                if self.mp_hands: del self.mp_hands
                self.hmr2 = None; self.hamer = None; self.yolo = None; self.mp_hands = None
                gc.collect(); torch.cuda.empty_cache()

        empty_img = torch.zeros((1, 512, 512, 3))
        empty_mask = torch.zeros((1, 512, 512), dtype=torch.float32)
        op_map = empty_img; dp_map = empty_img; nm_map = empty_img; mask_map = empty_mask; mask_prev = empty_img

        if pose_data_json and len(pose_data_json) > 10:
            try:
                data = json.loads(pose_data_json)
                def decode_img(b64, is_mask=False):
                    if not b64 or "," not in b64: return empty_mask if is_mask else empty_img
                    head, context = b64.split(",")
                    img = Image.open(io.BytesIO(base64.b64decode(context))).convert("L" if is_mask else "RGB")
                    i = np.array(img).astype(np.float32) / 255.0
                    return torch.from_numpy(i).unsqueeze(0)

                if "pose_img" in data: op_map = decode_img(data["pose_img"])
                if "rgb" in data: dp_map = decode_img(data["rgb"])
                if "normal" in data: nm_map = decode_img(data["normal"])
                if "pose_img" in data:
                    raw_mask = decode_img(data["pose_img"], is_mask=True)
                    mask_map = (raw_mask > 0.05).float()
                    mask_prev = mask_map.unsqueeze(-1).repeat(1, 1, 1, 3)
            except Exception as e:
                print(f"[Laoli Error] Output Gen: {e}")

        return (op_map, dp_map, nm_map, mask_map, mask_prev, light_config_text, { "ui": ui })

NODE_CLASS_MAPPINGS = { "Laoli_3DPoseEditor": Laoli_3DPoseEditor }
NODE_DISPLAY_NAME_MAPPINGS = { "Laoli_3DPoseEditor": "Laoli 3D Editor" }