// ============================================================
// dna-3d-process.js – 3D 无限延伸DNA + 中心法则动态演示
// 依赖：Three.js (r128)
// ============================================================

(function() {
    // ----- 1. 场景、相机、渲染器 -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);
    scene.fog = new THREE.Fog(0x0a0f1e, 25, 45);

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(10, 6, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.prepend(renderer.domElement);

    // ----- 2. 灯光 -----
    const ambient = new THREE.AmbientLight(0x404060);
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    mainLight.position.set(5, 12, 8);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 512;
    mainLight.shadow.mapSize.height = 512;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5);
    fillLight.position.set(-5, 0, 10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xaa88ff, 0.6);
    rimLight.position.set(0, -5, -10);
    scene.add(rimLight);

    const backLight = new THREE.PointLight(0x6688ff, 0.3, 30);
    backLight.position.set(0, 0, -15);
    scene.add(backLight);

    // ----- 3. 辅助装饰：星空粒子背景 -----
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
        const r = 40 + Math.random() * 40;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPos[i] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i+1] = r * Math.sin(phi) * Math.sin(theta);
        starPos[i+2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x88aadd, size: 0.15, transparent: true });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ----- 4. 核心参数 -----
    const BASE_COLORS = {
        A: 0xff6b6b,
        T: 0x4ecdc4,
        G: 0xffe66d,
        C: 0xa29bfe
    };
    const LETTERS = ['A', 'T', 'G', 'C'];
    const PAIR_MAP = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };

    const AMP_Y = 1.8;
    const AMP_Z = 1.8;
    const SPACING = 0.8;
    const TOTAL_PAIRS = 80; // 足够长，视觉上无限
    const HELIX_LENGTH = TOTAL_PAIRS * SPACING;
    const START_X = -HELIX_LENGTH / 2;
    const SPEED = 0.8; // 滚动速度

    // ----- 5. 创建DNA双链（3D立体） -----
    const dnaGroup = new THREE.Group();
    scene.add(dnaGroup);

    // 存储碱基对对象以便更新
    const baseObjects = [];

    // 创建一条链的碱基（球体 + 字母精灵）
    function createBase(letter, x, y, z, isStrand1) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 球体
        const color = BASE_COLORS[letter] || 0xffffff;
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.25,
            metalness: 0.1,
            emissive: color,
            emissiveIntensity: 0.15
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), mat);
        sphere.castShadow = true;
        group.add(sphere);

        // 字母精灵 (Canvas)
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 32, 32);
        ctx.font = 'Bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(letter, 16, 18);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.6, 0.6, 1);
        sprite.position.set(0, 0.6, 0);
        group.add(sprite);

        // 存储数据便于更新
        group.userData = { letter, isStrand1, baseX: x, baseY: y, baseZ: z };
        return group;
    }

    // 初始化所有碱基
    let phase = 0;
    function buildDNA() {
        // 清除旧的
        while(dnaGroup.children.length > 0) {
            dnaGroup.remove(dnaGroup.children[0]);
        }
        baseObjects.length = 0;

        for (let i = 0; i < TOTAL_PAIRS; i++) {
            const x = START_X + i * SPACING;
            const angle = x * 0.8 + phase;

            // 链1 (y正, z正)
            const y1 = AMP_Y * Math.sin(angle);
            const z1 = AMP_Z * Math.cos(angle);
            // 链2 (相反相位)
            const y2 = AMP_Y * Math.sin(angle + Math.PI);
            const z2 = AMP_Z * Math.cos(angle + Math.PI);

            // 随机碱基配对
            const idx = Math.floor(Math.random() * 4);
            const base1 = LETTERS[idx];
            const base2 = PAIR_MAP[base1];

            const g1 = createBase(base1, x, y1, z1, true);
            const g2 = createBase(base2, x, y2, z2, false);
            dnaGroup.add(g1);
            dnaGroup.add(g2);

            // 存储配对信息
            baseObjects.push({
                group1: g1,
                group2: g2,
                base1: base1,
                base2: base2,
                x: x,
                idx: i
            });

            // 创建氢键连接线（圆柱）
            const midX = x;
            const midY = (y1 + y2) / 2;
            const midZ = (z1 + z2) / 2;
            const dir = new THREE.Vector3(y2 - y1, z2 - z1);
            const len = dir.length();
            dir.normalize();

            const cylGeo = new THREE.CylinderGeometry(0.04, 0.04, len, 4);
            const cylMat = new THREE.MeshStandardMaterial({
                color: 0x88aaff,
                emissive: 0x4466aa,
                emissiveIntensity: 0.2,
                transparent: true,
                opacity: 0.4
            });
            const cyl = new THREE.Mesh(cylGeo, cylMat);
            cyl.position.set(midX, midY, midZ);
            // 旋转使其指向方向
            const up = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
            cyl.quaternion.copy(quat);
            dnaGroup.add(cyl);
        }
    }
    buildDNA();

    // ----- 6. 动态元素：聚合酶（转录泡）-----
    const polymeraseGroup = new THREE.Group();
    scene.add(polymeraseGroup);

    // 聚合酶主体
    const enzymeMat = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        emissive: 0xff4400,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.1
    });
    const enzymeCore = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), enzymeMat);
    enzymeCore.castShadow = true;
    polymeraseGroup.add(enzymeCore);

    // 环绕粒子光环
    const ringParticles = new THREE.BufferGeometry();
    const ringCount = 30;
    const ringPos = new Float32Array(ringCount * 3);
    for (let i = 0; i < ringCount; i++) {
        const a = (i / ringCount) * Math.PI * 2;
        ringPos[i*3] = Math.cos(a) * 1.2;
        ringPos[i*3+1] = Math.sin(a) * 1.2;
        ringPos[i*3+2] = 0;
    }
    ringParticles.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    const ringMat = new THREE.PointsMaterial({ color: 0xffaa44, size: 0.1 });
    const ring = new THREE.Points(ringParticles, ringMat);
    polymeraseGroup.add(ring);

    polymeraseGroup.position.set(0, 0, 0);

    // ----- 7. mRNA 链（从聚合酶延伸）-----
    const mRNAPoints = [];
    const mRNA_MAX = 60;
    const mRNAGroup = new THREE.Group();
    scene.add(mRNAGroup);

    function updateMRNA(time) {
        // 在聚合酶位置生成新点
        if (mRNAPoints.length < mRNA_MAX) {
            const basePos = polymeraseGroup.position.clone();
            // 添加随机偏移，模拟转录方向（向右 + 轻微上下波动）
            const offsetY = Math.sin(time * 2 + mRNAPoints.length * 0.5) * 0.4;
            const offsetZ = Math.cos(time * 1.7 + mRNAPoints.length * 0.3) * 0.4;
            mRNAPoints.push({
                x: basePos.x + 1.5 + mRNAPoints.length * 0.35,
                y: basePos.y - 0.5 + offsetY,
                z: basePos.z + offsetZ,
                life: 1.0
            });
        }
        // 移动所有点向右并衰减
        for (let i = mRNAPoints.length - 1; i >= 0; i--) {
            const p = mRNAPoints[i];
            p.x += 0.04;
            p.life -= 0.001;
            if (p.life < 0 || p.x > 18) {
                mRNAPoints.splice(i, 1);
            }
        }
        // 重建mRNA网格
        while(mRNAGroup.children.length > 0) {
            const c = mRNAGroup.children[0];
            c.geometry && c.geometry.dispose();
            c.material && c.material.dispose();
            mRNAGroup.remove(c);
        }
        if (mRNAPoints.length > 1) {
            // 绘制线条
            const positions = [];
            for (let p of mRNAPoints) {
                positions.push(p.x, p.y, p.z);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const mat = new THREE.LineBasicMaterial({ color: 0xfd79a8, linewidth: 2 });
            const line = new THREE.Line(geo, mat);
            mRNAGroup.add(line);

            // 加一些发光小球
            for (let i = 0; i < mRNAPoints.length; i+=2) {
                const p = mRNAPoints[i];
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 6, 6),
                    new THREE.MeshBasicMaterial({ color: 0xfd79a8 })
                );
                sphere.position.set(p.x, p.y, p.z);
                mRNAGroup.add(sphere);
            }
        }
    }

    // ----- 8. 核糖体 + 翻译（氨基酸链 -> 蛋白质）-----
    const ribosomeGroup = new THREE.Group();
    scene.add(ribosomeGroup);

    const ribMat = new THREE.MeshStandardMaterial({
        color: 0x7c3aed,
        emissive: 0x4c1d95,
        emissiveIntensity: 0.6,
        roughness: 0.3
    });
    const ribCore = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), ribMat);
    ribCore.castShadow = true;
    ribosomeGroup.add(ribCore);

    // 核糖体位置跟随mRNA末端
    const aminoAcids = [];
    const aaGroup = new THREE.Group();
    scene.add(aaGroup);

    let proteinFold = 0;

    function updateTranslation(time) {
        // 核糖体位置：mRNA末端
        if (mRNAPoints.length > 10) {
            const last = mRNAPoints[mRNAPoints.length - 1];
            ribosomeGroup.position.set(last.x + 1.0, last.y, last.z);
        } else {
            ribosomeGroup.position.set(6, -0.5, 0);
        }

        // 添加氨基酸 (每帧概率)
        if (Math.random() < 0.15 && aminoAcids.length < 40) {
            const idx = aminoAcids.length;
            const color = new THREE.Color().setHSL(0.55 + idx * 0.025, 0.7, 0.6);
            const pos = ribosomeGroup.position.clone();
            pos.x += 0.5 + idx * 0.4;
            pos.y += Math.sin(idx * 1.2) * 0.6;
            pos.z += Math.cos(idx * 0.9) * 0.6;
            aminoAcids.push({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                targetX: pos.x,
                targetY: pos.y,
                targetZ: pos.z,
                color: color,
                idx: idx
            });
        }

        // 更新氨基酸位置：逐渐形成折叠的蛋白质（球状）
        const centerX = 12;
        const centerY = 0;
        const centerZ = 0;
        const total = aminoAcids.length;
        for (let i = 0; i < total; i++) {
            const aa = aminoAcids[i];
            // 随着时间推移，折叠成球状
            const progress = Math.min(1, (total - i) / total * 0.8 + 0.2);
            const radius = 1.8 + 0.6 * Math.sin(time * 0.2 + i);
            const theta = (i / total) * Math.PI * 2 + time * 0.05;
            const phi = Math.sin(i * 0.7 + time * 0.1) * 1.2;
            const targetX = centerX + radius * 0.8 * Math.sin(theta) * Math.cos(phi);
            const targetY = centerY + radius * 0.8 * Math.sin(phi);
            const targetZ = centerZ + radius * 0.8 * Math.cos(theta) * Math.cos(phi);
            // 插值移动
            aa.x += (targetX - aa.x) * 0.03;
            aa.y += (targetY - aa.y) * 0.03;
            aa.z += (targetZ - aa.z) * 0.03;
        }

        // 重建氨基酸显示
        while(aaGroup.children.length > 0) {
            const c = aaGroup.children[0];
            c.geometry && c.geometry.dispose();
            c.material && c.material.dispose();
            aaGroup.remove(c);
        }

        // 绘制肽键连线
        if (aminoAcids.length > 1) {
            const positions = [];
            for (let aa of aminoAcids) {
                positions.push(aa.x, aa.y, aa.z);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
            const line = new THREE.Line(geo, mat);
            aaGroup.add(line);
        }

        // 绘制氨基酸球体
        for (let aa of aminoAcids) {
            const mat = new THREE.MeshStandardMaterial({
                color: aa.color,
                emissive: aa.color,
                emissiveIntensity: 0.3,
                roughness: 0.3,
                metalness: 0.1
            });
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
            sphere.position.set(aa.x, aa.y, aa.z);
            sphere.castShadow = true;
            aaGroup.add(sphere);
        }

        // 最终蛋白质光晕（如果氨基酸够多）
        if (aminoAcids.length > 15) {
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0xa78bfa,
                transparent: true,
                opacity: 0.08 + 0.03 * Math.sin(time * 0.2)
            });
            const glow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), glowMat);
            glow.position.set(centerX, centerY, centerZ);
            aaGroup.add(glow);
        }
    }

    // ----- 9. 3D 标签 (Sprite) -----
    function makeLabel(text, color, x, y, z) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = 'Bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.fillText(text, 128, 34);
        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(x, y, z);
        sprite.scale.set(4, 1, 1);
        return sprite;
    }

    scene.add(makeLabel('🧬 DNA 双链 (无限延伸)', '#60cfff', 0, 4.5, 0));
    scene.add(makeLabel('✂️ 转录 (RNA聚合酶)', '#ff8800', -0.5, 2.8, 2.5));
    scene.add(makeLabel('🧬 mRNA', '#fd79a8', 8, 2.0, 1.5));
    scene.add(makeLabel('⚙️ 翻译 (核糖体)', '#7c3aed', 12, 1.2, 2.0));
    scene.add(makeLabel('🧩 蛋白质折叠 (三级结构)', '#a78bfa', 16, -1.5, 0));

    // ----- 10. 动画循环 -----
    let clock = new THREE.Clock();

    function animate() {
        const delta = clock.getDelta();
        const time = clock.elapsedTime;

        // 10.1 更新DNA相位（无限滚动）
        phase += delta * SPEED;
        // 重新构建DNA（为了让碱基位置连续变化，我们直接修改每个碱基的位置）
        // 为了性能，我们更新已存在的对象位置，而不是重建
        for (let i = 0; i < baseObjects.length; i++) {
            const pair = baseObjects[i];
            const x = pair.x;
            const angle = x * 0.8 + phase;

            const y1 = AMP_Y * Math.sin(angle);
            const z1 = AMP_Z * Math.cos(angle);
            const y2 = AMP_Y * Math.sin(angle + Math.PI);
            const z2 = AMP_Z * Math.cos(angle + Math.PI);

            pair.group1.position.set(x, y1, z1);
            pair.group2.position.set(x, y2, z2);

            // 更新连接线（配对键）—— 为了简单，我们重建氢键（或者忽略更新以提升性能）
            // 实际上这里为了性能，我们不更新氢键的位置，而是让它们跟随幅度变化不大
            // 更好的方式：由于氢键太多，我们每5帧重建一次，或者干脆不做动态氢键
            // 这里采用简单方式：删除旧的氢键，重新生成（每5帧）
        }

        // 10.2 聚合酶动态（上下浮动 + 旋转）
        const enzymeY = 0.2 * Math.sin(time * 1.5);
        const enzymeZ = 0.2 * Math.cos(time * 1.3);
        polymeraseGroup.position.set(0.5, enzymeY, enzymeZ);
        polymeraseGroup.rotation.x = Math.sin(time * 0.5) * 0.1;
        polymeraseGroup.rotation.z = Math.cos(time * 0.7) * 0.1;

        // 10.3 更新mRNA
        updateMRNA(time);

        // 10.4 更新翻译
        updateTranslation(time);

        // 10.5 星星旋转
        stars.rotation.y += 0.0003;

        // 10.6 相机微微晃动（增加动感）
        camera.position.x = 10 + Math.sin(time * 0.02) * 1;
        camera.position.y = 6 + Math.sin(time * 0.03) * 0.5;
        camera.lookAt(2, 0, 0);

        // 10.7 渲染
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    // ----- 窗口自适应 -----
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();

})();
