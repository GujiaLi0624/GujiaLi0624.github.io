// ============================================================
// dna-story.js – 中心法则 3D 分阶段叙事动画（方格碱基版）
// 碱基为平面方格，表面绘制字母 A/T/C/G
// ============================================================

(function() {
    // ----- 1. 场景、相机、渲染器（全屏，置于底层） -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(8, 5, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 强制置于底层
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.pointerEvents = 'none';
    document.body.prepend(renderer.domElement);

    // ----- 2. 灯光（保持不变） -----
    const ambient = new THREE.AmbientLight(0x404060);
    scene.add(ambient);
    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5);
    fillLight.position.set(-5, 0, 10);
    scene.add(fillLight);
    const backLight = new THREE.DirectionalLight(0xaa88ff, 0.4);
    backLight.position.set(0, -3, -10);
    scene.add(backLight);

    // ----- 3. 工具：创建文字标签（用于阶段提示） -----
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

    // ----- 4. 碱基颜色 -----
    const BASE_COLORS = {
        A: '#ff6b6b',
        T: '#4ecdc4',
        G: '#ffe66d',
        C: '#a29bfe'
    };
    const LETTERS = ['A', 'T', 'G', 'C'];
    const PAIR_MAP = { A: 'T', T: 'A', G: 'C', C: 'G' };

    // ----- 5. 创建单个碱基方格（带字母纹理） -----
    function createBaseSquare(letter, size = 0.6) {
        const group = new THREE.Group();

        // 创建 Canvas 绘制字母和背景色
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        // 背景色
        const color = BASE_COLORS[letter] || '#ffffff';
        ctx.fillStyle = color;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillRect(0, 0, 128, 128);
        // 边框
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, 128, 128);
        // 字母
        ctx.font = 'Bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(letter, 64, 68);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.3,
            metalness: 0.1,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.2,
            side: THREE.DoubleSide
        });
        const geometry = new THREE.PlaneGeometry(size, size);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 让方格始终面向相机？不需要，保持固定方向，但为了立体感，我们让它朝向Z轴正方向
        // 但在DNA螺旋中可能需要旋转，我们稍后单独旋转
        return group;
    }

    // ----- 6. 星星背景（不变） -----
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

    // 阶段标签
    const stageLabel = makeLabel('⚛️ 散落碱基', '#60cfff', 1.2);
    stageLabel.position.set(0, 4.5, 0);
    container.add(stageLabel);

    // ----- 8. 数据模型 -----
    const TOTAL_BASES = 40;
    let bases = []; // { group, letter, currentPos, targetPos, pairIndex }
    let dnaPairs = [];
    let mRNA = null;
    let ribosome = null;
    let aminoAcids = [];
    let proteinGroup = null;

    let elapsed = 0;
    const CYCLE_DURATION = 20;

    // ----- 9. 初始化碱基（散落） -----
    function initBases() {
        // 清空容器（保留标签）
        while(container.children.length > 1) {
            container.remove(container.children[container.children.length-1]);
        }
        container.add(stageLabel);

        bases = [];
        dnaPairs = [];
        mRNA = null;
        aminoAcids = [];
        proteinGroup = null;

        const half = TOTAL_BASES / 2;
        for (let i = 0; i < TOTAL_BASES; i++) {
            const letter = LETTERS[i % 4];
            const group = createBaseSquare(letter, 0.6);
            // 散落位置
            const x = (Math.random() - 0.5) * 12;
            const y = (Math.random() - 0.5) * 6;
            const z = (Math.random() - 0.5) * 6;
            group.position.set(x, y, z);
            // 随机旋转
            group.rotation.x = Math.random() * Math.PI;
            group.rotation.y = Math.random() * Math.PI;
            container.add(group);

            bases.push({
                group: group,
                letter: letter,
                currentPos: new THREE.Vector3(x, y, z),
                targetPos: new THREE.Vector3(0, 0, 0),
                pairIndex: -1
            });
        }

        // 配对关系
        for (let i = 0; i < half; i++) {
            bases[i].pairIndex = i + half;
            bases[i + half].pairIndex = i;
        }
    }

    // ----- 10. 计算DNA目标位置（横向双螺旋） -----
    function computeDNAPositions(progress) {
        const startX = -5;
        const endX = 5;
        const spacing = (endX - startX) / (TOTAL_BASES / 2 - 1);
        const ampY = 1.8;
        const ampZ = 1.8;
        const half = TOTAL_BASES / 2;
        const phase = 0;

        for (let i = 0; i < half; i++) {
            const idx1 = i;
            const idx2 = i + half;
            const x = startX + i * spacing;
            const angle = x * 0.8 + phase;
            const y1 = ampY * Math.sin(angle);
            const z1 = ampZ * Math.cos(angle);
            const y2 = ampY * Math.sin(angle + Math.PI);
            const z2 = ampZ * Math.cos(angle + Math.PI);

            bases[idx1].targetPos.set(x, y1, z1);
            bases[idx2].targetPos.set(x, y2, z2);
        }
    }

    // ----- 11. 创建/更新氢键（线条） -----
    function createHydrogenBonds() {
        // 清除旧线
        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];
            if (child.isLine) {
                container.remove(child);
            }
        }
        dnaPairs = [];
        const half = TOTAL_BASES / 2;
        for (let i = 0; i < half; i++) {
            const idx1 = i;
            const idx2 = i + half;
            const p1 = bases[idx1].currentPos;
            const p2 = bases[idx2].currentPos;
            const points = [p1.clone(), p2.clone()];
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.3 });
            const line = new THREE.Line(geo, mat);
            container.add(line);
            dnaPairs.push({ line, idx1, idx2 });
        }
    }

    function updateHydrogenBonds() {
        for (let pair of dnaPairs) {
            const p1 = bases[pair.idx1].currentPos;
            const p2 = bases[pair.idx2].currentPos;
            const positions = pair.line.geometry.attributes.position;
            positions.setXYZ(0, p1.x, p1.y, p1.z);
            positions.setXYZ(1, p2.x, p2.y, p2.z);
            positions.needsUpdate = true;
        }
    }

    // ----- 12. mRNA 管理 -----
    function createMRNA() {
        if (mRNA) {
            container.remove(mRNA.mesh);
        }
        const points = [];
        const geo = new THREE.BufferGeometry();
        const mat = new THREE.LineBasicMaterial({ color: 0xfd79a8, linewidth: 2 });
        const line = new THREE.Line(geo, mat);
        container.add(line);
        mRNA = { points, mesh: line };
    }

    function updateMRNA(progress) {
        if (!mRNA) return;
        const count = Math.floor(progress * 50) + 5;
        const startX = -3 + progress * 2;
        const startY = 0;
        const startZ = 0;
        mRNA.points = [];
        for (let i = 0; i < count; i++) {
            const x = startX + i * 0.15;
            const y = startY + Math.sin(i * 0.5 + progress * 4) * 0.4;
            const z = startZ + Math.cos(i * 0.3 + progress * 3) * 0.4;
            mRNA.points.push(new THREE.Vector3(x, y, z));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(mRNA.points);
        mRNA.mesh.geometry.dispose();
        mRNA.mesh.geometry = geo;
    }

    // ----- 13. 核糖体 -----
    function createRibosome() {
        if (ribosome) {
            container.remove(ribosome);
        }
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x4c1d95, emissiveIntensity: 0.6 });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), mat);
        core.castShadow = true;
        group.add(core);
        const ringGeo = new THREE.BufferGeometry();
        const count = 20;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            pos[i*3] = Math.cos(a) * 1.0;
            pos[i*3+1] = Math.sin(a) * 1.0;
            pos[i*3+2] = 0;
        }
        ringGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const ringMat = new THREE.PointsMaterial({ color: 0xaa88ff, size: 0.08 });
        const ring = new THREE.Points(ringGeo, ringMat);
        group.add(ring);
        container.add(group);
        ribosome = group;
    }

    function updateRibosome(progress) {
        if (!ribosome || !mRNA || mRNA.points.length < 2) return;
        const idx = Math.min(Math.floor(progress * mRNA.points.length), mRNA.points.length - 1);
        const pos = mRNA.points[idx];
        if (pos) {
            ribosome.position.copy(pos);
        }
    }

    // ----- 14. 翻译与折叠（氨基酸仍用小球，但可保留） -----
    function updateTranslation(progress) {
        // 清除旧氨基酸
        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];
            if (child.userData && child.userData.isAmino) {
                container.remove(child);
            }
        }
        if (!ribosome) return;

        const count = Math.floor(progress * 25);
        const positions = [];
        const basePos = ribosome.position.clone();
        for (let i = 0; i < count; i++) {
            let x = basePos.x + 0.5 + i * 0.4;
            let y = basePos.y + Math.sin(i * 1.2 + progress * 2) * 0.5;
            let z = basePos.z + Math.cos(i * 0.9 + progress * 1.5) * 0.5;

            if (count > 8 && progress > 0.6) {
                const foldProgress = Math.min(1, (progress - 0.6) / 0.4);
                const center = new THREE.Vector3(6, 0, 0);
                const radius = 1.8;
                const angle1 = (i / count) * Math.PI * 2 + progress * 0.5;
                const angle2 = Math.sin(i * 0.7 + progress) * 1.2;
                const targetX = center.x + radius * 0.8 * Math.sin(angle1) * Math.cos(angle2);
                const targetY = center.y + radius * 0.8 * Math.sin(angle2);
                const targetZ = center.z + radius * 0.8 * Math.cos(angle1) * Math.cos(angle2);
                x = x + (targetX - x) * foldProgress * 0.06;
                y = y + (targetY - y) * foldProgress * 0.06;
                z = z + (targetZ - z) * foldProgress * 0.06;
            }

            const color = new THREE.Color().setHSL(0.55 + i * 0.025, 0.8, 0.6);
            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.3,
                roughness: 0.3
            });
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), mat);
            sphere.position.set(x, y, z);
            sphere.castShadow = true;
            sphere.userData.isAmino = true;
            container.add(sphere);
            positions.push(new THREE.Vector3(x, y, z));
        }

        if (positions.length > 1) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(positions);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
            const line = new THREE.Line(lineGeo, lineMat);
            line.userData.isAmino = true;
            container.add(line);
        }

        if (count > 15 && progress > 0.8) {
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0xa78bfa,
                transparent: true,
                opacity: 0.1 + 0.05 * Math.sin(elapsed * 2)
            });
            const glow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), glowMat);
            glow.position.set(6, 0, 0);
            glow.userData.isAmino = true;
            container.add(glow);
        }
    }

    // ----- 15. 主更新函数 -----
    function updateScene(time) {
        elapsed = time;
        const t = elapsed % CYCLE_DURATION;

        let stage = 0;
        let progress = 0;
        if (t < 4) { stage = 0; progress = t / 4; }
        else if (t < 8) { stage = 1; progress = (t - 4) / 4; }
        else if (t < 12) { stage = 2; progress = (t - 8) / 4; }
        else if (t < 16) { stage = 3; progress = (t - 12) / 4; }
        else { stage = 4; progress = (t - 16) / 4; }

        const stageNames = [
            '⚛️ 散落碱基',
            '🧬 组装 DNA 双链',
            '✂️ 解旋 · 转录 mRNA',
            '⚙️ 翻译 · 肽链延长',
            '🧩 蛋白质折叠 (三级结构)'
        ];
        stageLabel.material.map = makeLabel(stageNames[stage], '#60cfff', 1.2).material.map;
        stageLabel.material.needsUpdate = true;

        // ---- 阶段0：散落 ----
        if (stage === 0) {
            for (let b of bases) {
                b.group.position.x += (Math.random() - 0.5) * 0.02;
                b.group.position.y += (Math.random() - 0.5) * 0.02;
                b.group.position.z += (Math.random() - 0.5) * 0.02;
                b.group.position.x = Math.max(-6, Math.min(6, b.group.position.x));
                b.group.position.y = Math.max(-3, Math.min(3, b.group.position.y));
                b.group.position.z = Math.max(-3, Math.min(3, b.group.position.z));
                b.currentPos.copy(b.group.position);
                // 随机旋转
                b.group.rotation.x += (Math.random() - 0.5) * 0.02;
                b.group.rotation.y += (Math.random() - 0.5) * 0.02;
            }
            // 清除线等
            for (let i = container.children.length - 1; i >= 0; i--) {
                const child = container.children[i];
                if (child.isLine || (child.userData && child.userData.isAmino)) {
                    container.remove(child);
                }
            }
            dnaPairs = [];
            if (mRNA) { container.remove(mRNA.mesh); mRNA = null; }
            if (ribosome) { container.remove(ribosome); ribosome = null; }
        }

        // ---- 阶段1：组装 ----
        if (stage === 1) {
            if (!bases[0].targetPos.x) computeDNAPositions(0);
            computeDNAPositions(progress);
            for (let b of bases) {
                b.group.position.lerp(b.targetPos, 0.05);
                b.currentPos.copy(b.group.position);
                // 让方格朝向Z轴或保持方向？为了美观，让它们始终面对相机？我们可以让它们始终面对相机，但为了立体感，不统一旋转。
                // 简单设置朝向Z正方向
                b.group.rotation.set(0, 0, 0);
            }
            if (dnaPairs.length === 0 && progress > 0.1) {
                createHydrogenBonds();
            } else {
                updateHydrogenBonds();
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

        // ---- 阶段2：解旋+转录 ----
        if (stage === 2) {
            // 维持DNA，但解旋
            const half = TOTAL_BASES / 2;
            const openRange = Math.floor(progress * 8);
            const centerIdx = Math.floor(half / 2);
            // 先恢复完整DNA位置
            computeDNAPositions(1);
            for (let i = 0; i < half; i++) {
                const idx1 = i;
                const idx2 = i + half;
                const dist = Math.abs(i - centerIdx);
                if (dist <= openRange) {
                    const factor = (1 - dist / (openRange + 1)) * 0.8 * progress;
                    bases[idx1].targetPos.y += factor * 0.5;
                    bases[idx2].targetPos.y -= factor * 0.5;
                    bases[idx1].targetPos.z += factor * 0.3;
                    bases[idx2].targetPos.z -= factor * 0.3;
                }
            }
            for (let b of bases) {
                b.group.position.lerp(b.targetPos, 0.05);
                b.currentPos.copy(b.group.position);
                b.group.rotation.set(0, 0, 0);
            }
            updateHydrogenBonds();

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
            if (!ribosome) createRibosome();
            updateMRNA(1);
            updateRibosome(progress);
            updateTranslation(progress);
        }

        // ---- 阶段4：折叠 ----
        if (stage === 4) {
            if (!ribosome) createRibosome();
            updateMRNA(1);
            updateRibosome(1);
            updateTranslation(0.8 + progress * 0.2);
        }

        starField.rotation.y += 0.0005;
    }

    // ----- 16. 初始化 -----
    initBases();

    // ----- 17. 动画循环 -----
    let clock = new THREE.Clock();
    function animate() {
        const delta = clock.getDelta();
        const time = clock.elapsedTime;
        updateScene(time);

        camera.position.x = 8 + Math.sin(time * 0.02) * 1.5;
        camera.position.y = 5 + Math.sin(time * 0.03) * 0.8;
        camera.lookAt(1, 0, 0);

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

})();
