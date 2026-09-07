import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * 初始化 DNA 3D 场景（化学结构式风格 + 构建动画）
 * @param {string} containerId - DOM 元素 ID，用于挂载 canvas
 */
export function initDNA(containerId = 'canvas-container') {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);

    // ---------- 场景、相机、渲染器 ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(22, 10, 28);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false; // 性能考虑
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ---------- 控制器（支持拖拽旋转/缩放） ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = false;
    controls.target.set(0, 0, 0);
    controls.minDistance = 10;
    controls.maxDistance = 60;
    controls.update();

    // ---------- 灯光系统 ----------
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    keyLight.position.set(10, 20, 15);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.8);
    fillLight.position.set(-15, 5, -10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x88aaff, 0.5);
    rimLight.position.set(0, -10, 20);
    scene.add(rimLight);

    const hemi = new THREE.HemisphereLight(0x4466ff, 0x222244, 0.6);
    scene.add(hemi);

    // ---------- DNA 参数 ----------
    const RADIUS = 5.0;           // 螺旋半径
    const HEIGHT = 16;            // 总高度
    const TURNS = 2.8;            // 旋转圈数
    const PAIRS = 30;             // 碱基对数量
    const SPACING = HEIGHT / PAIRS;
    const BASE_RADIUS = 0.6;      // 碱基球体大小

    // 碱基颜色 (A/T/G/C)
    const colorMap = {
        'A': 0xff6b6b,
        'T': 0x4ecdc4,
        'G': 0xffe66d,
        'C': 0xa29bfe
    };
    const baseLetters = ['A', 'T', 'G', 'C'];
    const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };

    // ---------- 辅助: 创建圆柱连接 ----------
    function createCylinderBetween(p1, p2, color = 0x88aaff, radius = 0.08, opacity = 0.6, emissive = 0x224466) {
        const start = new THREE.Vector3(p1.x, p1.y, p1.z);
        const end = new THREE.Vector3(p2.x, p2.y, p2.z);
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        if (len < 0.001) return null;
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const geo = new THREE.CylinderGeometry(radius, radius, len, 6);
        const mat = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            emissive: emissive,
            emissiveIntensity: 0.1
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.clone().normalize()
        );
        return mesh;
    }

    // ---------- 存储所有可交互的碱基球体 ----------
    const baseMeshes = [];

    // ---------- 存储每个碱基对的组（用于动画） ----------
    const pairGroups = [];

    // ---------- 预先计算最终和初始位置 ----------
    // 最终位置：螺旋
    const finalPositions = [];
    // 初始位置：在X轴上排成一行，Y=0，Z=0
    const initialPositions = [];
    const spacingInit = RADIUS * 0.9; // 平面排列时相邻间距

    for (let i = 0; i < PAIRS; i++) {
        const t = i / PAIRS;
        const angle = t * Math.PI * 2 * TURNS;
        const y = -HEIGHT / 2 + i * SPACING;
        // 两条链的偏移
        const x1 = Math.cos(angle) * RADIUS;
        const z1 = Math.sin(angle) * RADIUS;
        const x2 = Math.cos(angle + Math.PI) * RADIUS;
        const z2 = Math.sin(angle + Math.PI) * RADIUS;

        // 初始平面位置（沿X轴排列，链1在左侧，链2在右侧）
        const initX1 = - (PAIRS / 2) * spacingInit + i * spacingInit - RADIUS * 0.5;
        const initX2 = - (PAIRS / 2) * spacingInit + i * spacingInit + RADIUS * 0.5;
        const initY = 0;
        const initZ = 0;

        finalPositions.push({
            pos1: new THREE.Vector3(x1, y, z1),
            pos2: new THREE.Vector3(x2, y, z2)
        });
        initialPositions.push({
            pos1: new THREE.Vector3(initX1, initY, initZ),
            pos2: new THREE.Vector3(initX2, initY, initZ)
        });
    }

    // ---------- 构建场景中的 DNA 元素 ----------
    // 1. 碱基对 (球体 + 氢键 + 环装饰)
    // 2. 骨架线条 (使用 LineSegments 以便动态更新)

    // 存储用于更新骨架的顶点数组
    const skeletonPositions1 = new Float32Array(PAIRS * 3);
    const skeletonPositions2 = new Float32Array(PAIRS * 3);

    // 创建骨架线条 (两条链)
    const skeletonGeo = new THREE.BufferGeometry();
    // 我们使用两个独立线条，或者一个LineSegments包含两段。这里用两个Line。
    const lineMat = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.4 });
    const line1 = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    const line2 = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    scene.add(line1);
    scene.add(line2);

    // 用于存储每个碱基对的 Mesh 引用，以便更新位置
    const pairMeshes = [];

    // 创建每个碱基对
    for (let i = 0; i < PAIRS; i++) {
        const base1 = baseLetters[i % 4];
        const base2 = complement[base1];

        // 创建两个碱基球体
        const sphereGeo = new THREE.SphereGeometry(BASE_RADIUS, 28, 28);
        const mat1 = new THREE.MeshPhongMaterial({
            color: colorMap[base1],
            emissive: 0x000000,
            emissiveIntensity: 0.2,
            roughness: 0.3,
            metalness: 0.1
        });
        const sphere1 = new THREE.Mesh(sphereGeo, mat1);
        sphere1.userData = { base: base1, index: i, chain: 1 };

        const mat2 = new THREE.MeshPhongMaterial({
            color: colorMap[base2],
            emissive: 0x000000,
            emissiveIntensity: 0.2,
            roughness: 0.3,
            metalness: 0.1
        });
        const sphere2 = new THREE.Mesh(sphereGeo.clone(), mat2);
        sphere2.userData = { base: base2, index: i, chain: 2 };

        // 存储初始和最终位置到 userData
        sphere1.userData.initialPos = initialPositions[i].pos1.clone();
        sphere1.userData.finalPos = finalPositions[i].pos1.clone();
        sphere2.userData.initialPos = initialPositions[i].pos2.clone();
        sphere2.userData.finalPos = finalPositions[i].pos2.clone();
        // 当前插值位置（将在动画中更新）
        sphere1.userData.currentPos = sphere1.userData.initialPos.clone();
        sphere2.userData.currentPos = sphere2.userData.initialPos.clone();

        scene.add(sphere1);
        scene.add(sphere2);
        baseMeshes.push(sphere1);
        baseMeshes.push(sphere2);

        // 氢键 (连接两个碱基的细圆柱)
        const bond = createCylinderBetween(
            sphere1.userData.initialPos,
            sphere2.userData.initialPos,
            0xffffff, 0.06, 0.25, 0x335577
        );
        if (bond) {
            bond.userData.type = 'bond';
            bond.userData.pairIndex = i;
            // 存储两端引用以便更新
            bond.userData.sphere1 = sphere1;
            bond.userData.sphere2 = sphere2;
            scene.add(bond);
            // 存储以便更新
            pairMeshes.push({ sphere1, sphere2, bond });
        } else {
            pairMeshes.push({ sphere1, sphere2, bond: null });
        }

        // 环装饰 (代表嘧啶/嘌呤环)
        const ringMat = new THREE.MeshPhongMaterial({
            color: 0xffaa44,
            emissive: 0x442200,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.6
        });
        const ringGeo = new THREE.TorusGeometry(BASE_RADIUS * 0.9, 0.07, 8, 16);
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.position.copy(sphere1.userData.initialPos);
        ring1.position.y += 0.5;
        ring1.rotation.x = Math.PI / 2;
        ring1.userData.type = 'ring';
        ring1.userData.parentSphere = sphere1;
        scene.add(ring1);

        const ring2 = new THREE.Mesh(ringGeo.clone(), ringMat);
        ring2.position.copy(sphere2.userData.initialPos);
        ring2.position.y += 0.5;
        ring2.rotation.x = Math.PI / 2;
        ring2.userData.type = 'ring';
        ring2.userData.parentSphere = sphere2;
        scene.add(ring2);

        // 存储环引用
        pairMeshes[i].ring1 = ring1;
        pairMeshes[i].ring2 = ring2;

        // 在碱基球体上添加一个小亮点 (代表原子)
        const dotMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
        const dotGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const dot1 = new THREE.Mesh(dotGeo, dotMat);
        dot1.position.set(0.3, 0.3, 0.3);
        sphere1.add(dot1);
        const dot2 = new THREE.Mesh(dotGeo.clone(), dotMat);
        dot2.position.set(-0.3, -0.3, -0.3);
        sphere2.add(dot2);
    }

    // 创建磷酸基团 (在骨架上的小球，放在每个碱基外侧)
    const phosphateMat = new THREE.MeshPhongMaterial({
        color: 0xffaa66,
        emissive: 0x442200,
        emissiveIntensity: 0.1,
        roughness: 0.4,
        metalness: 0.3
    });
    const phosphateGeo = new THREE.SphereGeometry(0.3, 12, 12);
    // 存储磷酸Mesh以便更新位置
    const phosphates = [];

    for (let i = 0; i < PAIRS; i++) {
        // 链1 外侧
        const p1 = new THREE.Mesh(phosphateGeo, phosphateMat);
        const initPos1 = initialPositions[i].pos1.clone();
        // 向外偏移 (沿径向)
        const dir1 = new THREE.Vector3(1, 0, 0); // 初始平面朝X正方向
        p1.position.copy(initPos1).add(dir1.multiplyScalar(0.8));
        p1.userData.initialPos = p1.position.clone();
        // 最终位置：在螺旋外侧
        const finalPos1 = finalPositions[i].pos1.clone();
        const radialDir1 = finalPos1.clone().normalize();
        p1.userData.finalPos = finalPos1.clone().add(radialDir1.multiplyScalar(0.8));
        scene.add(p1);
        phosphates.push(p1);

        // 链2 外侧
        const p2 = new THREE.Mesh(phosphateGeo.clone(), phosphateMat);
        const initPos2 = initialPositions[i].pos2.clone();
        const dir2 = new THREE.Vector3(-1, 0, 0);
        p2.position.copy(initPos2).add(dir2.multiplyScalar(0.8));
        p2.userData.initialPos = p2.position.clone();
        const finalPos2 = finalPositions[i].pos2.clone();
        const radialDir2 = finalPos2.clone().normalize();
        p2.userData.finalPos = finalPos2.clone().add(radialDir2.multiplyScalar(0.8));
        scene.add(p2);
        phosphates.push(p2);
    }

    // ---------- 背景星空 ----------
    const starCount = 1500;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
        starPos[i] = (Math.random() - 0.5) * 300;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
        color: 0x88aaff,
        size: 0.15,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ---------- 构建动画控制 ----------
    let buildProgress = 0;           // 0 ~ 1
    let isBuilding = true;
    const buildDuration = 6.0;       // 秒
    const startTime = performance.now() / 1000;

    // 每个碱基对的延迟系数 (0~1)
    const delays = new Array(PAIRS).fill(0).map((_, i) => i / PAIRS);

    // ---------- 鼠标交互 (Raycaster) ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredBase = null;

    function onPointerMove(event) {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    window.addEventListener('pointermove', onPointerMove);

    // ---------- 更新位置函数 (插值) ----------
    function updatePositions(progress) {
        // progress: 0~1
        for (let i = 0; i < PAIRS; i++) {
            // 计算每个碱基对的进度：带延迟的缓动
            const delay = delays[i] * 0.7; // 最大延迟0.7
            let pairProgress = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
            // 使用缓动函数 easeInOutCubic
            const ease = pairProgress < 0.5
                ? 4 * pairProgress * pairProgress * pairProgress
                : 1 - Math.pow(-2 * pairProgress + 2, 3) / 2;

            const p = ease;

            const init1 = initialPositions[i].pos1;
            const final1 = finalPositions[i].pos1;
            const init2 = initialPositions[i].pos2;
            const final2 = finalPositions[i].pos2;

            // 插值位置
            const cur1 = new THREE.Vector3().lerpVectors(init1, final1, p);
            const cur2 = new THREE.Vector3().lerpVectors(init2, final2, p);

            // 更新碱基球体
            const pair = pairMeshes[i];
            pair.sphere1.position.copy(cur1);
            pair.sphere2.position.copy(cur2);
            // 更新 userData 当前位
            pair.sphere1.userData.currentPos.copy(cur1);
            pair.sphere2.userData.currentPos.copy(cur2);

            // 更新氢键 (圆柱)
            if (pair.bond) {
                const bond = pair.bond;
                const start = cur1;
                const end = cur2;
                const dir = new THREE.Vector3().subVectors(end, start);
                const len = dir.length();
                if (len > 0.001) {
                    bond.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
                    bond.scale.y = len / 0.1; // 因为圆柱默认高度1，我们之前radius是0.06，长度需要调整
                    // 重新设置旋转
                    bond.quaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        dir.clone().normalize()
                    );
                }
            }

            // 更新环装饰 (跟随球体)
            if (pair.ring1) {
                pair.ring1.position.copy(cur1);
                pair.ring1.position.y += 0.5;
            }
            if (pair.ring2) {
                pair.ring2.position.copy(cur2);
                pair.ring2.position.y += 0.5;
            }

            // 更新骨架线条顶点
            skeletonPositions1[i * 3] = cur1.x;
            skeletonPositions1[i * 3 + 1] = cur1.y;
            skeletonPositions1[i * 3 + 2] = cur1.z;
            skeletonPositions2[i * 3] = cur2.x;
            skeletonPositions2[i * 3 + 1] = cur2.y;
            skeletonPositions2[i * 3 + 2] = cur2.z;
        }

        // 更新磷酸基团位置
        for (let i = 0; i < PAIRS; i++) {
            const p = Math.min(1, progress); // 简单跟随
            const phos1 = phosphates[i * 2];
            const phos2 = phosphates[i * 2 + 1];
            if (phos1) {
                const init = phos1.userData.initialPos;
                const fin = phos1.userData.finalPos;
                phos1.position.lerpVectors(init, fin, p);
            }
            if (phos2) {
                const init = phos2.userData.initialPos;
                const fin = phos2.userData.finalPos;
                phos2.position.lerpVectors(init, fin, p);
            }
        }

        // 更新骨架线
        const geo1 = line1.geometry;
        geo1.setAttribute('position', new THREE.BufferAttribute(skeletonPositions1, 3));
        geo1.computeBoundingSphere();
        const geo2 = line2.geometry;
        geo2.setAttribute('position', new THREE.BufferAttribute(skeletonPositions2, 3));
        geo2.computeBoundingSphere();
    }

    // 初始调用一次，使所有物体处于初始位置
    updatePositions(0);

    // ---------- 动画循环 ----------
    function animate() {
        requestAnimationFrame(animate);

        const now = performance.now() / 1000;
        const elapsed = now - startTime;

        if (isBuilding) {
            // 计算构建进度
            buildProgress = Math.min(1, elapsed / buildDuration);
            updatePositions(buildProgress);

            if (buildProgress >= 1) {
                isBuilding = false;
                // 构建完成，可以开启更强的交互效果
            }
        } else {
            // 构建完成后，可以添加一些微小的浮动动画（可选）
            // 这里不额外处理，保持静止
        }

        // ----- 鼠标吸附交互 (仅在构建完成后生效) -----
        if (!isBuilding) {
            // 恢复上一次悬停的碱基
            if (hoveredBase) {
                const mat = hoveredBase.material;
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0.2;
                if (hoveredBase.userData.originalPosition) {
                    hoveredBase.position.copy(hoveredBase.userData.originalPosition);
                }
                hoveredBase = null;
            }

            // 射线检测
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(baseMeshes);

            if (intersects.length > 0) {
                const hit = intersects[0].object;
                if (hit.userData && hit.userData.base) {
                    hoveredBase = hit;
                    // 高亮发光
                    const mat = hit.material;
                    mat.emissive.setHex(0x4488ff);
                    mat.emissiveIntensity = 0.9;

                    // 保存原始位置（首次）
                    if (!hit.userData.originalPosition) {
                        hit.userData.originalPosition = hit.position.clone();
                    }
                    // 吸附：向相机方向移动
                    const dir = new THREE.Vector3()
                        .subVectors(camera.position, hit.position)
                        .normalize();
                    hit.position.copy(hit.userData.originalPosition).add(dir.multiplyScalar(0.6));
                }
            }
        }

        controls.update();
        renderer.render(scene, camera);
    }

    animate();

    // ---------- 窗口自适应 ----------
    window.addEventListener('resize', () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    // ---------- 返回控制器 (方便调试) ----------
    return { scene, camera, controls, renderer };
}
