import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * 初始化 DNA 3D 场景
 * 自动创建 canvas 并添加到 body
 */
export function initDNA() {
    // ---------- 场景、相机、渲染器 ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(18, 8, 22);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // ---------- 控制器 ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.target.set(0, 0, 0);
    controls.minDistance = 8;
    controls.maxDistance = 60;

    // ---------- 灯光 ----------
    const ambient = new THREE.AmbientLight(0x404060);
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(10, 20, 10);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    fillLight.position.set(-15, 5, -10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x88aaff, 0.4);
    rimLight.position.set(0, -10, 20);
    scene.add(rimLight);

    // 环境光辅助
    const hemi = new THREE.HemisphereLight(0x4466ff, 0x222244, 0.5);
    scene.add(hemi);

    // ---------- DNA 参数 ----------
    const radius = 4.5;          // 螺旋半径
    const height = 14;           // 总高度
    const turns = 2.8;           // 旋转圈数
    const pairs = 32;            // 碱基对数量
    const baseSpacing = height / pairs;
    const baseRadius = 0.55;     // 碱基球体大小

    // 碱基颜色 (A / T / G / C)
    const colorMap = {
        'A': 0xff6b6b,
        'T': 0x4ecdc4,
        'G': 0xffe66d,
        'C': 0xa29bfe
    };
    const bases = ['A', 'T', 'G', 'C'];
    const complementary = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };

    // ---------- 工具函数：创建圆柱连接（骨架 / 氢键） ----------
    function createCylinder(pos1, pos2, color = 0x88aaff, radius = 0.08, opacity = 0.5) {
        const start = new THREE.Vector3(pos1.x, pos1.y, pos1.z);
        const end = new THREE.Vector3(pos2.x, pos2.y, pos2.z);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        if (length < 0.001) return null;
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const geometry = new THREE.CylinderGeometry(radius, radius, length, 6);
        const material = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            emissive: 0x224466,
            emissiveIntensity: 0.1
        });
        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.position.copy(mid);
        cylinder.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
        );
        return cylinder;
    }

    // ---------- 存储交互对象 ----------
    const baseMeshes = [];

    // ---------- 构建 DNA ----------
    for (let i = 0; i < pairs; i++) {
        const t = i / pairs;
        const angle = t * Math.PI * 2 * turns;
        const y = -height / 2 + i * baseSpacing;

        // 两条链的位置偏移
        const x1 = Math.cos(angle) * radius;
        const z1 = Math.sin(angle) * radius;
        const x2 = Math.cos(angle + Math.PI) * radius;
        const z2 = Math.sin(angle + Math.PI) * radius;

        // 碱基类型（循环分配，保证配对）
        const base1 = bases[i % 4];
        const base2 = complementary[base1];

        const pos1 = new THREE.Vector3(x1, y, z1);
        const pos2 = new THREE.Vector3(x2, y, z2);

        // ----- 碱基球体 -----
        const sphereGeo = new THREE.SphereGeometry(baseRadius, 24, 24);
        const mat1 = new THREE.MeshPhongMaterial({
            color: colorMap[base1],
            emissive: 0x000000,
            emissiveIntensity: 0.3,
            shininess: 60
        });
        const sphere1 = new THREE.Mesh(sphereGeo, mat1);
        sphere1.position.copy(pos1);
        sphere1.userData = { base: base1, index: i, chain: 1 };
        scene.add(sphere1);
        baseMeshes.push(sphere1);

        const mat2 = new THREE.MeshPhongMaterial({
            color: colorMap[base2],
            emissive: 0x000000,
            emissiveIntensity: 0.3,
            shininess: 60
        });
        const sphere2 = new THREE.Mesh(sphereGeo.clone(), mat2);
        sphere2.position.copy(pos2);
        sphere2.userData = { base: base2, index: i, chain: 2 };
        scene.add(sphere2);
        baseMeshes.push(sphere2);

        // ----- 氢键（配对连接） -----
        const bond = createCylinder(pos1, pos2, 0xffffff, 0.05, 0.25);
        if (bond) scene.add(bond);

        // ----- 骨架连接（同链相邻） -----
        if (i > 0) {
            const prevAngle = (i - 1) / pairs * Math.PI * 2 * turns;
            const prevY = -height / 2 + (i - 1) * baseSpacing;
            const px1 = Math.cos(prevAngle) * radius;
            const pz1 = Math.sin(prevAngle) * radius;
            const px2 = Math.cos(prevAngle + Math.PI) * radius;
            const pz2 = Math.sin(prevAngle + Math.PI) * radius;
            const prevPos1 = new THREE.Vector3(px1, prevY, pz1);
            const prevPos2 = new THREE.Vector3(px2, prevY, pz2);

            const backbone1 = createCylinder(prevPos1, pos1, 0x88aaff, 0.12, 0.7);
            if (backbone1) scene.add(backbone1);
            const backbone2 = createCylinder(prevPos2, pos2, 0x88aaff, 0.12, 0.7);
            if (backbone2) scene.add(backbone2);
        }

        // ----- 连接基团（每个碱基上的小环，代表磷酸/侧链） -----
        const ringMat = new THREE.MeshPhongMaterial({
            color: 0xffaa44,
            emissive: 0x442200,
            emissiveIntensity: 0.2
        });
        const ringGeo = new THREE.TorusGeometry(baseRadius * 0.7, 0.08, 8, 12);
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.position.copy(pos1);
        ring1.position.y += 0.4;   // 向上偏移
        ring1.rotation.x = Math.PI / 2;
        scene.add(ring1);

        const ring2 = new THREE.Mesh(ringGeo.clone(), ringMat);
        ring2.position.copy(pos2);
        ring2.position.y += 0.4;
        ring2.rotation.x = Math.PI / 2;
        scene.add(ring2);
    }

    // ---------- 背景星空粒子 ----------
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 300;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({
        color: 0x88aaff,
        size: 0.15,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // ---------- 鼠标交互 (Raycaster) ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredBase = null;

    function onPointerMove(event) {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    window.addEventListener('pointermove', onPointerMove);

    // ---------- 动画循环 ----------
    function animate() {
        requestAnimationFrame(animate);

        // 射线检测
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(baseMeshes);

        // 恢复上一次悬停的碱基
        if (hoveredBase) {
            const mat = hoveredBase.material;
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0.3;
            if (hoveredBase.userData.originalPosition) {
                hoveredBase.position.copy(hoveredBase.userData.originalPosition);
            }
            hoveredBase = null;
        }

        // 处理新的悬停
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
                // 吸附：向相机方向移动一点
                const dir = new THREE.Vector3()
                    .subVectors(camera.position, hit.position)
                    .normalize();
                hit.position.copy(hit.userData.originalPosition).add(dir.multiplyScalar(0.6));
            }
        }

        controls.update();
        renderer.render(scene, camera);
    }

    animate();

    // ---------- 窗口自适应 ----------
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 导出一些对象供调试（可选）
    return { scene, camera, controls, renderer };
}
