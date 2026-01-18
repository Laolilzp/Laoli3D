import os
import json
import base64
import shutil
import server
from aiohttp import web
from .laoli_node import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

# ================= 路径配置 =================
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
POSE_DIR = os.path.join(CURRENT_DIR, "pose")
JS_DIR = os.path.join(CURRENT_DIR, "js")
ASSETS_DIR = os.path.join(JS_DIR, "assets")

# 启动时自动创建文件夹结构
# 分别创建 Body(全身) 和 Hands(手势) 的默认文件夹
os.makedirs(os.path.join(POSE_DIR, "Body", "Default"), exist_ok=True)
os.makedirs(os.path.join(POSE_DIR, "Hands", "Default"), exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

WEB_DIRECTORY = "./js"

# ================= 接口 =================
@server.PromptServer.instance.routes.post("/laoli/save_pose")
async def save_pose(request):
    try:
        data = await request.json()
        # 获取库类型：'Body' 或 'Hands'，默认为 Body
        lib_type = data.get("libType", "Body") 
        cat = data.get("category", "Default")
        name = data.get("name", "NewPose")
        
        # 路径指向对应的子文件夹 (pose/Body/... 或 pose/Hands/...)
        path = os.path.join(POSE_DIR, lib_type, cat)
        if not os.path.exists(path): os.makedirs(path, exist_ok=True)
        
        with open(os.path.join(path, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data.get("poseData"), f)
            
        img_data = data.get("image")
        if img_data:
            if "," in img_data: img_data = img_data.split(",")[1]
            with open(os.path.join(path, f"{name}.png"), "wb") as f:
                f.write(base64.b64decode(img_data))
                
        return web.json_response({"status": "success"})
    except Exception as e: return web.json_response({"status": "error", "message": str(e)})

@server.PromptServer.instance.routes.get("/laoli/get_library")
async def get_library(request):
    lib = {}
    # 获取库类型参数，决定读取哪个文件夹
    lib_type = request.rel_url.query.get("libType", "Body")
    
    target_dir = os.path.join(POSE_DIR, lib_type)
    
    if os.path.exists(target_dir):
        for cat in os.listdir(target_dir):
            p = os.path.join(target_dir, cat)
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
                            with open(os.path.join(p, f), "r", encoding="utf-8") as jf:
                                lib[cat].append({"name": f[:-5], "thumbnail": img_url, "data": json.load(jf)})
                        except: pass
    return web.json_response(lib)

@server.PromptServer.instance.routes.post("/laoli/manage_library")
async def manage_library(request):
    try:
        data = await request.json()
        act = data.get("action")
        # 获取库类型，确定操作根目录
        lib_type = data.get("libType", "Body") 
        root = os.path.join(POSE_DIR, lib_type)
        
        # 确保根目录存在
        if not os.path.exists(root): os.makedirs(root, exist_ok=True)
        
        if act == "create_cat":
            p = os.path.join(root, data.get("name"))
            if not os.path.exists(p): os.makedirs(p)
        elif act == "rename_cat":
            os.rename(os.path.join(root, data.get("old")), os.path.join(root, data.get("new")))
        elif act == "del_cat":
            shutil.rmtree(os.path.join(root, data.get("category")))
        elif act == "rename_pose":
            d = os.path.join(root, data.get("category"))
            base = os.path.join(d, data.get("old"))
            new_base = os.path.join(d, data.get("new"))
            if os.path.exists(base+".json"): os.rename(base+".json", new_base+".json")
            if os.path.exists(base+".png"): os.rename(base+".png", new_base+".png")
        elif act == "del_pose":
            d = os.path.join(root, data.get("category"))
            n = data.get("name")
            if os.path.exists(os.path.join(d, f"{n}.json")): os.remove(os.path.join(d, f"{n}.json"))
            if os.path.exists(os.path.join(d, f"{n}.png")): os.remove(os.path.join(d, f"{n}.png"))
        elif act == "move_pose":
            src = os.path.join(root, data.get("src_category"))
            tgt = os.path.join(root, data.get("tgt_category"))
            n = data.get("name")
            os.makedirs(tgt, exist_ok=True)
            if os.path.exists(os.path.join(src, f"{n}.json")): shutil.move(os.path.join(src, f"{n}.json"), os.path.join(tgt, f"{n}.json"))
            if os.path.exists(os.path.join(src, f"{n}.png")): shutil.move(os.path.join(src, f"{n}.png"), os.path.join(tgt, f"{n}.png"))
        return web.json_response({"status": "success"})
    except Exception as e: return web.json_response({"status": "error", "message": str(e)})

@server.PromptServer.instance.routes.get("/laoli/get_models")
async def get_models(request):
    if not os.path.exists(ASSETS_DIR): return web.json_response([])
    files = [f for f in os.listdir(ASSETS_DIR) if f.lower().endswith(".glb")]
    return web.json_response(files)

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]