import * as THREE from "./LaoliThree.js";
import { findBone, BONE_ALIASES } from "./laoli_utils.js"; 

const DEG2RAD = Math.PI / 180;
const DEBUG_MODE = "AUTO"; 
const ROOT_ROTATION_MODE = "FREE"; 
const ONLY_APPLY_KEY = null; 
const RESET_TO_BIND_EACH_FRAME = true;
const DELTA_PREMULTIPLY = true; 
const DELTA_INVERT = false;
const ENABLE_LOCAL_SWIZZLE = true;
const ENABLE_FINGER_SWIZZLE = true;
const EXTRA_GLOBAL_YAW_DEG = 180;
const STANDING_REF_NAME = "20260102_215029.json";
const FORCE_SKELETON_POSE_ON_BIND_CAPTURE = true;
const INPUT_QUAT_ORDER = "xyzw"; 
const ROOT_INVERT = true;
const ROOT_CAM_TO_WORLD_MODE = "conjugate"; 
const ROOT_APPLY_LOCAL_SWIZZLE = true;

const FIX_DOWN = { LEFT:  { x: -65, y: -30, z: -48 }, RIGHT: { x: -65, y: 30, z: 48  } };
const FIX_UP = { LEFT:  { x: 10, y: -60, z: -10 }, RIGHT: { x: 10, y: 60, z: 10 } };
const FOREARM_FIX = { LEFT:  { x: 0, y: 0, z: -10 }, RIGHT: { x: 0, y: 0, z: 10 } };
const HAND_FIX = { x: 0, y: 0, z: 0 };
const LEG_FIX = { x: 0, y: 0, z: 0 };
const ENABLE_FINGER_ANIMATION = true; 
const FINGER_CURL_SIGN = -1; 

function normKey(k) { return String(k || "").trim(); }
const qAxis = (axis, angleDeg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(), angleDeg * DEG2RAD);
function normalizeSafe(q) { const len = Math.hypot(q.x, q.y, q.z, q.w); if (!isFinite(len) || len < 1e-8) return q.set(0, 0, 0, 1); return q.set(q.x / len, q.y / len, q.z / len, q.w / len); }

function isCoreBoneName(key) { return /Spine|Neck|Head|Leg|Arm|Shoulder|Hand|Foot|Toe/i.test(key); }
function isFingerName(key) { return /Finger|Index|Middle|Ring|Pinky|Thumb/i.test(key); }
function isLegName(key) { return /Leg|UpLeg|Foot|Toe/i.test(key); }
function isHeadName(key) { return /Head|Neck/i.test(key); }
function isRootName(key) { return /Hips|Pelvis/i.test(key); }
function isShoulderName(key) { return /Shoulder/i.test(key); }
function isArmName(key) { return /Arm/i.test(key) && !/Hand/i.test(key) && !/Shoulder/i.test(key); }
function isHandName(key) { return /Hand/i.test(key); }
function isForeArmName(key) { return /ForeArm/i.test(key); }
function isLeftArm(key) { return /LeftArm/i.test(key); }
function isRightArm(key) { return /RightArm/i.test(key); }
function isLeftForeArm(key) { return /LeftForeArm/i.test(key); }
function isRightForeArm(key) { return /RightForeArm/i.test(key); }
function isLeftHand(key) { return /LeftHand/i.test(key); }
function isRightHand(key) { return /RightHand/i.test(key); }
function isLeftUpLeg(key) { return /LeftUpLeg/i.test(key); }
function isRightUpLeg(key) { return /RightUpLeg/i.test(key); }

function swizzleV222_LocalBone(q, keyNorm) {
  if (!ENABLE_LOCAL_SWIZZLE) return q.clone();
  if (isFingerName(keyNorm)) {
    if (!ENABLE_FINGER_SWIZZLE) return q.clone();
    const srcZ = q.z; const srcW = q.w;
    let qClean = new THREE.Quaternion(srcZ * FINGER_CURL_SIGN, 0, 0, srcW);
    return normalizeSafe(qClean);
  }
  if (!isCoreBoneName(keyNorm)) return q.clone();
  if (isHeadName(keyNorm)) return new THREE.Quaternion(q.x, q.y, q.z, q.w);
  if (isRootName(keyNorm)) return new THREE.Quaternion(q.x, -q.y, q.z, q.w);
  if (isLegName(keyNorm)) return new THREE.Quaternion(-q.x, -q.y, -q.z, q.w);
  if (isArmName(keyNorm) || isForeArmName(keyNorm) || isHandName(keyNorm)) { return new THREE.Quaternion(-q.x, -q.z, q.y, q.w); }
  return new THREE.Quaternion(-q.x, -q.y, q.z, q.w);
}

function calculatePoseFactor(qInput, isLeft) {
    const refVec = isLeft ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0);
    const vec = refVec.clone().applyQuaternion(qInput);
    const lower = 0.40; const upper = 0.75;
    let t = 0; if (vec.y < lower) t = 0; else if (vec.y > upper) t = 1; else t = (vec.y - lower) / (upper - lower);
    return { t: Math.max(0, Math.min(1, t)), rawY: vec.y }; 
}
function lerp(a, b, t) { return a + (b - a) * t; }

function getBasisQ() {
  const Q_CAM_TO_WORLD = qAxis([1, 0, 0], 180);
  const Q_EXTRA_YAW = EXTRA_GLOBAL_YAW_DEG ? qAxis([0, 1, 0], EXTRA_GLOBAL_YAW_DEG) : null;
  const q = Q_EXTRA_YAW ? Q_EXTRA_YAW.clone().multiply(Q_CAM_TO_WORLD) : Q_CAM_TO_WORLD.clone();
  return normalizeSafe(q);
}
function camToWorld_Root(qCam) {
  const B = getBasisQ(); const Binv = B.clone().invert();
  let qResult = normalizeSafe(B.multiply(qCam.clone()).multiply(Binv));
  if (ROOT_ROTATION_MODE === "FIXED_UP") qResult.premultiply(qAxis([0, 0, 1], 180));
  else if (ROOT_ROTATION_MODE === "FREE") qResult.premultiply(qAxis([0, 0, 1], 0)); 
  return normalizeSafe(qResult);
}

function getAllBones(character) { 
    const root = character?.scene || character?.group || character; 
    const bones = []; 
    if (root && root.traverse) {
        root.traverse((obj) => { 
            if (obj.isBone) bones.push(obj); 
        }); 
    }
    return bones; 
}

function buildBoneIndex(character) { 
    const bones = getAllBones(character); 
    const index = new Map(); 
    for (const b of bones) { 
        const raw = b?.name || ""; 
        const n = String(raw).trim().toLowerCase().split(":").pop().replace(/^mixamorig\d*[_\-:]*/g, ""); 
        index.set(raw.toLowerCase(), b); 
        index.set(n, b); 
    } 
    character.userData.__boneIndex = index; 
    character.userData.__boneIndexBuilt = true; 
    return index; 
}

function getBoneIndex(character) { if (!character?.userData?.__boneIndexBuilt) buildBoneIndex(character); return character.userData.__boneIndex; }

function findBoneSmart(character, key) { 
    if (!character || !key) return null; 
    const index = getBoneIndex(character); 
    
    const k0 = String(key).trim().toLowerCase();
    const k1 = k0.replace(/^mixamorig\d*[_\-:]*/g, ""); 

    if (index.has(k0)) return index.get(k0);
    if (index.has(k1)) return index.get(k1);
    
    for (const [standardName, aliases] of Object.entries(BONE_ALIASES)) {
        if (standardName.toLowerCase() === k1) {
            for (const alias of aliases) {
                const aliasKey = alias.toLowerCase();
                if (index.has(aliasKey)) return index.get(aliasKey);
            }
        }
    }
    return null; 
}

function shouldApplyKey(keyRaw) { if (!ONLY_APPLY_KEY) return true; const target = String(ONLY_APPLY_KEY); const raw = String(keyRaw || ""); const nRaw = String(raw).trim().toLowerCase().split(":").pop().replace(/^mixamorig[_\-]*/g, ""); const nTarget = String(target).trim().toLowerCase().split(":").pop().replace(/^mixamorig[_\-]*/g, ""); return nRaw === nTarget; }

export function retargetPose(character, data, fileName = STANDING_REF_NAME) {
  if (!character || !character.group) return;

  if (!character.userData.isBindPoseSaved) {
    if (FORCE_SKELETON_POSE_ON_BIND_CAPTURE && character.skeleton?.pose) { character.skeleton.pose(); character.group.updateMatrixWorld(true); }
    getAllBones(character).forEach((b) => (b.userData.bindQ = b.quaternion.clone()));
    character.userData.isBindPoseSaved = true;
  }

  const isHandPartial = data.meta && data.meta.type === "Hands";
  const isNativeSource = data.meta && data.meta.source === "Laoli_Native";

  if (!isHandPartial && !isNativeSource && RESET_TO_BIND_EACH_FRAME) {
    getAllBones(character).forEach((b) => b.userData.bindQ && b.quaternion.copy(b.userData.bindQ));
    character.group.updateMatrixWorld(true);
  }

  const bodySource = data?.body || {};
  if (!character.userData.__logOnce) character.userData.__logOnce = {};
  if (!character.userData.frameCount) character.userData.frameCount = 0;
  character.userData.frameCount++;

  let targetSide = data.meta?.targetSide; 
  let sourceSide = data.meta?.side;       
  let mirrorMode = false;
  if (isHandPartial && targetSide && sourceSide && targetSide !== sourceSide) { mirrorMode = true; }

  for (const [keyRaw, val] of Object.entries(bodySource)) {
    if (!val?.q) continue;
    if (!shouldApplyKey(keyRaw)) continue;

    let finalKey = keyRaw;
    if (mirrorMode) {
        if (sourceSide === "Right" && targetSide === "Left") finalKey = keyRaw.replace("Right", "Left");
        else if (sourceSide === "Left" && targetSide === "Right") finalKey = keyRaw.replace("Left", "Right");
    }

    const bone = findBoneSmart(character, finalKey);
    if (!bone) continue;

    const keyNorm = String(finalKey).trim().toLowerCase().split(":").pop().replace(/^mixamorig\d*[_\-:]*/g, "");

    if (!ENABLE_FINGER_ANIMATION && isFingerName(keyNorm)) continue;

    let qIn;
    if (INPUT_QUAT_ORDER === "wxyz") qIn = new THREE.Quaternion(val.q[1], val.q[2], val.q[3], val.q[0]);
    else qIn = new THREE.Quaternion(val.q[0], val.q[1], val.q[2], val.q[3]);
    normalizeSafe(qIn);

    const bindQ = bone.userData.bindQ ? bone.userData.bindQ.clone() : new THREE.Quaternion(0, 0, 0, 1);

    if (isNativeSource || isHandPartial) {
        bone.quaternion.copy(qIn);
        if (isRootName(keyNorm) && data.meta && data.meta.root_correction) {
             const rc = data.meta.root_correction;
             const qCorrection = new THREE.Quaternion(rc[0], rc[1], rc[2], rc[3]);
             qIn.premultiply(qCorrection); 
             bone.quaternion.copy(qIn);
        }
        continue;
    }

    if (isRootName(keyNorm)) {
      if (ROOT_APPLY_LOCAL_SWIZZLE) qIn = swizzleV222_LocalBone(qIn, keyNorm);
      if (data.meta && data.meta.root_correction) {
          const rc = data.meta.root_correction;
          const qCorrection = new THREE.Quaternion(rc[0], rc[1], rc[2], rc[3]);
          qIn.premultiply(qCorrection);
      }
      if (ROOT_INVERT) qIn.invert();
      const qWorld = camToWorld_Root(qIn);
      const parentWorldQ = new THREE.Quaternion();
      if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
      const qLocal = parentWorldQ.clone().invert().multiply(qWorld);
      bone.quaternion.copy(qLocal);
      continue;
    }

    if (isShoulderName(keyNorm)) { bone.quaternion.copy(bindQ); continue; }

    let qLocalIn = swizzleV222_LocalBone(qIn, keyNorm);
    normalizeSafe(qLocalIn);
    if (DELTA_INVERT) qLocalIn.invert();

    bone.quaternion.copy(bindQ);
    if (DELTA_PREMULTIPLY) bone.quaternion.premultiply(qLocalIn);
    else bone.quaternion.multiply(qLocalIn);

    let finalFixQ = new THREE.Quaternion();
    if (isLeftArm(keyNorm)) {
        const result = calculatePoseFactor(qLocalIn, true); 
        let t = result.t;
        const fixX = lerp(FIX_DOWN.LEFT.x, FIX_UP.LEFT.x, t);
        const fixY = lerp(FIX_DOWN.LEFT.y, FIX_UP.LEFT.y, t);
        const fixZ = lerp(FIX_DOWN.LEFT.z, FIX_UP.LEFT.z, t);
        finalFixQ.setFromEuler(new THREE.Euler(fixX * DEG2RAD, fixY * DEG2RAD, fixZ * DEG2RAD, "XYZ"));
        bone.quaternion.multiply(finalFixQ);
    }
    if (isRightArm(keyNorm)) {
        const result = calculatePoseFactor(qLocalIn, false);
        let t = result.t;
        const fixX = lerp(FIX_DOWN.RIGHT.x, FIX_UP.RIGHT.x, t);
        const fixY = lerp(FIX_DOWN.RIGHT.y, FIX_UP.RIGHT.y, t);
        const fixZ = lerp(FIX_DOWN.RIGHT.z, FIX_UP.RIGHT.z, t);
        finalFixQ.setFromEuler(new THREE.Euler(fixX * DEG2RAD, fixY * DEG2RAD, fixZ * DEG2RAD, "XYZ"));
        bone.quaternion.multiply(finalFixQ);
    }
    if (isLeftForeArm(keyNorm)) { finalFixQ.setFromEuler(new THREE.Euler(FOREARM_FIX.LEFT.x * DEG2RAD, FOREARM_FIX.LEFT.y * DEG2RAD, FOREARM_FIX.LEFT.z * DEG2RAD, "XYZ")); bone.quaternion.multiply(finalFixQ); }
    if (isRightForeArm(keyNorm)) { finalFixQ.setFromEuler(new THREE.Euler(FOREARM_FIX.RIGHT.x * DEG2RAD, FOREARM_FIX.RIGHT.y * DEG2RAD, FOREARM_FIX.RIGHT.z * DEG2RAD, "XYZ")); bone.quaternion.multiply(finalFixQ); }
    if (isHandName(keyNorm)) { finalFixQ.setFromEuler(new THREE.Euler(HAND_FIX.x, HAND_FIX.y, HAND_FIX.z)); bone.quaternion.multiply(finalFixQ); }
    if (isLegName(keyNorm)) { finalFixQ.setFromEuler(new THREE.Euler(LEG_FIX.x, LEG_FIX.y, LEG_FIX.z)); bone.quaternion.multiply(finalFixQ); }
  }
  character.group.updateMatrixWorld(true);
}