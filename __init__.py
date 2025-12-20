import os
import json
import base64
import shutil
import torch
import numpy as np
from PIL import Image
from io import BytesIO
import server
from aiohttp import web

# 路径配置
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
POSE_DIR = os.path.join(CURRENT_DIR, "pose")
JS_DIR = os.path.join(CURRENT_DIR, "js")
ASSETS_DIR = os.path.join(JS_DIR, "assets")

if not os.path.exists(POSE_DIR): os.makedirs(POSE_DIR)

# === API 接口 ===
@server.PromptServer.instance.routes.post("/laoli/save_pose")
async def save_pose(request):
    try:
        data = await request.json()
        cat = data.get("category", "Default")
        name = data.get("name", "NewPose")
        path = os.path.join(POSE_DIR, cat)
        if not os.path.exists(path): os.makedirs(path, exist_ok=True)
        
        with open(os.path.join(path, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data.get("poseData"), f)
            
        img_data = data.get("image")
        if img_data:
            with open(os.path.join(path, f"{name}.png"), "wb") as f:
                f.write(base64.b64decode(img_data.split(",")[1]))
                
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

@server.PromptServer.instance.routes.get("/laoli/get_library")
async def get_library(request):
    lib = {}
    if os.path.exists(POSE_DIR):
        for cat in os.listdir(POSE_DIR):
            p = os.path.join(POSE_DIR, cat)
            if os.path.isdir(p):
                lib[cat] = []
                for f in os.listdir(p):
                    if f.endswith(".json"):
                        img_path = os.path.join(p, f"{f[:-5]}.png")
                        img_url = None
                        if os.path.exists(img_path):
                            with open(img_path, "rb") as ifile:
                                img_url = "data:image/png;base64," + base64.b64encode(ifile.read()).decode('utf-8')
                        try:
                            with open(os.path.join(p, f), "r") as jf:
                                lib[cat].append({"name": f[:-5], "thumbnail": img_url, "data": json.load(jf)})
                        except: pass
    return web.json_response(lib)

@server.PromptServer.instance.routes.post("/laoli/manage_library")
async def manage_library(request):
    try:
        data = await request.json()
        act = data.get("action")
        if act == "create_cat":
            p = os.path.join(POSE_DIR, data.get("name"))
            if not os.path.exists(p): os.makedirs(p)
        elif act == "rename_cat":
            os.rename(os.path.join(POSE_DIR, data.get("old")), os.path.join(POSE_DIR, data.get("new")))
        elif act == "del_cat":
            shutil.rmtree(os.path.join(POSE_DIR, data.get("category")))
        elif act == "rename_pose":
            d = os.path.join(POSE_DIR, data.get("category"))
            base = os.path.join(d, data.get("old"))
            new_base = os.path.join(d, data.get("new"))
            os.rename(base+".json", new_base+".json")
            if os.path.exists(base+".png"): os.rename(base+".png", new_base+".png")
        elif act == "del_pose":
            d = os.path.join(POSE_DIR, data.get("category"))
            n = data.get("name")
            p = os.path.join(d, f"{n}.json")
            if os.path.exists(p): os.remove(p)
            p_img = os.path.join(d, f"{n}.png")
            if os.path.exists(p_img): os.remove(p_img)
        elif act == "move_pose":
            src = os.path.join(POSE_DIR, data.get("src_category"))
            tgt = os.path.join(POSE_DIR, data.get("tgt_category"))
            n = data.get("name")
            shutil.move(os.path.join(src, f"{n}.json"), os.path.join(tgt, f"{n}.json"))
            if os.path.exists(os.path.join(src, f"{n}.png")):
                shutil.move(os.path.join(src, f"{n}.png"), os.path.join(tgt, f"{n}.png"))
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

@server.PromptServer.instance.routes.get("/laoli/get_models")
async def get_models(request):
    if not os.path.exists(ASSETS_DIR): return web.json_response([])
    files = [f for f in os.listdir(ASSETS_DIR) if f.lower().endswith(".glb")]
    return web.json_response(files)

# === 节点定义 ===
class Laoli_3DPoseEditor:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client_data": ("STRING", {"default": "", "multiline": False, "hidden": True}),
            },
            "optional": {
                "reference_image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE", "IMAGE", "STRING")
    RETURN_NAMES = ("Render_RGB", "OpenPose_Map", "Depth_Map", "Normal_Map", "Pose_JSON")
    FUNCTION = "run"
    CATEGORY = "Laoli3D"

    def run(self, client_data="", reference_image=None):
        empty = torch.zeros((1, 512, 512, 3), dtype=torch.float32)
        if not client_data: return (empty, empty, empty, empty, "{}")
        
        try:
            data = json.loads(client_data)
            def decode(b64):
                if not b64 or "," not in b64: return empty
                img = Image.open(BytesIO(base64.b64decode(b64.split(",")[1]))).convert("RGB")
                return torch.from_numpy(np.array(img).astype(np.float32) / 255.0).unsqueeze(0)

            return (
                decode(data.get("rgb")),
                decode(data.get("pose_img")),
                decode(data.get("depth")),
                decode(data.get("normal")),
                json.dumps(data.get("pose_data", {}))
            )
        except:
            return (empty, empty, empty, empty, "{}")

NODE_CLASS_MAPPINGS = { "Laoli_3DPoseEditor": Laoli_3DPoseEditor }
NODE_DISPLAY_NAME_MAPPINGS = { "Laoli_3DPoseEditor": "Laoli 3D Pose Editor" }
WEB_DIRECTORY = "./js"