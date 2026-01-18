// === 骨骼名称映射字典 (Mapping Dictionary) ===
export const BONE_ALIASES = {
    "Hips":         ["Pelvis", "Root", "Bip01_Pelvis", "Hip", "root", "pelvis"],
    "Spine":        ["Spine1", "Bip01_Spine", "Torso", "Spine_01"],
    "Spine1":       ["Spine2", "Bip01_Spine1", "Chest", "Spine_02", "UpperChest"],
    "Spine2":       ["Spine3", "Bip01_Spine2", "UpperChest", "Chest", "Spine_03"],
    "Neck":         ["Neck1", "Bip01_Neck", "Neck_01"],
    "Head":         ["Head1", "Bip01_Head", "Head_01"],
    
    // 左臂
    "LeftShoulder": ["L_Clavicle", "Clavicle_L", "Bip01_L_Clavicle", "LeftCollar", "Shoulder_L"],
    "LeftArm":      ["L_UpperArm", "UpperArm_L", "Bip01_L_UpperArm", "LeftUpArm", "Arm_L"],
    "LeftForeArm":  ["L_Forearm", "LowerArm_L", "Bip01_L_Forearm", "ForeArm_L"],
    "LeftHand":     ["L_Hand", "Hand_L", "Bip01_L_Hand"],
    
    // 右臂
    "RightShoulder":["R_Clavicle", "Clavicle_R", "Bip01_R_Clavicle", "RightCollar", "Shoulder_R"],
    "RightArm":     ["R_UpperArm", "UpperArm_R", "Bip01_R_UpperArm", "RightUpArm", "Arm_R"],
    "RightForeArm": ["R_Forearm", "LowerArm_R", "Bip01_R_Forearm", "ForeArm_R"],
    "RightHand":    ["R_Hand", "Hand_R", "Bip01_R_Hand"],
    
    // 左腿
    "LeftUpLeg":    ["L_Thigh", "Thigh_L", "Bip01_L_Thigh", "LeftLeg", "UpLeg_L"],
    "LeftLeg":      ["L_Calf", "Calf_L", "Bip01_L_Calf", "LeftLowLeg", "Leg_L", "Shin_L"],
    "LeftFoot":     ["L_Foot", "Foot_L", "Bip01_L_Foot"],
    "LeftToeBase":  ["L_Toe0", "Toe_L", "Bip01_L_Toe0", "LeftToe"],
    
    // 右腿
    "RightUpLeg":   ["R_Thigh", "Thigh_R", "Bip01_R_Thigh", "RightLeg", "UpLeg_R"],
    "RightLeg":     ["R_Calf", "Calf_R", "Bip01_R_Calf", "RightLowLeg", "Leg_R", "Shin_R"],
    "RightFoot":    ["R_Foot", "Foot_R", "Bip01_R_Foot"],
    "RightToeBase": ["R_Toe0", "Toe_R", "Bip01_R_Toe0", "RightToe"],

    // 手指
    "LeftHandThumb1": ["L_Thumb1", "Thumb_01_L", "Bip01_L_Finger0"],
    "LeftHandIndex1": ["L_Index1", "Index_01_L", "Bip01_L_Finger1"],
    "RightHandThumb1":["R_Thumb1", "Thumb_01_R", "Bip01_R_Finger0"],
    "RightHandIndex1":["R_Index1", "Index_01_R", "Bip01_R_Finger1"]
};

export const BONE_MAP = {
    "Hips": "Hips", 
    "Spine": "Spine", "Spine1": "Spine1", "Spine2": "Spine2", 
    "Neck": "Neck", "Head": "Head",
    "LeftShoulder": "LeftShoulder", "LeftArm": "LeftArm", "LeftForeArm": "LeftForeArm", "LeftHand": "LeftHand",
    "RightShoulder": "RightShoulder", "RightArm": "RightArm", "RightForeArm": "RightForeArm", "RightHand": "RightHand",
    "LeftUpLeg": "LeftUpLeg", "LeftLeg": "LeftLeg", "LeftFoot": "LeftFoot", "LeftToeBase": "LeftToeBase",
    "RightUpLeg": "RightUpLeg", "RightLeg": "RightLeg", "RightFoot": "RightFoot", "RightToeBase": "RightToeBase"
};

export const CN_DICT = { 
    "HeadTop": "头顶", "Head": "头部", "Neck": "脖子", 
    "Hips": "盆骨", "Pelvis": "盆骨", "Root": "根骨", 
    "Spine2": "胸椎(上)", "Spine1": "脊柱(中)", "Spine": "脊柱(下)", 
    "Shoulder": "肩膀", "ForeArm": "小臂", "Arm": "大臂", 
    "Hand": "手掌", 
    "UpLeg": "大腿", "Leg": "小腿", 
    "Foot": "脚", "ToeBase": "脚尖", "Toe": "脚尖",
    "Thumb": "拇指", "Index": "食指", "Middle": "中指", "Ring": "无名指", "Pinky": "小指",
    "Eye": "眼睛", "Eyelid": "眼皮", "Jaw": "下巴"
};

export function translateBone(name) {
    let clean = name.replace(/mixamorig:|mixamorig|skeleton:|anim_00|:|J_Bip_C_|Bip001_/gi, "");
    
    let side = "";
    if (/Left|L_|L\b|_L/.test(clean)) { 
        side = "左"; 
        clean = clean.replace(/Left|L_|L\b|_L/g, ""); 
    }
    else if (/Right|R_|R\b|_R/.test(clean)) { 
        side = "右"; 
        clean = clean.replace(/Right|R_|R\b|_R/g, ""); 
    }
    
    let cnName = clean; 
    const sortedKeys = Object.keys(CN_DICT).sort((a, b) => b.length - a.length);
    
    for(const k of sortedKeys) {
        if(clean.toLowerCase().includes(k.toLowerCase())) { 
            cnName = CN_DICT[k]; 
            break; 
        }
    }

    if (["拇指","食指","中指","无名指","小指"].some(f => cnName.includes(f))) { 
        if(name.match(/1$|1_|_01/)) cnName += "1(根)"; 
        else if(name.match(/2$|2_|_02/)) cnName += "2(中)"; 
        else if(name.match(/3$|3_|_03/)) cnName += "3(尖)"; 
        else if(name.match(/4$|4_|_04/)) cnName += "4(末)";
    }
    
    const fullName = side ? `${side}-${cnName}` : cnName;
    return { full: fullName, name: cnName };
}

export function findBone(char, targetName) {
    if (!char || !char.bones) return null;
    let b = char.bones.find(b => b.name === targetName);
    if(b) return b;
    b = char.bones.find(b => b.name === "mixamorig" + targetName || b.name === "mixamorig:" + targetName);
    if(b) return b;
    b = char.bones.find(b => b.name.endsWith(targetName) && !b.name.includes("End"));
    return b;
}

export function showToast(msg, color="green") {
    const t = document.createElement("div");
    t.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); background:${color}; color:white; padding:10px 20px; border-radius:5px; z-index:99999; font-weight:bold; box-shadow:0 5px 15px rgba(0,0,0,0.5); pointer-events:none; transition:opacity 0.5s;`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity="0"; setTimeout(()=>document.body.removeChild(t),500); }, 2000);
}