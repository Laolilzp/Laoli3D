import * as THREE from './LaoliThree.js';

const {
	Mesh, MeshBasicMaterial, Object3D, TorusGeometry, SphereGeometry,
	Quaternion, Raycaster, Vector3, Matrix4, DoubleSide, PlaneGeometry,
    Vector2, MathUtils
} = THREE;

const raycaster = new Raycaster();

// === 事件变量定义 (修复报错的关键) ===
const changeEvent = { type: 'change' };
const mouseDownEvent = { type: 'mouseDown' };
const mouseUpEvent = { type: 'mouseUp' };
const objectChangeEvent = { type: 'objectChange' };

// === Blender 风格配置 ===
const GIZMO_CONFIG = {
    colors: {
        X: 0xFF3333, // 红
        Y: 0x44FF44, // 绿
        Z: 0x3333FF, // 蓝
        W: 0xFFFFFF, // 白 (视图环)
        H: 0xFFFF00, // 黄 (高亮)
        G: 0xFFFFFF  // 中间球高亮色 (白)
    },
    dims: {
        radius: 1.0,        // 基础半径
        tubeVis: 0.01,      // 视觉线宽 (极细，精致)
        tubeHit: 0.15,      // 点击判定宽 (粗，好点)
        screenSize: 150     // 屏幕像素大小
    }
};

class TransformControls extends Object3D {

	constructor( camera, domElement ) {
		super();

		if ( domElement === undefined ) domElement = document;

		this.visible = false;
		this.domElement = domElement;
		this.camera = camera;
		this.object = undefined;
		this.axis = null; // 'X', 'Y', 'Z', 'E'(Eye/View), 'XYZ'(Ball)
		this.mode = 'rotate'; 
		this.space = 'local';
		this.size = 1;
		this.dragging = false;
        this.enabled = true;

        // 1. 内部 Gizmo
		this._gizmo = new TransformControlsGizmo( this );
		this.add( this._gizmo );

        // 2. 交互状态变量
        const scope = this;
        const startQuaternion = new Quaternion();
        const alignVector = new Vector3();
        
        // 切线拖拽变量
        const centerScreen = new Vector2();
        const startMouse = new Vector2();
        const curMouse = new Vector2();
        const rotationAxis = new Vector3();

        // 鼠标事件
		function onPointerDown( event ) {
			if ( !scope.enabled || !scope.visible ) return;
            
            const rect = domElement.getBoundingClientRect();
            const x = ( event.clientX - rect.left ) / rect.width;
            const y = ( event.clientY - rect.top ) / rect.height;
            const pointer = new Vector2( ( x * 2 ) - 1, - ( y * 2 ) + 1 );
            
            raycaster.setFromCamera( pointer, scope.camera );
            
			const intersections = raycaster.intersectObjects( scope._gizmo.pickers, true );

			if ( intersections.length > 0 ) {
                event.preventDefault();
                event.stopPropagation();
                
                const object = intersections[0].object;
                scope.axis = object.name; 
				scope.dragging = true;
                
                // 锁定相机
                scope.dispatchEvent( { type: 'dragging-changed', value: true } );
                
                if ( scope.object ) {
                    scope.object.updateMatrixWorld();
                    startQuaternion.copy( scope.object.quaternion );
                    startMouse.set( pointer.x, pointer.y );
                    
                    const centerPos = new Vector3().setFromMatrixPosition( scope.object.matrixWorld );
                    centerPos.project( scope.camera );
                    centerScreen.set( centerPos.x, centerPos.y );
                    
                    const quat = scope.space === "local" ? scope.object.quaternion : new Quaternion();
                    
                    if (scope.axis === 'X') rotationAxis.set(1, 0, 0).applyQuaternion(quat);
                    else if (scope.axis === 'Y') rotationAxis.set(0, 1, 0).applyQuaternion(quat);
                    else if (scope.axis === 'Z') rotationAxis.set(0, 0, 1).applyQuaternion(quat);
                    else if (scope.axis === 'E') scope.camera.getWorldDirection(rotationAxis); 
                    
                    rotationAxis.normalize();
                }
			}
		}

		function onPointerMove( event ) {
			if ( !scope.enabled ) return;

            const rect = domElement.getBoundingClientRect();
            const x = ( event.clientX - rect.left ) / rect.width;
            const y = ( event.clientY - rect.top ) / rect.height;
            const pointer = new Vector2( ( x * 2 ) - 1, - ( y * 2 ) + 1 );

            // 1. 悬停高亮
            if ( !scope.dragging ) {
                raycaster.setFromCamera( pointer, scope.camera );
                const intersections = raycaster.intersectObjects( scope._gizmo.pickers, true );
                
                scope._gizmo.highlight(null);
                if ( intersections.length > 0 ) {
                    scope._gizmo.highlight(intersections[0].object.name);
                    domElement.style.cursor = 'pointer';
                } else {
                    domElement.style.cursor = 'auto';
                }
                return;
            }

            // 2. 拖拽旋转
			if ( scope.dragging && scope.object && scope.axis ) {
				event.preventDefault();
				event.stopPropagation();

                curMouse.copy( pointer );
                let angle = 0;

                if (scope.axis === 'XYZ') {
                    // 自由球：简单的屏幕映射
                    const dx = curMouse.x - startMouse.x;
                    const dy = curMouse.y - startMouse.y;
                    
                    // 构造基于相机的旋转
                    const moveSpeed = 4.0;
                    const up = new Vector3(0, 1, 0).applyQuaternion(scope.camera.quaternion).normalize();
                    const right = new Vector3(1, 0, 0).applyQuaternion(scope.camera.quaternion).normalize();
                    
                    const rotX = new Quaternion().setFromAxisAngle(up, dx * moveSpeed);
                    const rotY = new Quaternion().setFromAxisAngle(right, -dy * moveSpeed);
                    
                    const rot = new Quaternion().multiplyQuaternions(rotX, rotY);
                    scope.object.quaternion.copy(startQuaternion).premultiply(rot);
                    scope.object.updateMatrixWorld();
                    
                    scope.dispatchEvent( changeEvent );
                    return; // 自由旋转直接返回
                } 
                else if (scope.axis === 'E') {
                    const vec1 = new Vector2().subVectors( startMouse, centerScreen );
                    const vec2 = new Vector2().subVectors( curMouse, centerScreen );
                    angle = vec2.angle() - vec1.angle();
                }
                else {
                    // 三轴切线算法
                    const centerPos = new Vector3().setFromMatrixPosition( scope.object.matrixWorld );
                    const axisEnd = centerPos.clone().add( rotationAxis );
                    centerPos.project( scope.camera );
                    axisEnd.project( scope.camera );
                    const screenAxis = new Vector2( axisEnd.x - centerPos.x, axisEnd.y - centerPos.y );
                    const tangent = new Vector2( -screenAxis.y, screenAxis.x ).normalize();
                    const mouseDelta = new Vector2().subVectors( curMouse, startMouse );
                    angle = mouseDelta.dot( tangent ) * 4.0; 
                }

                const rotQuat = new Quaternion().setFromAxisAngle( rotationAxis, angle );
                scope.object.quaternion.copy( startQuaternion ).premultiply( rotQuat );
                scope.object.updateMatrixWorld();
                
				scope.dispatchEvent( changeEvent );
			}
		}

		function onPointerUp( event ) {
            if(scope.dragging) {
                event.preventDefault();
                scope.dragging = false;
                scope.axis = null;
                scope.dispatchEvent( { type: 'dragging-changed', value: false } );
            }
		}

		domElement.addEventListener( 'pointerdown', onPointerDown );
		const doc = domElement.ownerDocument || document;
		doc.addEventListener( 'pointermove', onPointerMove );
		doc.addEventListener( 'pointerup', onPointerUp );
	}

    updateMatrixWorld( force ) {
		if ( this.object ) {
			this.object.updateMatrixWorld();
			this.position.setFromMatrixPosition( this.object.matrixWorld );
            
            if ( this.space === 'local' ) this.quaternion.setFromRotationMatrix( this.object.matrixWorld );
            else this.quaternion.set( 0, 0, 0, 1 );
            
            if ( this.camera ) {
                const dist = this.position.distanceTo( this.camera.position );
                // 调整这个系数可以改变屏幕占比
                const scale = dist * (GIZMO_CONFIG.dims.screenSize / 1000); 
                this.scale.setScalar( scale * this.size );
            }
            this._gizmo.updateViewRing( this.camera );
		}
		super.updateMatrixWorld( force );
	}

    setSize( size ) { this.size = size; }
    setMode( mode ) { this.mode = mode; }
    setSpace( space ) { this.space = space; }
    attach( object ) { this.object = object; this.visible = true; return this; }
    detach() { this.object = undefined; this.visible = false; this.axis = null; return this; }
    dispose() {} 
    getMode() { return this.mode; }
}

// === 视觉组件 ===
class TransformControlsGizmo extends Object3D {
	constructor( controls ) {
		super();
		this.isTransformControlsGizmo = true;
        this.pickers = []; 
        this.visuals = {}; 

        // 材质
        const mat = {
            X: new MeshBasicMaterial({ color: GIZMO_CONFIG.colors.X, depthTest: false, transparent: true, opacity: 0.8 }),
            Y: new MeshBasicMaterial({ color: GIZMO_CONFIG.colors.Y, depthTest: false, transparent: true, opacity: 0.8 }),
            Z: new MeshBasicMaterial({ color: GIZMO_CONFIG.colors.Z, depthTest: false, transparent: true, opacity: 0.8 }),
            W: new MeshBasicMaterial({ color: GIZMO_CONFIG.colors.W, depthTest: false, transparent: true, opacity: 0.4 }), 
            H: new MeshBasicMaterial({ color: GIZMO_CONFIG.colors.H, depthTest: false, transparent: true, opacity: 1.0 }),

            H_Ball: new MeshBasicMaterial({ color: 0xFFFFFF, depthTest: false, transparent: true, opacity: 0.25 }),
            Inv: new MeshBasicMaterial({ visible: false, depthTest: false }) 
        };

        // 几何体
        const geoVis = new TorusGeometry( GIZMO_CONFIG.dims.radius, GIZMO_CONFIG.dims.tubeVis, 4, 64 );
        const geoHit = new TorusGeometry( GIZMO_CONFIG.dims.radius, GIZMO_CONFIG.dims.tubeHit, 4, 12 );
        const geoView = new TorusGeometry( GIZMO_CONFIG.dims.radius * 1.25, GIZMO_CONFIG.dims.tubeVis, 4, 64 );
        const geoViewHit = new TorusGeometry( GIZMO_CONFIG.dims.radius * 1.25, GIZMO_CONFIG.dims.tubeHit, 4, 12 );

        const addAxis = (axis, rotationAxis, angle, material, isViewRing = false) => {
            const group = new Object3D();
            const mesh = new Mesh(isViewRing ? geoView : geoVis, material.clone());
            if(rotationAxis) mesh.rotation[rotationAxis] = angle;
            mesh.name = axis;
            group.add(mesh);
            this.visuals[axis] = mesh; 

            const picker = new Mesh(isViewRing ? geoViewHit : geoHit, mat.Inv);
            if(rotationAxis) picker.rotation[rotationAxis] = angle;
            picker.name = axis;
            group.add(picker);
            this.pickers.push(picker);
            return group;
        };

        this.add( addAxis('X', 'y', Math.PI / 2, mat.X) );
        this.add( addAxis('Y', 'x', Math.PI / 2, mat.Y) );
        this.add( addAxis('Z', null, 0, mat.Z) );
        this.viewGroup = addAxis('E', null, 0, mat.W, true);
        this.add( this.viewGroup );

        // 内部球 (XYZ)
        // 视觉：非常淡，几乎看不见
        const geoBall = new SphereGeometry( GIZMO_CONFIG.dims.radius * 0.85, 16, 16 );
        const matBall = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthTest: false });
        const ball = new Mesh( geoBall, matBall );
        const ballPicker = new Mesh( geoBall, mat.Inv );
        ballPicker.name = 'XYZ';
        this.add(ball);
        this.add(ballPicker);
        this.pickers.push(ballPicker);
        this.visuals['XYZ'] = ball;

        // 高亮逻辑
        this.highlight = function(axis) {
            ['X','Y','Z','E','XYZ'].forEach(key => {
                const mesh = this.visuals[key];
                if(!mesh) return;
                
                if (key === axis) {
                    if (key === 'XYZ') {
                        // 中间球高亮：用专用材质，淡淡的白
                        mesh.material = mat.H_Ball;
                    } else {
                        // 轴高亮：黄色
                        mesh.material.color.setHex( GIZMO_CONFIG.colors.H );
                        mesh.material.opacity = 1.0;
                        mesh.scale.setScalar(1.2); 
                    }
                } else {

                    if (key === 'XYZ') {
                        mesh.material = matBall; 
                    } else {
                        mesh.material.color.setHex( GIZMO_CONFIG.colors[key] || 0xffffff );
                        mesh.material.opacity = (key === 'E' ? 0.4 : 0.8);
                        mesh.scale.setScalar(1.0);
                    }
                }
            });
        }
        
        this.updateViewRing = function(camera) {
            if(this.viewGroup) {
                const invParent = this.parent.quaternion.clone().invert();
                this.viewGroup.quaternion.copy(camera.quaternion).premultiply(invParent);
            }
        }
	}
}

export { TransformControls };