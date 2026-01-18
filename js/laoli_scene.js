import * as THREE from "./LaoliThree.js";
import { GLTFLoader } from "./GLTFLoader.js";
import { OrbitControls } from "./OrbitControls.js";
import { TransformControls } from "./LaoliGizmo.js"; 
import { retargetPose } from "./laoli_retarget.js";

export class LaoliScene {
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks || {}; 
        this.characters = [];
        this.activeCharacter = null;
        this.currentBone = null;

        this.scene = new THREE.Scene(); 
        this.scene.background = new THREE.Color(0x222222);
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000); 
        this.camera.position.set(0, 1.4, 3.5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.domElement.className = "laoli-3d-canvas";
        
        const w = container.offsetWidth || 500;
        const h = container.offsetHeight || 500;
        this.renderer.setSize(w, h);
        container.appendChild(this.renderer.domElement);

        // 灯光设置
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const dl = new THREE.DirectionalLight(0xffffff, 1.5); 
        dl.position.set(2, 5, 5); 
        this.scene.add(dl);
        
        this.grid = new THREE.GridHelper(20, 20, 0x666666, 0x333333); 
        this.scene.add(this.grid);
        
        // 骨骼高亮标记 (选中骨骼时显示的黄色小球)
        this.boneMarker = new THREE.Mesh(new THREE.SphereGeometry(0.02), new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.6 }));
        this.boneMarker.visible = false; 
        this.boneMarker.renderOrder = 999; 
        this.scene.add(this.boneMarker);

        this.orbit = new OrbitControls(this.camera, this.renderer.domElement); 
        this.orbit.target.set(0, 1.0, 0); 
        this.orbit.update();

        // 变换控制器 (只负责旋转)
        this.transform = null;
        setTimeout(() => {
            try {
                if (typeof TransformControls === 'undefined') return;
                const canvas = this.container.querySelector('canvas.laoli-3d-canvas');
                if(!canvas) return;
                
                this.transform = new TransformControls(this.camera, canvas);
                this.transform.setSize(0.8); 
                this.transform.space = "local"; // 骨骼旋转使用局部坐标
                this.transform.setMode("rotate"); // 锁定为旋转模式
                
                if (typeof this.transform.traverse === 'function') {
                    this.transform.traverse(obj => { 
                        if(obj.material) { obj.material.depthTest = false; obj.material.transparent = true; }
                    });
                }
                this.scene.add(this.transform);
                
                this.transform.addEventListener('dragging-changed', (e) => {
                    this.orbit.enabled = !e.value;
                });
                this.transform.addEventListener('change', () => { 
                    if(this.currentBone && this.callbacks.onBoneSelect) this.callbacks.onBoneSelect(this.currentBone); 
                });
                
            } catch (e) { console.error(e); }
        }, 200);

        this.raycaster = new THREE.Raycaster(); 
        this.mouse = new THREE.Vector2(); 
        this.mdPos = new THREE.Vector2();
        
        this.renderer.domElement.addEventListener('pointerdown', e => this.mdPos.set(e.clientX, e.clientY));
        this.renderer.domElement.addEventListener('pointerup', e => this.onClick(e));

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
        
        new ResizeObserver(e => { 
            for(let i of e) { 
                if(i.contentRect.width>0 && this.renderer) { 
                    this.renderer.setSize(i.contentRect.width, i.contentRect.height); 
                    this.camera.aspect=i.contentRect.width/i.contentRect.height; 
                    this.camera.updateProjectionMatrix(); 
                } 
            } 
        }).observe(container);
    }

    animate() { 
        requestAnimationFrame(this.animate); 
        this.orbit.update(); 
        this.renderer.render(this.scene, this.camera); 
    }

    loadModel(url, onLoad) {
        fetch(url).then(r=>r.arrayBuffer()).then(b => {
            new GLTFLoader().parse(b, "", (gltf) => {
                const grp = new THREE.Group(); 
                grp.add(gltf.scene); 
                this.scene.add(grp);
                
                const bones = []; 
                const meshes = [];
                gltf.scene.traverse(o => { 
                    if(o.isSkinnedMesh) { 
                        o.frustumCulled = false; 
                        o.castShadow = true; 
                        o.receiveShadow = true;
                        meshes.push(o); 
                    } 
                    if(o.isBone && !o.name.includes("End")) { 
                        bones.push(o); 
                        o.userData.bindQ = o.quaternion.clone(); 
                    } 
                });
                
                const char = { 
                    id: Math.random(), 
                    name: url.split('/').pop(), 
                    group: grp, 
                    bones: bones, 
                    meshes: meshes, 
                    helper: new THREE.SkeletonHelper(gltf.scene), 
                    userData: { calibration: { hipsAngle: 180, armLift: 0, armTwist: 0 }, boneCorrections: {} } 
                };
                
                grp.traverse(o => o.userData.charId = char.id);
                const box = new THREE.Box3().setFromObject(grp); 
                grp.scale.setScalar(1.7 / (box.getSize(new THREE.Vector3()).y || 1.7));
                
                this.characters.push(char); 
                this.activateCharacter(char);
                if(onLoad) onLoad(char);
            });
        });
    }

    activateCharacter(c) {
        this.activeCharacter = c;
        this.characters.forEach(x => { if(x.helper) x.helper.visible = false; });
        this.selectBone(null);
        if(this.callbacks.onCharacterActivated) this.callbacks.onCharacterActivated(c);
    }

    removeActiveCharacter() {
        if(!this.activeCharacter) return;
        const c = this.activeCharacter;
        this.scene.remove(c.group); 
        if(c.helper) this.scene.remove(c.helper);
        this.characters = this.characters.filter(x=>x.id!==c.id);
        if(this.transform) this.transform.detach(); 
        this.activateCharacter(this.characters.length > 0 ? this.characters[this.characters.length-1] : null);
    }

    selectBone(b) {
        this.currentBone = b;
        if(this.transform) {
            this.transform.detach();
            if(b) this.transform.attach(b);
        }
        
        this.boneMarker.visible = !!b;
        if(b) { 
            this.boneMarker.position.setFromMatrixPosition(b.matrixWorld); 
            const n = b.name.toLowerCase();
            let scale = 1.0;
            if (n.includes('finger') || n.includes('thumb') || n.includes('hand')) scale = 0.4; 
            else if (n.includes('head') || n.includes('foot')) scale = 1.2;
            else if (n.includes('hips') || n.includes('spine') || n.includes('arm')) scale = 1.8;
            this.boneMarker.scale.setScalar(scale);
        }
        if(this.callbacks.onBoneSelect) this.callbacks.onBoneSelect(b);
    }

    onClick(e) {
        if(Math.abs(e.clientX-this.mdPos.x)>2) return;
        
        const r = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX-r.left)/r.width)*2-1; this.mouse.y = -((e.clientY-r.top)/r.height)*2+1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        let bestBone = null; 
        let minDistance = Infinity;

        // 1. 优先尝试点选骨骼 (精准)
        if (this.activeCharacter) {
            this.activeCharacter.group.updateMatrixWorld(true);
            const ray = this.raycaster.ray; 
            const bonePos = new THREE.Vector3();
            this.activeCharacter.bones.forEach(bone => {
                bone.getWorldPosition(bonePos);
                const distSq = ray.distanceSqToPoint(bonePos);
                if (distSq < 0.005) { 
                    if (distSq < minDistance) { minDistance = distSq; bestBone = bone; } 
                }
            });
        }

        // 2. 如果没点到骨骼，尝试点击身体Mesh辅助定位
        if (!bestBone) {
            const hits = this.raycaster.intersectObjects(this.characters.flatMap(c=>c.meshes));
            if(hits.length) {
                const char = this.characters.find(x=>x.id===hits[0].object.userData.charId);
                if(char !== this.activeCharacter) this.activateCharacter(char);
                
                const hitPoint = hits[0].point; 
                let minDist = Infinity;
                char.bones.forEach(b => { 
                    const d = b.getWorldPosition(new THREE.Vector3()).distanceTo(hitPoint); 
                    if(d<minDist){minDist=d; bestBone=b;} 
                });
            }
        }
        
        this.selectBone(bestBone);
    }

    applyPose(data) { 
        retargetPose(this.activeCharacter, data); 
    }
    
    setTransformMode(mode) { 
        if(this.transform) this.transform.setMode(mode); 
    }

    calculateHandCrop(side) {
        if (!this.activeCharacter) return null;
        const rendererSize = new THREE.Vector2();
        this.renderer.getSize(rendererSize);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let found = false;
        const tempV = new THREE.Vector3();
        this.activeCharacter.bones.forEach(b => {
            const n = b.name;
            const isHandPart = n.includes('Hand') || n.includes('Finger') || n.includes('Thumb') || n.includes('Index') || n.includes('Middle') || n.includes('Ring') || n.includes('Pinky');
            if (isHandPart) {
                if (side && !n.includes(side)) return;
                b.getWorldPosition(tempV);
                tempV.project(this.camera); 
                const x = (tempV.x * 0.5 + 0.5) * rendererSize.width;
                const y = (-(tempV.y) * 0.5 + 0.5) * rendererSize.height;
                if (Math.abs(tempV.z) < 1) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    found = true;
                }
            }
        });
        if (!found) return null;
        const padding = 60; 
        minX = Math.max(0, minX - padding); minY = Math.max(0, minY - padding);
        maxX = Math.min(rendererSize.width, maxX + padding); maxY = Math.min(rendererSize.height, maxY + padding);
        let w = maxX - minX; let h = maxY - minY;
        const size = Math.max(w, h);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        return { left: cx - size / 2, top: cy - size / 2, width: size, height: size };
    }

    getSnapshot(width, height, cropRect, targetSide) {
        if(this.transform) this.transform.detach(); 
        this.boneMarker.visible = false; 
        this.characters.forEach(c => { if(c.helper) c.helper.visible = false; }); 
        this.grid.visible = false;
        
        if (targetSide) {
            const handRect = this.calculateHandCrop(targetSide);
            if (handRect) cropRect = handRect;
        }

        const oldSize = new THREE.Vector2(); this.renderer.getSize(oldSize); 
        const oldAspect = this.camera.aspect;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        if(cropRect) {
             let fullW, fullH, x, y, w, h;
             if (targetSide) {
                 const scaleX = oldSize.width / cropRect.width;
                 const scaleY = oldSize.height / cropRect.height;
                 this.camera.setViewOffset(width * scaleX, height * scaleY, width * (cropRect.left / cropRect.width), height * (cropRect.top / cropRect.height), width, height);
             } else {
                 const r = this.container.getBoundingClientRect();
                 const rx = (cropRect.left - r.left) / r.width;
                 const ry = (cropRect.top - r.top) / r.height;
                 const rw = cropRect.width / r.width;
                 const rh = cropRect.height / r.height;
                 this.camera.setViewOffset(width/rw, height/rh, width*(rx/rw), height*(ry/rh), width, height);
             }
        }
        
        this.renderer.render(this.scene, this.camera); const rgb = this.renderer.domElement.toDataURL("image/png");
        this.scene.overrideMaterial = new THREE.MeshNormalMaterial(); this.renderer.render(this.scene, this.camera); const norm = this.renderer.domElement.toDataURL("image/png");
        this.scene.overrideMaterial = null; this.scene.background = new THREE.Color(0);
        this.renderer.render(this.scene, this.camera); const pose = this.renderer.domElement.toDataURL("image/png");
        
        this.scene.background = new THREE.Color(0x222222); this.grid.visible = true; 
        this.camera.clearViewOffset(); 
        this.renderer.setSize(oldSize.width, oldSize.height); 
        this.camera.aspect = oldAspect;
        this.camera.updateProjectionMatrix();
        
        if(this.currentBone && this.transform) this.transform.attach(this.currentBone);
        this.boneMarker.visible = !!this.currentBone;
        return { rgb, normal: norm, pose_img: pose };
    }
}