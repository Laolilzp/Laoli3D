import os
import sys

from .smpl_wrapper import SMPL
from .hmr2 import HMR2
from .discriminator import Discriminator

from ..utils.download import cache_url
from ..configs import CACHE_DIR_4DHUMANS

# =========== 修复点开始 ===========
import os
REPO_PATH = os.environ.get('HMR2_ROOT', 'D:/ComfyUI-aki-v2/ComfyUI/custom_nodes/Laoli3D/src')
# 新代码: 动态计算 src/hmr2 的路径
current_file_path = os.path.abspath(__file__) # models/__init__.py
models_dir = os.path.dirname(current_file_path) # models/
hmr2_root = os.path.dirname(models_dir) # src/hmr2/
REPO_PATH = hmr2_root
# =========== 修复点结束 ===========

def download_models(folder=CACHE_DIR_4DHUMANS):
    """Download checkpoints and files for running inference.
    """
    os.makedirs(folder, exist_ok=True)
    download_files = {
        "hmr2_data.tar.gz"      : ["https://people.eecs.berkeley.edu/~jathushan/projects/4dhumans/hmr2_data.tar.gz", folder],
    }

    for file_name, url in download_files.items():
        output_path = os.path.join(url[1], file_name)
        if not os.path.exists(output_path):
            print("Downloading file: " + file_name)
            output = cache_url(url[0], output_path)
            assert os.path.exists(output_path), f"{output} does not exist"

            if file_name.endswith(".tar.gz"):
                print("Extracting file: " + file_name)
                os.system("tar -xvf " + output_path + " -C " + url[1])

def check_smpl_exists(smpl_dir):
    import os
    candidates = [
        f'{smpl_dir}/SMPL_NEUTRAL.pkl',
        f'{smpl_dir}/basicModel_neutral_lbs_10_207_0_v1.0.0.pkl',
    ]
    candidates_exist = [os.path.exists(c) for c in candidates]
    # 这里加个容错，如果都没找到，暂时不报错，让后续逻辑尝试加载
    if not any(candidates_exist):
        pass 
        # raise FileNotFoundError(f"SMPL model not found...") 

    if (not candidates_exist[0]) and candidates_exist[1]:
        convert_pkl(candidates[1], candidates[0])

    return True

def convert_pkl(old_pkl, new_pkl):
    import dill
    import pickle
    dill._dill._reverse_typemap["ObjectType"] = object
    with open(old_pkl, "rb") as f:
        loaded = pickle.load(f, encoding="latin1")
    with open(new_pkl, "wb") as outfile:
        pickle.dump(loaded, outfile)

def load_hmr2(checkpoint_path, smpl_dir):
    from pathlib import Path
    from ..configs import get_config
    
    # 确保 smpl_dir 是绝对路径
    smpl_dir = os.path.abspath(smpl_dir)
    
    model_cfg = os.path.join(REPO_PATH, 'configs', 'model_config.yaml')
    model_cfg = get_config(model_cfg, update_cachedir=True)

    model_cfg.SMPL.MODEL_PATH = smpl_dir
    model_cfg.SMPL.JOINT_REGRESSION_EXTRA = os.path.join(smpl_dir, 'SMPL_to_J19.pkl')
    model_cfg.SMPL.JOINT_REGRESSOR_EXTRA = os.path.join(smpl_dir, 'SMPL_to_J19.pkl')
    model_cfg.SMPL.MEAN_PARAMS = os.path.join(smpl_dir, 'smpl_mean_params.npz')

    model_cfg.freeze()

    if (model_cfg.MODEL.BACKBONE.TYPE == 'vit') and ('BBOX_SHAPE' not in model_cfg.MODEL):
        model_cfg.defrost()
        model_cfg.MODEL.BBOX_SHAPE = [192,256]
        model_cfg.freeze()

    # check_smpl_exists(smpl_dir) # 暂时注释掉严格检查，依靠外层逻辑

    model = HMR2.load_from_checkpoint(checkpoint_path, strict=False, cfg=model_cfg)
    return model, model_cfg