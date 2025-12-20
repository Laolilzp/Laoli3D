import torch
import numpy as np

class Laoli_3DPoseEditor:
    """
    节点类名：Laoli_3DPoseEditor
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # 这个字段用于接收前端传回来的 Pose JSON 数据（隐藏）
                "pose_data": ("STRING", {"default": "", "multiline": True, "hidden": True}),
            },
            "optional": {
                # 参考图输入（可选）
                "reference_image": ("IMAGE",),
            },
        }

    # 定义输出：OpenPose图、深度图、法线图
    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("OpenPose_Map", "Depth_Map", "Normal_Map")
    FUNCTION = "run_editor"
    
    # 分类名称
    CATEGORY = "Laoli3D"

    def run_editor(self, pose_data="", reference_image=None):

        empty_img = torch.zeros((1, 512, 512, 3), dtype=torch.float32)
        
        # 如果连了参考图，就透传参考图，方便测试
        if reference_image is not None:
            return (reference_image, reference_image, reference_image)
            
        return (empty_img, empty_img, empty_img)

# 映射字典
NODE_CLASS_MAPPINGS = {
    "Laoli_3DPoseEditor": Laoli_3DPoseEditor
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Laoli_3DPoseEditor": "Laoli 3D Pose Editor"
}