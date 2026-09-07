// ============================================================
// dna-story.js – 化学键风格DNA + 中心法则 (球棍模型/横向排列)
// ============================================================

(function() {
    // ----- 1. 场景、相机、渲染器 -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(10, 4, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.pointerEvents = 'none';
    document.body.prepend(renderer.domElement);

    // ----- 2. 灯光 -----
    const ambient = new THREE.AmbientLight(0x404060);
    scene.add(ambient);
    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    fillLight.position.set(-5, 0, 10);
    scene.add(fillLight);
    const backLight = new THREE.DirectionalLight(0xaa88ff, 0.4);
    backLight.position.set(0, -3, -10);
    scene.add(backLight);

    // ----- 3. 工具函数 -----
    function makeLabel(text, color, size = 0.8) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 128);
        ctx.font = 'Bold 48px Arial, "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 15;
        ctx.fillStyle = color || '#ffffff';
        ctx.fillText(text, 256, 68);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(size * 4, size * 1, 1);
        return sprite;
    }

    // 创建圆柱体（化学键）
    function createBond(from, to, color = 0x8899aa, radius = 0.06) {
        const start = new THREE.Vector3(from.x, from.y, from.z);
        const end = new THREE.Vector3(to.x, to.y, to.z);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        if (length < 0.001) return new THREE.Group();
        direction.normalize();
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const geo = new THREE.CylinderGeometry(radius, radius, length, 6);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(mid);
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, direction);
        mesh.quaternion.copy(quat);
        mesh.castShadow = true;
        return mesh;
    }

    // 创建碱基字母纹理
    function createBaseTexture(letter, colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const color = '#' + colorHex.toString(16).padStart(6, '0');
        ctx.fillStyle = color;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillRect(0, 0, 128, 128);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 128, 128);
        ctx.font = 'Bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(letter, 64, 68);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        return texture;
    }

    // ----- 4. 颜色定义 -----
    const BASE_COLORS = {
        A: 0xff6b6b,
        T: 0x4ecdc4,
        G: 0xffe66d,
        C: 0xa29bfe
    };
    const LETTERS = ['A', 'T', 'G', 'C'];
    const PAIR_MAP = { A: 'T', T: 'A', G: 'C', C: 'G' };
    const SUGAR_COLOR = 0x66aaff;
    const PHOSPHATE_COLOR = 0xff8833;
    const HYDROGEN_COLOR = 0x88ddff;

    // ----- 5. 构建单个核苷酸（球棍模型） -----
    function createNucleotidePair(index, x, angle, letter1, letter2) {
        const group = new THREE.Group();
        const ampY = 1.8;
        const ampZ = 1.8;

        // 链1位置
        const y1 = ampY * Math.sin(angle);
        const z1 = ampZ * Math.cos(angle);
        const pos1 = new THREE.Vector3(x, y1, z1);

        // 链2位置
        const y2 = ampY * Math.sin(angle + Math.PI);
        const z2 = ampZ * Math.cos(angle + Math.PI);
        const pos2 = new THREE.Vector3(x, y2, z2);

        // 中间点（碱基配对中心）
        const mid = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);

        // ---- 骨架：磷酸基团（大球） ----
        const phosMat = new THREE.MeshStandardMaterial({ color: PHOSPHATE_COLOR, roughness: 0.3, metalness: 0.2, emissive: PHOSPHATE_COLOR, emissiveIntensity: 0.1 });
        const phosGeo = new THREE.SphereGeometry(0.25, 12, 12);
        const phos1 = new THREE.Mesh(phosGeo, phosMat);
        phos1.position.copy(pos1);
        phos1.castShadow = true;
        group.add(phos1);

        const phos2 = new THREE.Mesh(phosGeo, phosMat);
        phos2.position.copy(pos2);
        phos2.castShadow = true;
        group.add(phos2);

        // ---- 糖基团（小球，紧挨着磷酸） ----
        const sugarMat = new THREE.MeshStandardMaterial({ color: SUGAR_COLOR, roughness: 0.4, metalness: 0.1 });
        const sugarGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const sugar1 = new THREE.Mesh(sugarGeo, sugarMat);
        // 糖在磷酸内侧方向偏移
        const dir1 = new THREE.Vector3().subVectors(mid, pos1).normalize().multiplyScalar(0.35);
        sugar1.position.copy(pos1.clone().add(dir1));
        sugar1.castShadow = true;
        group.add(sugar1);

        const sugar2 = new THREE.Mesh(sugarGeo, sugarMat);
        const dir2 = new THREE.Vector3().subVectors(mid, pos2).normalize().multiplyScalar(0.35);
        sugar2.position.copy(pos2.clone().add(dir2));
        sugar2.castShadow = true;
        group.add(sugar2);

        // ---- 磷酸-糖 化学键 ----
        const bond1 = createBond(pos1, sugar1.position, 0x88aadd, 0.04);
        group.add(bond1);
        const bond2 = createBond(pos2, sugar2.position, 0x88aadd, 0.04);
        group.add(bond2);

        // ---- 碱基（彩色平面，带字母） ----
        const baseWidth = 0.5;
        const baseHeight = 0.4;
        const color1 = BASE_COLORS[letter1];
        const color2 = BASE_COLORS[letter2];

        const tex1 = createBaseTexture(letter1, color1);
        const tex2 = createBaseTexture(letter2, color2);

        const baseMat1 = new THREE.MeshStandardMaterial({ map: tex1, side: THREE.DoubleSide, emissive: new THREE.Color(color1), emissiveIntensity: 0.15 });
        const baseMat2 = new THREE.MeshStandardMaterial({ map: tex2, side: THREE.DoubleSide, emissive: new THREE.Color(color2), emissiveIntensity: 0.15 });

        const baseGeo = new THREE.PlaneGeometry(baseWidth, baseHeight);
        const baseMesh1 = new THREE.Mesh(baseGeo, baseMat1);
        // 碱基位置：从糖向中心延伸
        const basePos1 = new THREE.Vector3().lerpVectors(sugar1.position, mid, 0.6);
        baseMesh1.position.copy(basePos1);
        // 朝向中心
        const lookTarget1 = new THREE.Vector3().lerpVectors(basePos1, mid, 0.1);
        baseMesh1.lookAt(lookTarget1);
        baseMesh1.castShadow = true;
        group.add(baseMesh1);

        const baseMesh2 = new THREE.Mesh(baseGeo, baseMat2);
        const basePos2 = new THREE.Vector3().lerpVectors(sugar2.position, mid, 0.6);
        baseMesh2.position.copy(basePos2);
        const lookTarget2 = new THREE.Vector3().lerpVectors(basePos2, mid, 0.1);
        baseMesh2.lookAt(lookTarget2);
        baseMesh2.castShadow = true;
        group.add(baseMesh2);

        // ---- 碱基-糖 化学键 ----
        const bondBase1 = createBond(sugar1.position, basePos1, 0x99bbcc, 0.03);
        group.add(bondBase1);
        const bondBase2 = createBond(sugar2.position, basePos2, 0x99bbcc, 0.03);
        group.add(bondBase2);

        // ---- 氢键（碱基对之间的虚线连接，用一串小点） ----
        const hBondCount = 5;
        for (let k = 0; k < hBondCount; k++) {
            const t = (k + 0.5) / hBondCount;
            const hPos = new THREE.Vector3().lerpVectors(basePos1, basePos2, t);
            const hMat = new THREE.MeshBasicMaterial({ color: HYDROGEN_COLOR, transparent: true, opacity: 0.5 });
            const hMesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), hMat);
            hMesh.position.copy(hPos);
            group.add(hMesh);
        }

        // 存储关键引用以便动态更新
        group.userData = {
            pos1: pos1.clone(),
            pos2: pos2.clone(),
            mid: mid.clone(),
            basePos1: basePos1.clone(),
            basePos2: basePos2.clone(),
            sugar1: sugar1.position.clone(),
            sugar2: sugar2.position.clone(),
            letter1: letter1,
            letter2: letter2,
            index: index,
            // 存储子对象引用以便更新位置
            children: {
                phos1, phos2, sugar1, sugar2, baseMesh1, baseMesh2,
                bond1, bond2, bondBase1, bondBase2
            }
        };

        return group;
    }

    // ----- 6. 星星背景 -----
    function addStars() {
        const starGeo = new THREE.BufferGeometry();
        const starCount = 1200;
        const pos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i += 3) {
            const r = 35 + Math.random() * 40;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i] = r * Math.sin(phi) * Math.cos(theta);
            pos[i+1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i+2] = r * Math.cos(phi);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const starMat = new THREE.PointsMaterial({ color: 0x88aadd, size: 0.12, transparent: true });
        const stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);
        return stars;
    }
    const starField = addStars();

    // ----- 7. 主容器 -----
    const container = new THREE.Group();
    scene.add(container);

    const stageLabel = makeLabel('⚛️ 散落核苷酸', '#60cfff', 1.2);
    stageLabel.position.set(0, 5.0, 0);
    container.add(stageLabel);

    // ----- 8. 数据模型 -----
    const TOTAL_BASES = 36;
    let nucleotides = []; // 存储每个核苷酸组
    let dnaPairs = [];
    let mRNA = null;
    let ribosome = null;
    let elapsed = 0;
    const CYCLE_DURATION = 22;

    // ----- 9. 初始化核苷酸（散落） -----
    function initNucleotides() {
        while(container.children.length > 1) container.remove(container.children[container.children.length-1]);
        container.add(stageLabel);
        nucleotides = [];

        const half = TOTAL_BASES / 2;
        // 生成配对序列
        const seq = [];
        for (let i = 0; i < half; i++) {
            const idx = Math.floor(Math.random() * 4);
            const l1 = LETTERS[idx];
            const l2 = PAIR_MAP[l1];
            seq.push({ l1, l2 });
        }

        for (let i = 0; i < half; i++) {
            const x = (i - half/2) * 0.35;
            const angle = x * 0.8;
            const { l1, l2 } = seq[i];
            const group = createNucleotidePair(i, x, angle, l1, l2);
            // 散落位置：随机偏移
            const scatterOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5
            );
            group.position.copy(scatterOffset);
            group.rotation.x = (Math.random() - 0.5) * 0.5;
            group.rotation.y = (Math.random() - 0.5) * 0.5;
            group.rotation.z = (Math.random() - 0.5) * 0.5;
            container.add(group);

            // 存储目标位置（组装后的位置）
            const targetPos = new THREE.Vector3(0, 0, 0);
            nucleotides.push({
                group: group,
                targetPos: new THREE.Vector3(0, 0, 0),
                currentPos: group.position.clone(),
                letter1: l1,
                letter2: l2,
                idx: i,
                x: x,
                angle: angle
            });
        }
    }

    // ----- 10. 计算DNA目标位置（横向双螺旋） -----
    function computeDNATargets(progress) {
        const half = TOTAL_BASES / 2;
        const startX = -5.5;
        const endX = 5.5;
        const spacing = (endX - startX) / (half - 1);
        const ampY = 1.8;
        const ampZ = 1.8;
        const phase = 0;

        for (let i = 0; i < half; i++) {
            const x = startX + i * spacing;
            const angle = x * 0.8 + phase;
            const y1 = ampY * Math.sin(angle);
            const z1 = ampZ * Math.cos(angle);
            const y2 = ampY * Math.sin(angle + Math.PI);
            const z2 = ampZ * Math.cos(angle + Math.PI);
            const mid = new THREE.Vector3(x, (y1+y2)/2, (z1+z2)/2);

            // 目标位置是核苷酸组的中心
            nucleotides[i].targetPos.set(x, (y1+y2)/2, (z1+z2)/2);
            // 存储每个原子的偏移量以便精细移动（我们移动整个组，所以只需组位置）
            nucleotides[i].group.userData.targetPos1 = new THREE.Vector3(x, y1, z1);
            nucleotides[i].group.userData.targetPos2 = new THREE.Vector3(x, y2, z2);
            nucleotides[i].group.userData.targetMid = mid;
        }
    }

    // ----- 11. 更新核苷酸位置（用于组装和解旋） -----
    function updateNucleotidePositions(progress, stage) {
        const half = TOTAL_BASES / 2;
        const startX = -5.5;
        const endX = 5.5;
        const spacing = (endX - startX) / (half - 1);
        const ampY = 1.8;
        const ampZ = 1.8;
        const phase = 0;

        // 计算解旋偏移
        let openOffset = 0;
        let openRange = 0;
        const centerIdx = Math.floor(half / 2);
        if (stage === 2) {
            openRange = Math.floor(progress * 10);
            openOffset = progress * 0.6;
        } else if (stage === 3 || stage === 4) {
            openRange = 10;
            openOffset = 0.6;
        }

        for (let i = 0; i < half; i++) {
            const x = startX + i * spacing;
            const angle = x * 0.8 + phase;
            let y1 = ampY * Math.sin(angle);
            let z1 = ampZ * Math.cos(angle);
            let y2 = ampY * Math.sin(angle + Math.PI);
            let z2 = ampZ * Math.cos(angle + Math.PI);

            // 解旋：中间打开
            const dist = Math.abs(i - centerIdx);
            if (dist <= openRange && (stage === 2 || stage === 3 || stage === 4)) {
                const factor = (1 - dist / (openRange + 1)) * openOffset;
                y1 += factor * 0.8;
                y2 -= factor * 0.8;
                z1 += factor * 0.4;
                z2 -= factor * 0.4;
            }

            const mid = new THREE.Vector3(x, (y1+y2)/2, (z1+z2)/2);
            const targetPos = new THREE.Vector3(x, (y1+y2)/2, (z1+z2)/2);

            if (stage === 0) {
                // 散落：随机运动在 update 中处理
            } else {
                // 平滑移动到目标
                nucleotides[i].group.position.lerp(targetPos, 0.06);
                nucleotides[i].group.position.lerp(targetPos, 0.06);
                // 旋转归零
                nucleotides[i].group.rotation.x *= 0.95;
                nucleotides[i].group.rotation.y *= 0.95;
                nucleotides[i].group.rotation.z *= 0.95;
            }
        }
    }

    // ----- 12. mRNA 管理 -----
    function createMRNA() {
        if (mRNA) container.remove(mRNA.mesh);
        const points = [];
        const geo = new THREE.BufferGeometry();
        const mat = new THREE.LineBasicMaterial({ color: 0xfd79a8, linewidth: 2 });
        const line = new THREE.Line(geo, mat);
        container.add(line);
        mRNA = { points, mesh: line };
    }
    function updateMRNA(progress) {
        if (!mRNA) return;
        const count = Math.floor(progress * 55) + 5;
        const startX = -2 + progress * 1.5;
        const startY = 0.5;
        const startZ = 0;
        mRNA.points = [];
        for (let i = 0; i < count; i++) {
            const x = startX + i * 0.18;
            const y = startY + Math.sin(i * 0.6 + progress * 4) * 0.5;
            const z = startZ + Math.cos(i * 0.4 + progress * 3) * 0.5;
            mRNA.points.push(new THREE.Vector3(x, y, z));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(mRNA.points);
        mRNA.mesh.geometry.dispose();
        mRNA.mesh.geometry = geo;
    }

    // ----- 13. 核糖体 -----
    function createRibosome() {
        if (ribosome) container.remove(ribosome);
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x4c1d95, emissiveIntensity: 0.6 });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), mat);
        core.castShadow = true;
        group.add(core);
        // 大小亚基示意
        const smallMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, emissive: 0x4c1d95, emissiveIntensity: 0.3 });
        const small = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), smallMat);
        small.position.set(0.8, -0.3, 0);
        group.add(small);
        const large = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), smallMat);
        large.position.set(-0.7, 0.4, 0);
        group.add(large);

        container.add(group);
        ribosome = group;
    }
    function updateRibosome(progress) {
        if (!ribosome || !mRNA || mRNA.points.length < 2) return;
        const idx = Math.min(Math.floor(progress * mRNA.points.length), mRNA.points.length - 1);
        const pos = mRNA.points[idx];
        if (pos) ribosome.position.copy(pos);
    }

    // ----- 14. 翻译与折叠（氨基酸链） -----
    function updateTranslation(progress) {
        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];
            if (child.userData && child.userData.isAmino) container.remove(child);
        }
        if (!ribosome) return;

        const count = Math.floor(progress * 28);
        const positions = [];
        const basePos = ribosome.position.clone();

        for (let i = 0; i < count; i++) {
            let x = basePos.x + 0.6 + i * 0.35;
            let y = basePos.y + Math.sin(i * 1.3 + progress * 2) * 0.6;
            let z = basePos.z + Math.cos(i * 0.8 + progress * 1.5) * 0.6;

            // 折叠效果
            if (count > 10 && progress > 0.6) {
                const foldProgress = Math.min(1, (progress - 0.6) / 0.4);
                const center = new THREE.Vector3(7, 0, 0);
                const radius = 2.0;
                const angle1 = (i / count) * Math.PI * 2 + progress * 0.6;
                const angle2 = Math.sin(i * 0.7 + progress) * 1.3;
                const tx = center.x + radius * 0.8 * Math.sin(angle1) * Math.cos(angle2);
                const ty = center.y + radius * 0.8 * Math.sin(angle2);
                const tz = center.z + radius * 0.8 * Math.cos(angle1) * Math.cos(angle2);
                x += (tx - x) * foldProgress * 0.04;
                y += (ty - y) * foldProgress * 0.04;
                z += (tz - z) * foldProgress * 0.04;
            }

            const color = new THREE.Color().setHSL(0.55 + i * 0.022, 0.8, 0.6);
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.3,
                roughness: 0.3
            });
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat);
            sphere.position.set(x, y, z);
            sphere.castShadow = true;
            sphere.userData.isAmino = true;
            container.add(sphere);
            positions.push(new THREE.Vector3(x, y, z));
        }

        if (positions.length > 1) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(positions);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
            const line = new THREE.Line(lineGeo, lineMat);
            line.userData.isAmino = true;
            container.add(line);
        }

        if (count > 18 && progress > 0.8) {
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0xa78bfa,
                transparent: true,
                opacity: 0.08 + 0.04 * Math.sin(elapsed * 1.5)
            });
            const glow = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 16), glowMat);
            glow.position.set(7, 0, 0);
            glow.userData.isAmino = true;
            container.add(glow);
        }
    }

    // ----- 15. 主更新函数 -----
    function updateScene(time) {
        elapsed = time;
        const t = elapsed % CYCLE_DURATION;
        let stage = 0, progress = 0;
        if (t < 4) { stage = 0; progress = t / 4; }
        else if (t < 8) { stage = 1; progress = (t - 4) / 4; }
        else if (t < 12) { stage = 2; progress = (t - 8) / 4; }
        else if (t < 16) { stage = 3; progress = (t - 12) / 4; }
        else { stage = 4; progress = (t - 16) / 4; }

        const stageNames = [
            '⚛️ 散落核苷酸 (球棍模型)',
            '🧬 组装 DNA 双链 (横向螺旋)',
            '✂️ 解旋 · 转录 mRNA',
            '⚙️ 翻译 · 肽链延长',
            '🧩 蛋白质折叠 (三级结构)'
        ];
        stageLabel.material.map = makeLabel(stageNames[stage], '#60cfff', 1.2).material.map;
        stageLabel.material.needsUpdate = true;

        // ---- 阶段0：散落 ----
        if (stage === 0) {
            for (let n of nucleotides) {
                n.group.position.x += (Math.random() - 0.5) * 0.025;
                n.group.position.y += (Math.random() - 0.5) * 0.025;
                n.group.position.z += (Math.random() - 0.5) * 0.025;
                n.group.position.x = Math.max(-7, Math.min(7, n.group.position.x));
                n.group.position.y = Math.max(-4, Math.min(4, n.group.position.y));
                n.group.position.z = Math.max(-4, Math.min(4, n.group.position.z));
                n.group.rotation.x += (Math.random() - 0.5) * 0.02;
                n.group.rotation.y += (Math.random() - 0.5) * 0.02;
                n.group.rotation.z += (Math.random() - 0.5) * 0.02;
            }
            // 清除mRNA等
            if (mRNA) { container.remove(mRNA.mesh); mRNA = null; }
            if (ribosome) { container.remove(ribosome); ribosome = null; }
            for (let i = container.children.length - 1; i >= 0; i--) {
                if (container.children[i].userData && container.children[i].userData.isAmino) {
                    container.remove(container.children[i]);
                }
            }
        }

        // ---- 阶段1：组装 ----
        if (stage === 1) {
            if (nucleotides.length > 0 && nucleotides[0].targetPos.x === 0) {
                computeDNATargets(0);
            }
            computeDNATargets(progress);
            updateNucleotidePositions(progress, 1);
            // 清除mRNA等
            if (mRNA) { container.remove(mRNA.mesh); mRNA = null; }
            if (ribosome) { container.remove(ribosome); ribosome = null; }
            for (let i = container.children.length - 1; i >= 0; i--) {
                if (container.children[i].userData && container.children[i].userData.isAmino) {
                    container.remove(container.children[i]);
                }
            }
        }

        // ---- 阶段2：解旋+转录 ----
        if (stage === 2) {
            computeDNATargets(1);
            updateNucleotidePositions(progress, 2);
            if (!mRNA) createMRNA();
            updateMRNA(progress);
            if (ribosome) { container.remove(ribosome); ribosome = null; }
            for (let i = container.children.length - 1; i >= 0; i--) {
                if (container.children[i].userData && container.children[i].userData.isAmino) {
                    container.remove(container.children[i]);
                }
            }
        }

        // ---- 阶段3：翻译 ----
        if (stage === 3) {
            computeDNATargets(1);
            updateNucleotidePositions(1, 3);
            if (!mRNA) createMRNA();
            updateMRNA(1);
            if (!ribosome) createRibosome();
            updateRibosome(progress);
            updateTranslation(progress);
        }

        // ---- 阶段4：折叠 ----
        if (stage === 4) {
            computeDNATargets(1);
            updateNucleotidePositions(1, 4);
            if (!mRNA) createMRNA();
            updateMRNA(1);
            if (!ribosome) createRibosome();
            updateRibosome(1);
            updateTranslation(0.8 + progress * 0.2);
        }

        starField.rotation.y += 0.0003;
    }

    // ----- 16. 初始化 -----
    initNucleotides();

    // ----- 17. 动画循环 -----
    let clock = new THREE.Clock();
    function animate() {
        const delta = clock.getDelta();
        const time = clock.elapsedTime;
        updateScene(time);

        camera.position.x = 10 + Math.sin(time * 0.015) * 1.5;
        camera.position.y = 4 + Math.sin(time * 0.02) * 0.8;
        camera.lookAt(1.5, 0, 0);

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();

    // ----- 18. 窗口自适应 -----
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

})();
