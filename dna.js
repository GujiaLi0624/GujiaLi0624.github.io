import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * 长DNA化学结构模型 + 无限滚动 + 构建动画
 */
export function initDNA(containerId = 'canvas-container') {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);

    // ---------- 场景 ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);

    // ---------- 相机 ----------
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(20, 10, 26);
    camera.lookAt(0, 0, 0);

    // ---------- 渲染器 ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ---------- 控制器 ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = false;
    controls.target.set(0, 0, 0);
    controls.minDistance = 8;
    controls.maxDistance = 70;
    controls.update();

    // ---------- 灯光 ----------
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffeedd, 1.5);
    key.position.set(10, 20, 15);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4488ff, 0.8);
    fill.position.set(-15, 5, -10);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
    rim.position.set(0, -10, 20);
    scene.add(rim);
    const hemi = new THREE.HemisphereLight(0x4466ff, 0x222244, 0.6);
    scene.add(hemi);

    // ---------- DNA 参数 (更长) ----------
    const RADIUS = 5.0;
    const HEIGHT = 30;              // 总高度 (足够长)
    const TURNS = 5.5;              // 圈数
    const PAIRS = 60;               // 碱基对数量
    const SPACING = HEIGHT / PAIRS;
    const BASE_RADIUS = 0.6;

    // 碱基颜色
    const colorMap = { 'A': 0xff6b6b, 'T': 0x4ecdc4, 'G': 0xffe66d, 'C': 0xa29bfe };
    const baseLetters = ['A', 'T', 'G', 'C'];
    const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };

    // ---------- 辅助：创建圆柱 ----------
    function createCylinder(p1, p2, color = 0x88aaff, radius = 0.08, opacity = 0.6, emissive = 0x224466) {
        const start = new THREE.Vector3(p1.x, p1.y, p1.z);
        const end = new THREE.Vector3(p2.x, p2.y, p2.z);
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        if (len < 0.001) return null;
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const geo = new THREE.CylinderGeometry(radius, radius, len, 6);
        const mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity, emissive, emissiveIntensity: 0.1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return mesh;
    }

    // ---------- 存储所有交互对象 ----------
    const baseMeshes = [];
    const pairData = []; // 每个元素：{ sphere1, sphere2, bond, ring1, ring2, phos1, phos2, sugar1, sugar2 }

    // ---------- 计算初始和最终位置 ----------
    const finalPositions = [];
    const initialPositions = [];
    const initSpacing = RADIUS * 0.7; // 平面排列间距

    for (let i = 0; i < PAIRS; i++) {
        const t = i / PAIRS;
        const angle = t * Math.PI * 2 * TURNS;
        const y = -HEIGHT / 2 + i * SPACING;
        const x1 = Math.cos(angle) * RADIUS;
        const z1 = Math.sin(angle) * RADIUS;
        const x2 = Math.cos(angle + Math.PI) * RADIUS;
        const z2 = Math.sin(angle + Math.PI) * RADIUS;

        // 初始平面（X轴排列，链1左，链2右）
        const initX1 = -(PAIRS / 2) * initSpacing + i * initSpacing - RADIUS * 0.3;
        const initX2 = -(PAIRS / 2) * initSpacing + i * initSpacing + RADIUS * 0.3;

        initialPositions.push({
            pos1: new THREE.Vector3(initX1, 0, 0),
            pos2: new THREE.Vector3(initX2, 0, 0)
        });
        finalPositions.push({
            pos1: new THREE.Vector3(x1, y, z1),
            pos2: new THREE.Vector3(x2, y, z2)
        });
    }

    // ---------- 创建 DNA 元件 ----------
    // 为了更好的性能，我们将所有动态物体放在一个组里，方便整体移动实现无限滚动
    const dnaGroup = new THREE.Group();
    scene.add(dnaGroup);

    // 存储骨架线条顶点
    const pos1Array = new Float32Array(PAIRS * 3);
    const pos2Array = new Float32Array(PAIRS * 3);

    // 创建每个碱基对
    for (let i = 0; i < PAIRS; i++) {
        const base1 = baseLetters[i % 4];
        const base2 = complement[base1];

        // 球体
        const sphereGeo = new THREE.SphereGeometry(BASE_RADIUS, 28, 28);
        const mat1 = new THREE.MeshPhongMaterial({ color: colorMap[base1], emissive: 0x000000, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.1 });
        const sphere1 = new THREE.Mesh(sphereGeo, mat1);
        sphere1.userData = { base: base1, index: i, chain: 1 };

        const mat2 = new THREE.MeshPhongMaterial({ color: colorMap[base2], emissive: 0x000000, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.1 });
        const sphere2 = new THREE.Mesh(sphereGeo.clone(), mat2);
        sphere2.userData = { base: base2, index: i, chain: 2 };

        sphere1.userData.initialPos = initialPositions[i].pos1.clone();
        sphere1.userData.finalPos = finalPositions[i].pos1.clone();
        sphere2.userData.initialPos = initialPositions[i].pos2.clone();
        sphere2.userData.finalPos = finalPositions[i].pos2.clone();

        dnaGroup.add(sphere1);
        dnaGroup.add(sphere2);
        baseMeshes.push(sphere1, sphere2);

        // 氢键 (连接碱基)
        const bond = createCylinder(
            sphere1.userData.initialPos,
            sphere2.userData.initialPos,
            0xffffff, 0.06, 0.25, 0x335577
        );
        if (bond) {
            bond.userData.pairIndex = i;
            dnaGroup.add(bond);
        }

        // 环装饰 (代表碱基环结构)
        const ringMat = new THREE.MeshPhongMaterial({ color: 0xffaa44, emissive: 0x442200, emissiveIntensity: 0.15, transparent: true, opacity: 0.5 });
        const ringGeo = new THREE.TorusGeometry(BASE_RADIUS * 0.9, 0.07, 8, 16);
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.position.copy(sphere1.userData.initialPos);
        ring1.position.y += 0.5;
        ring1.rotation.x = Math.PI / 2;
        dnaGroup.add(ring1);

        const ring2 = new THREE.Mesh(ringGeo.clone(), ringMat);
        ring2.position.copy(sphere2.userData.initialPos);
        ring2.position.y += 0.5;
        ring2.rotation.x = Math.PI / 2;
        dnaGroup.add(ring2);

        // 磷酸基团 (橙球，位于骨架外侧)
        const phosMat = new THREE.MeshPhongMaterial({ color: 0xffaa66, emissive: 0x442200, emissiveIntensity: 0.1, roughness: 0.4, metalness: 0.3 });
        const phosGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const phos1 = new THREE.Mesh(phosGeo, phosMat);
        const dir1 = new THREE.Vector3(1, 0, 0);
        phos1.position.copy(sphere1.userData.initialPos).add(dir1.multiplyScalar(0.9));
        phos1.userData.initialPos = phos1.position.clone();
        const finalPos1 = finalPositions[i].pos1.clone();
        const radial1 = finalPos1.clone().normalize();
        phos1.userData.finalPos = finalPos1.clone().add(radial1.multiplyScalar(0.9));
        dnaGroup.add(phos1);

        const phos2 = new THREE.Mesh(phosGeo.clone(), phosMat);
        const dir2 = new THREE.Vector3(-1, 0, 0);
        phos2.position.copy(sphere2.userData.initialPos).add(dir2.multiplyScalar(0.9));
        phos2.userData.initialPos = phos2.position.clone();
        const finalPos2 = finalPositions[i].pos2.clone();
        const radial2 = finalPos2.clone().normalize();
        phos2.userData.finalPos = finalPos2.clone().add(radial2.multiplyScalar(0.9));
        dnaGroup.add(phos2);

        // 五碳糖 (用五边形环表示，简化，但为了视觉丰富)
        const sugarMat = new THREE.MeshPhongMaterial({ color: 0x44aa88, emissive: 0x004433, emissiveIntensity: 0.1 });
        const sugarGeo = new THREE.RingGeometry(0.35, 0.55, 5);
        const sugar1 = new THREE.Mesh(sugarGeo, sugarMat);
        sugar1.position.copy(sphere1.userData.initialPos);
        sugar1.position.y -= 0.3;
        sugar1.rotation.x = Math.PI / 2;
        sugar1.userData.initialPos = sugar1.position.clone();
        const finalSugar1 = finalPositions[i].pos1.clone();
        finalSugar1.y -= 0.3;
        sugar1.userData.finalPos = finalSugar1;
        dnaGroup.add(sugar1);

        const sugar2 = new THREE.Mesh(sugarGeo.clone(), sugarMat);
        sugar2.position.copy(sphere2.userData.initialPos);
        sugar2.position.y -= 0.3;
        sugar2.rotation.x = Math.PI / 2;
        sugar2.userData.initialPos = sugar2.position.clone();
        const finalSugar2 = finalPositions[i].pos2.clone();
        finalSugar2.y -= 0.3;
        sugar2.userData.finalPos = finalSugar2;
        dnaGroup.add(sugar2);

        // 存储所有动态对象以便更新
        pairData.push({
            sphere1, sphere2, bond,
            ring1, ring2,
            phos1, phos2,
            sugar1, sugar2
        });
    }

    // 骨架线条 (两条链)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 });
    const line1 = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    const line2 = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    dnaGroup.add(line1);
    dnaGroup.add(line2);

    // ---------- 背景星空 ----------
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 300;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x88aaff, size: 0.15, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ---------- 构建动画控制 ----------
    let buildProgress = 0;
    let isBuilding = true;
    const buildDuration = 7.0; // 秒
    const startTime = performance.now() / 1000;
    const delays = new Array(PAIRS).fill(0).map((_, i) => i / PAIRS);

    // ---------- 更新位置函数 ----------
    function updatePositions(progress) {
        for (let i = 0; i < PAIRS; i++) {
            const delay = delays[i] * 0.7;
            let p = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
            // 缓动
            const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

            const init1 = initialPositions[i].pos1;
            const final1 = finalPositions[i].pos1;
            const init2 = initialPositions[i].pos2;
            const final2 = finalPositions[i].pos2;
            const cur1 = new THREE.Vector3().lerpVectors(init1, final1, ease);
            const cur2 = new THREE.Vector3().lerpVectors(init2, final2, ease);

            const data = pairData[i];
            data.sphere1.position.copy(cur1);
            data.sphere2.position.copy(cur2);

            // 更新氢键
            if (data.bond) {
                const start = cur1;
                const end = cur2;
                const dir = new THREE.Vector3().subVectors(end, start);
                const len = dir.length();
                if (len > 0.001) {
                    data.bond.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
                    data.bond.scale.y = len / 0.1;
                    data.bond.quaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        dir.clone().normalize()
                    );
                }
            }

            // 环
            data.ring1.position.copy(cur1);
            data.ring1.position.y += 0.5;
            data.ring2.position.copy(cur2);
            data.ring2.position.y += 0.5;

            // 磷酸
            const pPhos = ease;
            const phos1Init = data.phos1.userData.initialPos;
            const phos1Fin = data.phos1.userData.finalPos;
            data.phos1.position.lerpVectors(phos1Init, phos1Fin, pPhos);
            const phos2Init = data.phos2.userData.initialPos;
            const phos2Fin = data.phos2.userData.finalPos;
            data.phos2.position.lerpVectors(phos2Init, phos2Fin, pPhos);

            // 五碳糖
            const sugar1Init = data.sugar1.userData.initialPos;
            const sugar1Fin = data.sugar1.userData.finalPos;
            data.sugar1.position.lerpVectors(sugar1Init, sugar1Fin, pPhos);
            const sugar2Init = data.sugar2.userData.initialPos;
            const sugar2Fin = data.sugar2.userData.finalPos;
            data.sugar2.position.lerpVectors(sugar2Init, sugar2Fin, pPhos);

            // 更新骨架数组
            pos1Array[i * 3] = cur1.x;
            pos1Array[i * 3 + 1] = cur1.y;
            pos1Array[i * 3 + 2] = cur1.z;
            pos2Array[i * 3] = cur2.x;
            pos2Array[i * 3 + 1] = cur2.y;
            pos2Array[i * 3 + 2] = cur2.z;
        }

        // 更新线条
        line1.geometry.setAttribute('position', new THREE.BufferAttribute(pos1Array, 3));
        line1.geometry.computeBoundingSphere();
        line2.geometry.setAttribute('position', new THREE.BufferAttribute(pos2Array, 3));
        line2.geometry.computeBoundingSphere();
    }

    // 初始位置
    updatePositions(0);

    // ---------- 无限滚动机制 ----------
    // 使整个 DNA 组沿 Y 轴缓慢移动，当超出范围后循环
    let scrollOffset = 0;
    const scrollSpeed = 0.8; // 单位/秒
    const cycleHeight = HEIGHT * 1.2; // 循环周期

    function updateScroll(delta) {
        if (!isBuilding) {
            scrollOffset += delta * scrollSpeed;
            if (scrollOffset > cycleHeight) {
                scrollOffset -= cycleHeight;
            }
            dnaGroup.position.y = -scrollOffset;
        }
    }

    // ---------- 鼠标交互 (Raycaster) ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredBase = null;

    window.addEventListener('pointermove', (event) => {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // ---------- 动画循环 ----------
    let lastTime = performance.now() / 1000;

    function animate() {
        requestAnimationFrame(animate);

        const now = performance.now() / 1000;
        const delta = now - lastTime;
        lastTime = now;

        if (isBuilding) {
            const elapsed = now - startTime;
            buildProgress = Math.min(1, elapsed / buildDuration);
            updatePositions(buildProgress);
            if (buildProgress >= 1) {
                isBuilding = false;
                // 构建完成，将DNA组归零位置（因为滚动从0开始）
                dnaGroup.position.y = 0;
                scrollOffset = 0;
            }
        } else {
            // 滚动
            updateScroll(delta);

            // 鼠标吸附
            if (hoveredBase) {
                const mat = hoveredBase.material;
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0.2;
                if (hoveredBase.userData.originalPosition) {
                    hoveredBase.position.copy(hoveredBase.userData.originalPosition);
                }
                hoveredBase = null;
            }

            raycaster.setFromCamera(pointer, camera);
            // 注意：baseMeshes 是在 dnaGroup 内的，需要转换矩阵，但 raycaster 会处理
            const intersects = raycaster.intersectObjects(baseMeshes);
            if (intersects.length > 0) {
                const hit = intersects[0].object;
                if (hit.userData && hit.userData.base) {
                    hoveredBase = hit;
                    const mat = hit.material;
                    mat.emissive.setHex(0x4488ff);
                    mat.emissiveIntensity = 0.9;
                    if (!hit.userData.originalPosition) {
                        hit.userData.originalPosition = hit.position.clone();
                    }
                    const dir = new THREE.Vector3()
                        .subVectors(camera.position, hit.position)
                        .normalize();
                    hit.position.copy(hit.userData.originalPosition).add(dir.multiplyScalar(0.7));
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

    return { scene, camera, controls, renderer };
}
