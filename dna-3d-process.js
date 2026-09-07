// ============================================================
// dna-story.js – 中心法则 3D 分阶段叙事动画
// 阶段：散落 → 组装DNA → 解旋+转录 → 翻译 → 蛋白质折叠
// ============================================================

(function() {
    // ----- 1. 场景、相机、渲染器（全屏） -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(8, 5, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
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

    // ----- 3. 工具：创建 Sprite 标签（清晰字体） -----
    function makeLabel(text, color, size = 0.8) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 128);
        ctx.font = 'Bold 48px Arial, Helvetica, sans-serif';
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

    // ----- 4. 定义颜色和碱基字母 -----
    const BASE_COLORS = {
        A: 0xff6b6b,
        T: 0x4ecdc4,
        G: 0xffe66d,
        C: 0xa29bfe
    };
    const LETTERS = ['A', 'T', 'G', 'C'];
    const PAIR_MAP = { A: 'T', T: 'A', G: 'C', C: 'G' };

    // ----- 5. 创建场景中的固定元素（星星背景） -----
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

    // ----- 6. 主容器：存放动态元素 -----
    const container = new THREE.Group();
    scene.add(container);

    // 阶段提示标签
    const stageLabel = makeLabel('⚛️ 散落碱基', '#60cfff', 1.2);
    stageLabel.position.set(0, 4.5, 0);
    container.add(stageLabel);

    // ----- 7. 数据模型 -----
    const TOTAL_BASES = 40; // 总碱基数（20对）
    let bases = []; // 存储每个碱基的 { mesh, letter, targetPos, currentPos, pairIndex }
    let dnaPairs = []; // 配对连接线
    let mRNA = null; // { points: [], mesh }
    let ribosome = null; // 核糖体网格
    let aminoAcids = []; // { mesh, targetPos, currentPos, color }
    let proteinGroup = null;

    // 时间参数
    let elapsed = 0;
    const CYCLE_DURATION = 20; // 总周期20秒

    // ----- 8. 初始化碱基（散落状态） -----
    function initBases() {
        // 清除旧元素
        while(container.children.length > 1) {
            container.remove(container.children[container.children.length-1]);
        }
        // 重新添加标签
        container.add(stageLabel);

        bases = [];
        dnaPairs = [];
        mRNA = null;
        aminoAcids = [];
        proteinGroup = null;

        const half = TOTAL_BASES / 2;
        for (let i = 0; i < TOTAL_BASES; i++) {
            const letter = LETTERS[i % 4];
            const color = BASE_COLORS[letter];
            const sphereMat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.3,
                metalness: 0.1,
                emissive: color,
                emissiveIntensity: 0.2
            });
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), sphereMat);
            sphere.castShadow = true;
            // 散落位置：随机在空间内
            const x = (Math.random() - 0.5) * 12;
            const y = (Math.random() - 0.5) * 6;
            const z = (Math.random() - 0.5) * 6;
            sphere.position.set(x, y, z);
            container.add(sphere);

            // 字母精灵
            const label = makeLabel(letter, '#ffffff', 0.3);
            label.position.set(0, 0.6, 0);
            sphere.add(label);

            // 存储
            bases.push({
                mesh: sphere,
                letter: letter,
                currentPos: new THREE.Vector3(x, y, z),
                targetPos: new THREE.Vector3(0, 0, 0),
                pairIndex: -1
            });
        }

        // 设定配对关系（前一半与后一半配对）
        for (let i = 0; i < half; i++) {
            const idx1 = i;
            const idx2 = i + half;
            bases[idx1].pairIndex = idx2;
            bases[idx2].pairIndex = idx1;
        }
    }

    // ----- 9. 计算DNA组装目标位置（横向双螺旋） -----
    function computeDNAPositions(progress) {
        // progress: 0~1
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

            // 目标位置（线性插值）
            const p1 = new THREE.Vector3(x, y1, z1);
            const p2 = new THREE.Vector3(x, y2, z2);
            bases[idx1].targetPos.copy(p1);
            bases[idx2].targetPos.copy(p2);
        }
    }

    // ----- 10. 创建DNA连接线（氢键） -----
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

    // ----- 11. 更新氢键位置 -----
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

    // ----- 12. 创建mRNA（初始为空） -----
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

    // ----- 13. 更新mRNA（根据进度） -----
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

    // ----- 14. 创建核糖体 -----
    function createRibosome() {
        if (ribosome) {
            container.remove(ribosome);
        }
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x4c1d95, emissiveIntensity: 0.6 });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), mat);
        core.castShadow = true;
        group.add(core);
        // 环绕粒子
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

    // ----- 15. 更新核糖体位置（沿mRNA末端） -----
    function updateRibosome(progress) {
        if (!ribosome || !mRNA || mRNA.points.length < 2) return;
        const idx = Math.min(Math.floor(progress * mRNA.points.length), mRNA.points.length - 1);
        const pos = mRNA.points[idx];
        if (pos) {
            ribosome.position.copy(pos);
        }
    }

    // ----- 16. 氨基酸和蛋白质折叠 -----
    function updateTranslation(progress) {
        // 清除旧氨基酸和蛋白质
        if (proteinGroup) {
            container.remove(proteinGroup);
            proteinGroup = null;
        }
        // 清除旧的氨基酸（单独移除）
        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];
            if (child.userData && child.userData.isAmino) {
                container.remove(child);
            }
        }

        if (!ribosome) return;

        const count = Math.floor(progress * 25);
        const positions = [];
        const colors = [];

        // 先收集氨基酸位置（从核糖体位置延伸，逐渐折叠）
        const basePos = ribosome.position.clone();
        for (let i = 0; i < count; i++) {
            const t = i / Math.max(1, count - 1);
            // 初始方向：向右并略微波动
            let x = basePos.x + 0.5 + i * 0.4;
            let y = basePos.y + Math.sin(i * 1.2 + progress * 2) * 0.5;
            let z = basePos.z + Math.cos(i * 0.9 + progress * 1.5) * 0.5;

            // 折叠：逐渐向球状靠拢
            if (count > 8 && progress > 0.6) {
                const foldProgress = Math.min(1, (progress - 0.6) / 0.4);
                const center = new THREE.Vector3(6, 0, 0);
                const radius = 1.8;
                const angle1 = (i / count) * Math.PI * 2 + progress * 0.5;
                const angle2 = Math.sin(i * 0.7 + progress) * 1.2;
                const targetX = center.x + radius * 0.8 * Math.sin(angle1) * Math.cos(angle2);
                const targetY = center.y + radius * 0.8 * Math.sin(angle2);
                const targetZ = center.z + radius * 0.8 * Math.cos(angle1) * Math.cos(angle2);
                // 插值
                x = x + (targetX - x) * foldProgress * 0.06;
                y = y + (targetY - y) * foldProgress * 0.06;
                z = z + (targetZ - z) * foldProgress * 0.06;
            }

            const color = new THREE.Color().setHSL(0.55 + i * 0.025, 0.8, 0.6);
            positions.push(x, y, z);
            colors.push(color.r, color.g, color.b);

            // 创建小球体
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
        }

        // 如果有足够氨基酸，绘制肽键连线
        if (count > 1) {
            const points = [];
            for (let i = 0; i < count; i++) {
                const idx = i * 3;
                points.push(new THREE.Vector3(positions[idx], positions[idx+1], positions[idx+2]));
            }
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
            const line = new THREE.Line(lineGeo, lineMat);
            line.userData.isAmino = true;
            container.add(line);
        }

        // 蛋白质光晕（折叠后期）
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

    // ----- 17. 主更新函数（每帧） -----
    function updateScene(time) {
        elapsed = time;
        const t = elapsed % CYCLE_DURATION;

        // 确定阶段
        let stage = 0; // 0:散落, 1:组装, 2:解旋转录, 3:翻译, 4:折叠
        let progress = 0;
        if (t < 4) { stage = 0; progress = t / 4; }
        else if (t < 8) { stage = 1; progress = (t - 4) / 4; }
        else if (t < 12) { stage = 2; progress = (t - 8) / 4; }
        else if (t < 16) { stage = 3; progress = (t - 12) / 4; }
        else { stage = 4; progress = (t - 16) / 4; }

        // 更新阶段标签
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
            // 碱基随机运动
            for (let b of bases) {
                b.mesh.position.x += (Math.random() - 0.5) * 0.02;
                b.mesh.position.y += (Math.random() - 0.5) * 0.02;
                b.mesh.position.z += (Math.random() - 0.5) * 0.02;
                // 限制范围
                b.mesh.position.x = Math.max(-6, Math.min(6, b.mesh.position.x));
                b.mesh.position.y = Math.max(-3, Math.min(3, b.mesh.position.y));
                b.mesh.position.z = Math.max(-3, Math.min(3, b.mesh.position.z));
                b.currentPos.copy(b.mesh.position);
            }
            // 删除可能的DNA线
            if (dnaPairs.length > 0) {
                for (let pair of dnaPairs) {
                    container.remove(pair.line);
                }
                dnaPairs = [];
            }
            // 清除mRNA
            if (mRNA) {
                container.remove(mRNA.mesh);
                mRNA = null;
            }
            if (ribosome) {
                container.remove(ribosome);
                ribosome = null;
            }
            // 清除氨基酸
            for (let i = container.children.length - 1; i >= 0; i--) {
                if (container.children[i].userData && container.children[i].userData.isAmino) {
                    container.remove(container.children[i]);
                }
            }
        }

        // ---- 阶段1：组装DNA ----
        if (stage === 1) {
            // 计算目标位置（第一次调用时）
            if (!bases[0].targetPos.x) {
                computeDNAPositions(0);
            }
            computeDNAPositions(progress);
            // 插值移动
            for (let b of bases) {
                b.mesh.position.lerp(b.targetPos, 0.05);
                b.currentPos.copy(b.mesh.position);
            }
            // 创建/更新氢键
            if (dnaPairs.length === 0 && progress > 0.1) {
                createHydrogenBonds();
            } else {
                updateHydrogenBonds();
            }
            // 清除mRNA等
            if (mRNA) { container.remove(mRNA.mesh); mRNA = null; }
            if (ribosome) { container.remove(ribosome); ribosome = null; }
            // 清除氨基酸
            for (let i = container.children.length - 1; i >= 0; i--) {
                if (container.children[i].userData && container.children[i].userData.isAmino) {
                    container.remove(container.children[i]);
                }
            }
        }

        // ---- 阶段2：解旋+转录 ----
        if (stage === 2) {
            // 继续维持DNA结构，但解旋：从中间开始打开
            const half = TOTAL_BASES / 2;
            const openRange = Math.floor(progress * 8);
            const centerIdx = Math.floor(half / 2);
            for (let i = 0; i < half; i++) {
                const idx1 = i;
                const idx2 = i + half;
                const dist = Math.abs(i - centerIdx);
                if (dist <= openRange) {
                    // 打开：向外偏移
                    const factor = (1 - dist / (openRange + 1)) * 0.8 * progress;
                    bases[idx1].targetPos.y += factor * 0.5;
                    bases[idx2].targetPos.y -= factor * 0.5;
                    bases[idx1].targetPos.z += factor * 0.3;
                    bases[idx2].targetPos.z -= factor * 0.3;
                } else {
                    // 恢复原位（原DNA位置）
                    computeDNAPositions(1); // 重新计算完整DNA位置
                }
            }
            // 移动碱基
            for (let b of bases) {
                b.mesh.position.lerp(b.targetPos, 0.05);
                b.currentPos.copy(b.mesh.position);
            }
            updateHydrogenBonds();

            // 转录mRNA
            if (!mRNA) createMRNA();
            updateMRNA(progress);
            // 核糖体尚未出现
            if (ribosome) { container.remove(ribosome); ribosome = null; }
            // 清除氨基酸
            for (let i = container.children.length - 1; i >= 0; i--) {
                if (container.children[i].userData && container.children[i].userData.isAmino) {
                    container.remove(container.children[i]);
                }
            }
        }

        // ---- 阶段3：翻译 ----
        if (stage === 3) {
            // 维持DNA解旋状态，但不更新（冻结）
            // 创建核糖体
            if (!ribosome) createRibosome();
            // 更新mRNA继续延伸
            updateMRNA(1); // 保持全长
            updateRibosome(progress);
            // 翻译产生氨基酸
            updateTranslation(progress);
        }

        // ---- 阶段4：折叠 ----
        if (stage === 4) {
            // 继续翻译但折叠
            if (!ribosome) createRibosome();
            updateMRNA(1);
            updateRibosome(1);
            updateTranslation(0.8 + progress * 0.2); // 折叠进度
        }

        // 旋转星星
        starField.rotation.y += 0.0005;
    }

    // ----- 18. 初始化 -----
    initBases();

    // ----- 19. 动画循环 -----
    let clock = new THREE.Clock();

    function animate() {
        const delta = clock.getDelta();
        const time = clock.elapsedTime;

        updateScene(time);

        // 相机微动
        camera.position.x = 8 + Math.sin(time * 0.02) * 1.5;
        camera.position.y = 5 + Math.sin(time * 0.03) * 0.8;
        camera.lookAt(1, 0, 0);

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();

    // ----- 20. 窗口自适应 -----
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

})();
