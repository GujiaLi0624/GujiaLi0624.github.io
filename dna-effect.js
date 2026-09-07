// ============================================================
// dna-effect.js - 3D DNA 双链 + 鼠标吸附连接基团
// 依赖：Three.js (从 CDN 加载)
// ============================================================

(function() {
    // ----- 1. 场景、相机、渲染器 -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e); // 深空蓝

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(8, 6, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.prepend(renderer.domElement); // 将 canvas 置于底层

    // ----- 2. 灯光 -----
    const ambientLight = new THREE.AmbientLight(0x404060);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 5, 3);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x4466ff, 0.6);
    backLight.position.set(-3, -1, -5);
    scene.add(backLight);

    const pointLight = new THREE.PointLight(0x88aaff, 0.5, 30);
    pointLight.position.set(0, 3, 5);
    scene.add(pointLight);

    // 辅助网格（可选，注释掉以保持纯净）
    // const gridHelper = new THREE.GridHelper(20, 20, 0x3366ff, 0x224488);
    // scene.add(gridHelper);

    // ----- 3. 鼠标交互变量 -----
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let mouseWorld = new THREE.Vector3(); // 鼠标在 3D 空间的位置（z=0 平面）
    let hoveredBase = null;               // 当前悬停的碱基对象
    const attractionRadius = 3.5;         // 吸附触发半径

    // ----- 4. 存储所有碱基对象 -----
    const bases = [];

    // ----- 5. 工具：生成随机颜色 (ATCG) -----
    function getBaseColor(base) {
        const map = {
            'A': 0xff6b6b, // 红
            'T': 0x4ecdc4, // 青
            'G': 0xffe66d, // 黄
            'C': 0xa29bfe  // 紫
        };
        return map[base] || 0xffffff;
    }

    // ----- 6. 创建 DNA 双链 -----
    function createDNA() {
        const group = new THREE.Group();

        const radius = 3.0;          // 螺旋半径
        const height = 12.0;         // 总高度
        const turns = 3.5;           // 旋转圈数
        const totalBases = 60;       // 碱基总数（每条链30个）
        const step = height / totalBases;

        const baseLetters = ['A', 'T', 'G', 'C'];

        for (let i = 0; i < totalBases; i++) {
            const t = i / totalBases;
            const y = -height/2 + t * height;
            const angle = t * Math.PI * 2 * turns;

            // 两条链的位置偏移
            const offset1 = 0;
            const offset2 = Math.PI;

            // ---- 链1 ----
            const x1 = radius * Math.cos(angle + offset1);
            const z1 = radius * Math.sin(angle + offset1);
            const pos1 = new THREE.Vector3(x1, y, z1);

            // ---- 链2 ----
            const x2 = radius * Math.cos(angle + offset2);
            const z2 = radius * Math.sin(angle + offset2);
            const pos2 = new THREE.Vector3(x2, y, z2);

            // 随机选择碱基（但保证配对：A-T, G-C）
            const idx = Math.floor(Math.random() * 4);
            const base1 = baseLetters[idx];
            const base2 = baseLetters[(idx + 2) % 4]; // 互补

            // 创建单个碱基（球体 + 标签 + 连接基团）
            const baseObj1 = createBase(base1, pos1, i);
            const baseObj2 = createBase(base2, pos2, i + 0.5);

            group.add(baseObj1.group);
            group.add(baseObj2.group);

            // 存储引用以便交互
            bases.push({
                mesh: baseObj1.group,
                base: base1,
                originalPos: pos1.clone(),
                connector: baseObj1.connector, // 连接基团小球
                isHovered: false
            });
            bases.push({
                mesh: baseObj2.group,
                base: base2,
                originalPos: pos2.clone(),
                connector: baseObj2.connector,
                isHovered: false
            });

            // ---- 绘制碱基对之间的连接线（氢键） ----
            const midPoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);
            const dir = new THREE.Vector3().subVectors(pos2, pos1);
            const length = dir.length();
            dir.normalize();

            // 虚线氢键（用一系列小点）
            const segments = 8;
            for (let k = 0; k < segments; k++) {
                const frac = (k + 0.5) / segments;
                const p = new THREE.Vector3().lerpVectors(pos1, pos2, frac);
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.06, 4, 4),
                    new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.3 })
                );
                sphere.position.copy(p);
                group.add(sphere);
            }
        }

        return group;
    }

    // ----- 7. 创建单个碱基（包含球体、标签、连接基团） -----
    function createBase(letter, position, seed) {
        const group = new THREE.Group();
        group.position.copy(position);

        // 7.1 球体（碱基核心）
        const color = getBaseColor(letter);
        const sphereMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.3,
            metalness: 0.1,
            emissive: color,
            emissiveIntensity: 0.15
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24), sphereMat);
        sphere.castShadow = true;
        group.add(sphere);

        // 7.2 字母标签（使用 Sprite）
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 64, 64);
        ctx.font = 'Bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText(letter, 32, 34);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat2 = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(spriteMat2);
        sprite.scale.set(0.8, 0.8, 1);
        sprite.position.set(0, 0.9, 0); // 在球体上方
        group.add(sprite);

        // 7.3 连接基团（一个小发光球，作为“化学键”）
        const connectorMat = new THREE.MeshStandardMaterial({
            color: 0xffaa88,
            emissive: 0xff8800,
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.3
        });
        const connector = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), connectorMat);
        // 放置在球体旁边，方向随机（模拟连接基团伸出）
        const angleH = Math.random() * Math.PI * 2;
        const angleV = Math.random() * Math.PI * 0.8 + 0.2;
        const dist = 0.7;
        connector.position.set(
            Math.cos(angleH) * Math.sin(angleV) * dist,
            Math.cos(angleV) * dist,
            Math.sin(angleH) * Math.sin(angleV) * dist
        );
        group.add(connector);

        // 保存 connector 引用以便鼠标吸附
        group.userData.connector = connector;
        group.userData.baseLetter = letter;

        return { group, connector };
    }

    // ----- 8. 鼠标事件监听 -----
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // 计算鼠标在 3D 空间中的位置（投影到 z=0 平面）
        raycaster.setFromCamera(mouse, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersect);
        if (intersect) {
            mouseWorld.copy(intersect);
        }
    });

    // 窗口自适应
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ----- 9. 场景构建 -----
    const dnaGroup = createDNA();
    scene.add(dnaGroup);

    // 添加一些星星背景（小粒子）
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 800;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
        const r = 40 + Math.random() * 30;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i+1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i+2] = r * Math.cos(phi);
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0x88aadd, size: 0.15, transparent: true });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // ----- 10. 动画循环（更新吸附效果 + 旋转） -----
    let clock = new THREE.Clock();

    function animate() {
        const delta = clock.getDelta();
        const elapsedTime = performance.now() / 1000;

        // 10.1 自动缓慢旋转 DNA
        dnaGroup.rotation.y += 0.002;

        // 10.2 更新每个碱基的吸附效果
        for (let base of bases) {
            const group = base.mesh;
            const originalPos = base.originalPos;
            const connector = base.connector;

            // 计算碱基球体在世界空间的位置
            const worldPos = new THREE.Vector3();
            group.getWorldPosition(worldPos);

            // 计算到鼠标的距离（在 XZ 平面上）
            const dx = worldPos.x - mouseWorld.x;
            const dz = worldPos.z - mouseWorld.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            // 如果距离小于阈值，且鼠标在视野内（mouseWorld 有效）
            if (dist < attractionRadius && mouseWorld.length() < 20) {
                // 吸附强度：距离越近越强
                const strength = 1 - dist / attractionRadius;
                // 目标偏移方向（从碱基指向鼠标，但限制在水平面，保持立体感）
                const targetOffset = new THREE.Vector3(
                    (mouseWorld.x - worldPos.x) * strength * 0.25,
                    (mouseWorld.y - worldPos.y) * strength * 0.15, // 垂直方向弱一些
                    (mouseWorld.z - worldPos.z) * strength * 0.25
                );
                // 将连接基团向鼠标方向移动
                connector.position.lerp(targetOffset, 0.15);
                // 连接基团发光增强
                connector.material.emissiveIntensity = 0.8 + strength * 1.2;
                // 碱基球体略微放大
                const sphere = group.children[0];
                if (sphere.isMesh) {
                    const scale = 1 + strength * 0.15;
                    sphere.scale.set(scale, scale, scale);
                }
                // 标记为悬停
                base.isHovered = true;
            } else {
                // 恢复原状
                connector.position.lerp(new THREE.Vector3(0, 0, 0), 0.05);
                connector.material.emissiveIntensity = 0.6;
                const sphere = group.children[0];
                if (sphere.isMesh) {
                    sphere.scale.set(1, 1, 1);
                }
                base.isHovered = false;
            }
        }

        // 10.3 星星缓慢旋转
        stars.rotation.y += 0.0001;

        // 10.4 渲染
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();

    // 清理（可选）
    window.addEventListener('beforeunload', () => {
        renderer.dispose();
    });
})();
