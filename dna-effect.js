// ============================================================
// dna-process.js – 中心法则动态演示 (Canvas 2D)
// 阶段：散落碱基 → 组装DNA → 解旋转录 → 翻译 → 蛋白质折叠
// ============================================================

(function() {
    // ----- 画布设置 -----
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none'; // 允许点击穿透
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // ----- 参数配置 -----
    const COLORS = {
        A: '#ff6b6b',
        T: '#4ecdc4',
        G: '#ffe66d',
        C: '#a29bfe',
        mRNA: '#fd79a8',
        protein: '#a78bfa'
    };

    // ----- 工具函数 -----
    function rand(min, max) { return Math.random() * (max - min) + min; }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function dist(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    // ----- 状态管理 -----
    const TOTAL_TIME = 20; // 一个完整周期秒数
    let elapsed = 0;
    let lastTimestamp = 0;
    let animationId = null;

    // ----- 碱基粒子 -----
    const BASE_COUNT = 60; // 总碱基数 (每条链30个)
    let bases = [];
    let dnaPairs = []; // 存储配对信息 {base1, base2, midX, midY}
    let mRNA = null; // {points: [{x,y}], progress}
    let ribosome = null; // {x, y, progress}
    let aminoAcids = []; // [{x, y, color, index}]
    let protein = null; // {points, foldProgress}

    // ----- 初始化碱基（散落状态） -----
    function initBases() {
        bases = [];
        const letters = ['A', 'T', 'G', 'C'];
        for (let i = 0; i < BASE_COUNT; i++) {
            const base = letters[i % 4];
            bases.push({
                base: base,
                x: rand(50, W - 50),
                y: rand(50, H - 50),
                targetX: 0,
                targetY: 0,
                vx: rand(-0.5, 0.5),
                vy: rand(-0.5, 0.5),
                radius: 10,
                color: COLORS[base],
                paired: false,
                pairIndex: -1
            });
        }
        // 随机打乱位置，使散落更自然
        for (let i = bases.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bases[i].x, bases[j].x] = [bases[j].x, bases[i].x];
            [bases[i].y, bases[j].y] = [bases[j].y, bases[i].y];
        }
    }

    // ----- 计算DNA目标位置（横向双链） -----
    function computeDNATargets(progress) {
        // progress: 0~1 组装进度
        const chainY1 = H * 0.4;
        const chainY2 = H * 0.6;
        const startX = W * 0.15;
        const endX = W * 0.85;
        const spacing = (endX - startX) / (BASE_COUNT / 2 - 1);

        // 碱基配对：前一半是链1，后一半是链2
        const half = Math.floor(BASE_COUNT / 2);
        for (let i = 0; i < half; i++) {
            const idx1 = i;
            const idx2 = i + half;
            const x = startX + i * spacing;
            const y1 = chainY1;
            const y2 = chainY2;
            // 每个碱基的目标位置
            bases[idx1].targetX = x;
            bases[idx1].targetY = y1;
            bases[idx2].targetX = x;
            bases[idx2].targetY = y2;
            // 记录配对
            bases[idx1].pairIndex = idx2;
            bases[idx2].pairIndex = idx1;
        }
        // 应用进度（位置插值）
        const t = Math.min(progress, 1);
        for (let b of bases) {
            if (b.targetX !== undefined) {
                b.x = lerp(b.x, b.targetX, t * 0.03);
                b.y = lerp(b.y, b.targetY, t * 0.03);
            }
        }
    }

    // ----- 重置所有状态 -----
    function reset() {
        elapsed = 0;
        initBases();
        // 清空DNA配对记录
        dnaPairs = [];
        mRNA = null;
        ribosome = null;
        aminoAcids = [];
        protein = null;
        // 随机速度
        for (let b of bases) {
            b.vx = rand(-0.3, 0.3);
            b.vy = rand(-0.3, 0.3);
        }
    }

    // ----- 更新阶段逻辑 -----
    function update(deltaTime) {
        elapsed += deltaTime;
        const t = elapsed; // 秒

        // ---- 阶段0: 散落 (0-4s) ----
        if (t < 4) {
            for (let b of bases) {
                b.x += b.vx;
                b.y += b.vy;
                // 边界反弹
                if (b.x < 10 || b.x > W - 10) b.vx *= -0.9;
                if (b.y < 10 || b.y > H - 10) b.vy *= -0.9;
                // 限制范围
                b.x = Math.max(10, Math.min(W - 10, b.x));
                b.y = Math.max(10, Math.min(H - 10, b.y));
            }
            return;
        }

        // ---- 阶段1: 组装DNA (4-8s) ----
        if (t >= 4 && t < 8) {
            const progress = (t - 4) / 4; // 0~1
            // 计算目标位置（第一次调用时初始化）
            if (!bases[0].targetX) {
                computeDNATargets(0);
            }
            computeDNATargets(progress);
            // 绘制配对信息（用于后续画线）
            if (dnaPairs.length === 0) {
                const half = Math.floor(BASE_COUNT / 2);
                for (let i = 0; i < half; i++) {
                    dnaPairs.push({
                        idx1: i,
                        idx2: i + half
                    });
                }
            }
            return;
        }

        // ---- 阶段2: 解旋 & 转录 (8-12s) ----
        if (t >= 8 && t < 12) {
            const progress = (t - 8) / 4;
            // 解旋：从中间开始打开，形成一个“泡”
            const centerIdx = Math.floor(BASE_COUNT / 4);
            const openRange = Math.floor(progress * 12); // 打开碱基对数量
            const half = Math.floor(BASE_COUNT / 2);
            // 更新碱基位置：打开的碱基向外偏移
            for (let i = 0; i < half; i++) {
                const idx1 = i;
                const idx2 = i + half;
                const distFromCenter = Math.abs(i - centerIdx);
                if (distFromCenter <= openRange) {
                    // 打开：链1向上，链2向下
                    const offset = (1 - distFromCenter / openRange) * 30 * progress;
                    bases[idx1].targetY = bases[idx1].targetY - offset;
                    bases[idx2].targetY = bases[idx2].targetY + offset;
                    // 稍微横向移动
                    bases[idx1].targetX = bases[idx1].targetX - 5 * progress;
                    bases[idx2].targetX = bases[idx2].targetX + 5 * progress;
                } else {
                    // 未打开恢复原位
                    bases[idx1].targetY = H * 0.4;
                    bases[idx2].targetY = H * 0.6;
                }
            }
            // 缓慢移动过去
            for (let b of bases) {
                if (b.targetX !== undefined) {
                    b.x += (b.targetX - b.x) * 0.05;
                    b.y += (b.targetY - b.y) * 0.05;
                }
            }

            // 转录mRNA：从解旋中心开始延伸
            if (!mRNA) {
                mRNA = { points: [], progress: 0, x: 0, y: 0 };
            }
            mRNA.progress = progress;
            // mRNA起点：解旋中心偏右
            const startX = W * 0.4 + progress * 150;
            const startY = H * 0.5 + 20;
            mRNA.x = startX;
            mRNA.y = startY;
            // 添加点形成尾巴
            const tailLen = Math.floor(20 + progress * 60);
            for (let i = 0; i < tailLen; i++) {
                const px = startX + i * 4;
                const py = startY + Math.sin(i * 0.3 + progress * 2) * 8;
                mRNA.points.push({ x: px, y: py });
            }
            return;
        }

        // ---- 阶段3: 翻译 (12-16s) ----
        if (t >= 12 && t < 16) {
            const progress = (t - 12) / 4;
            // 核糖体在mRNA上移动
            if (!ribosome) {
                ribosome = { x: 0, y: 0, progress: 0 };
            }
            ribosome.progress = progress;
            // 假设mRNA点存在
            if (mRNA && mRNA.points.length > 10) {
                const idx = Math.floor(progress * (mRNA.points.length - 10));
                const p = mRNA.points[Math.min(idx, mRNA.points.length - 1)];
                if (p) {
                    ribosome.x = p.x;
                    ribosome.y = p.y;
                }
            }

            // 添加氨基酸（每0.5秒一个）
            const aaCount = Math.floor(progress * 8);
            while (aminoAcids.length < aaCount && aminoAcids.length < 20) {
                const idx = aminoAcids.length;
                const angle = idx * 0.8;
                const color = `hsl(${200 + idx * 20}, 70%, 60%)`;
                const x = ribosome.x + 20 + idx * 6;
                const y = ribosome.y - 30 + Math.sin(angle) * 10;
                aminoAcids.push({ x, y, color, index: idx, targetX: x, targetY: y });
            }
            // 氨基酸链逐渐拉直并形成肽链
            for (let i = 0; i < aminoAcids.length; i++) {
                const aa = aminoAcids[i];
                const baseX = ribosome.x + 20 + i * 6;
                const baseY = ribosome.y - 30 + Math.sin(i * 0.8) * 10;
                aa.x += (baseX - aa.x) * 0.05;
                aa.y += (baseY - aa.y) * 0.05;
            }
            return;
        }

        // ---- 阶段4: 蛋白质折叠 (16-20s) ----
        if (t >= 16 && t < 20) {
            const progress = (t - 16) / 4;
            // 将氨基酸链折叠成球状蛋白
            const centerX = W * 0.7;
            const centerY = H * 0.5;
            const radius = 60 + 30 * Math.sin(progress * 3.14);
            // 每个氨基酸向球面移动
            const count = aminoAcids.length;
            for (let i = 0; i < count; i++) {
                const aa = aminoAcids[i];
                const angle1 = (i / count) * 2 * Math.PI;
                const angle2 = Math.sin(i * 0.5) * 1.5;
                const targetX = centerX + radius * 0.6 * Math.sin(angle1) * Math.cos(angle2);
                const targetY = centerY + radius * 0.6 * Math.sin(angle2);
                // 加入一些随机偏移模拟四级结构
                const offset = 10 * Math.sin(progress * 10 + i);
                aa.x += (targetX + offset - aa.x) * 0.04;
                aa.y += (targetY + offset - aa.y) * 0.04;
            }
            // 保存蛋白质数据
            if (!protein) {
                protein = { foldProgress: 0 };
            }
            protein.foldProgress = progress;
            return;
        }

        // ---- 结束后重置 ----
        if (t >= TOTAL_TIME) {
            reset();
        }
    }

    // ----- 绘图函数 -----
    function draw() {
        ctx.clearRect(0, 0, W, H);

        // 绘制背景渐变（深空）
        const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.7);
        grad.addColorStop(0, '#141b2d');
        grad.addColorStop(1, '#070a12');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        const t = elapsed;

        // ---- 1. 绘制所有碱基 ----
        for (let b of bases) {
            // 发光效果
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius * 0.8, 0, 2 * Math.PI);
            ctx.fillStyle = b.color;
            ctx.fill();
            // 字母
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.base, b.x, b.y - 1);
        }

        // ---- 2. 绘制DNA配对连接线（当有配对时） ----
        if (dnaPairs.length > 0 && t >= 4 && t < 12) {
            const half = Math.floor(BASE_COUNT / 2);
            for (let pair of dnaPairs) {
                const b1 = bases[pair.idx1];
                const b2 = bases[pair.idx2];
                if (b1 && b2) {
                    ctx.beginPath();
                    ctx.moveTo(b1.x, b1.y);
                    ctx.lineTo(b2.x, b2.y);
                    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#a78bfa';
                    ctx.stroke();
                }
            }
        }

        // ---- 3. 绘制mRNA ----
        if (mRNA && mRNA.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(mRNA.points[0].x, mRNA.points[0].y);
            for (let i = 1; i < mRNA.points.length; i++) {
                ctx.lineTo(mRNA.points[i].x, mRNA.points[i].y);
            }
            ctx.strokeStyle = COLORS.mRNA;
            ctx.lineWidth = 4;
            ctx.shadowBlur = 20;
            ctx.shadowColor = COLORS.mRNA;
            ctx.stroke();
            // mRNA上的小圈
            for (let i = 0; i < mRNA.points.length; i+=3) {
                const p = mRNA.points[i];
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, 2*Math.PI);
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 10;
                ctx.fill();
            }
        }

        // ---- 4. 绘制核糖体 ----
        if (ribosome) {
            ctx.shadowBlur = 40;
            ctx.shadowColor = '#a78bfa';
            ctx.beginPath();
            ctx.arc(ribosome.x, ribosome.y, 16, 0, 2*Math.PI);
            ctx.fillStyle = '#7c3aed';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('R', ribosome.x, ribosome.y);
        }

        // ---- 5. 绘制氨基酸链 ----
        for (let i = 0; i < aminoAcids.length; i++) {
            const aa = aminoAcids[i];
            ctx.shadowBlur = 15;
            ctx.shadowColor = aa.color;
            ctx.beginPath();
            ctx.arc(aa.x, aa.y, 8, 0, 2*Math.PI);
            ctx.fillStyle = aa.color;
            ctx.fill();
            // 小字母
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = '8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('aa', aa.x, aa.y);
        }

        // 连接氨基酸的肽键
        if (aminoAcids.length > 1) {
            ctx.beginPath();
            ctx.moveTo(aminoAcids[0].x, aminoAcids[0].y);
            for (let i = 1; i < aminoAcids.length; i++) {
                ctx.lineTo(aminoAcids[i].x, aminoAcids[i].y);
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#fff';
            ctx.stroke();
        }

        // ---- 6. 绘制最终蛋白质（如果折叠阶段） ----
        if (t >= 16 && protein) {
            // 绘制一个发光的蛋白质外壳（由氨基酸聚合成的球）
            const centerX = W * 0.7;
            const centerY = H * 0.5;
            const radius = 70 + 20 * Math.sin(protein.foldProgress * 3.14);
            ctx.shadowBlur = 60;
            ctx.shadowColor = COLORS.protein;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2*Math.PI);
            const grad2 = ctx.createRadialGradient(centerX-20, centerY-20, 10, centerX, centerY, radius);
            grad2.addColorStop(0, 'rgba(167, 139, 250, 0.3)');
            grad2.addColorStop(1, 'rgba(167, 139, 250, 0.05)');
            ctx.fillStyle = grad2;
            ctx.fill();
            ctx.strokeStyle = 'rgba(167, 139, 250, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // 标注
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🧬 功能蛋白', centerX, centerY - 40);
        }

        // ---- 7. 阶段提示（调试用，可删除） ----
        // 显示当前阶段文字（可选）
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        let stage = '';
        if (t < 4) stage = '◆ 散落碱基';
        else if (t < 8) stage = '◆ 组装DNA';
        else if (t < 12) stage = '◆ 转录mRNA';
        else if (t < 16) stage = '◆ 翻译 → 肽链';
        else if (t < 20) stage = '◆ 蛋白质折叠';
        ctx.fillText(stage, 20, H - 20);
    }

    // ----- 动画循环 -----
    function loop(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
        lastTimestamp = timestamp;

        update(delta);
        draw();
        animationId = requestAnimationFrame(loop);
    }

    // ----- 启动 -----
    reset();
    loop(0);

    // ----- 窗口变化重置部分状态（可选） -----
    window.addEventListener('resize', () => {
        resize();
        // 重新计算目标位置（如果处于组装阶段）
        if (elapsed >= 4 && elapsed < 8) {
            computeDNATargets((elapsed - 4) / 4);
        }
    });

})();
