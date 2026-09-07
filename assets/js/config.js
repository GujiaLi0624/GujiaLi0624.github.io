/* ============================================================
 * Site Configuration Center —— ALL content is edited here.
 * No other code needs to be touched.
 *
 * How to add a new module:
 *   1. Create assets/js/modules/xxx.js and register a renderer
 *      via window.registerModule('xxx', fn);
 *   2. Add <script src="...modules/xxx.js"> to index.html;
 *   3. Add an entry { type:'xxx', ... } to the modules array below.
 * ============================================================ */
window.SITE_CONFIG = {

  /* ---------- Basic site info ---------- */
  site: {
    title: 'Gujia LI | Personal Website',
    author: 'Gujia LI',
    motto: 'Time punishes everyone who fails to record!',
    footer: '© 2026 Gujia LI · Powered by GitHub Pages',
    // Navigation bar (anchor matches the module id in the modules array)
    nav: [
      { label: 'Home',     anchor: 'home' },
      { label: 'About',    anchor: 'about' },
      { label: 'Research', anchor: 'research' },
      { label: 'Timeline', anchor: 'timeline' },
    ],
  },

  /* ---------- Hero (overview) section ---------- */
  hero: {
    // Avatar (local image under assets/img/)
    avatar: 'assets/img/avatar.jpg',
    name: 'Gujia LI',
    tagline: '🏫 NJMU | ⚕️ Medical Laboratory Technology',
    // Contact line shown under the tagline (aletolia-style)
    contact: {
      email: 'ligujiai@163.com',
    },
    // Typewriter carousel (English only)
    typing: [
      'Time punishes everyone who fails to record!',
    ],
    socials: [
      { icon: 'GitHub', label: 'GitHub', url: 'https://github.com/GujiaLi0624' },
      { icon: 'Email',  label: 'Email',  url: 'mailto:ligujiai@163.com' },
    ],
    // Scroll hint at the bottom of the hero
    scrollHint: 'Scroll down to explore ↓',
  },

  /* ---------- DNA base-pair effect (can be turned off) ---------- */
  dnaEffect: {
    enabled: true,
    xRatio: 0.72,        // Horizontal position of the helix axis (0~1 of page width)
    amp: 95,             // Helix radius (px) — half width of the projected double helix
    twistLen: 260,       // Axial length of one full twist (px)
    rotSpeed: 0.45,      // Helix rotation speed (rad/s)
    rungGap: 48,         // Vertical spacing between base pairs (px)
    missingRatio: 0.4,   // Initial ratio of missing bases
    repairRadius: 130,   // Mouse proximity (px) that triggers base repair
    attractRadius: 170,  // Radius within which floating bases are attracted to the cursor
    particleCount: 0,    // Number of floating bases; 0 = auto by screen width
  },

  /* ---------- Content modules (order = page order, enabled toggles visibility) ---------- */
  modules: [
    {
      type: 'about',
      id: 'about',
      title: 'About Me',
      icon: '🧬',
      enabled: true,
      data: {
        text: [
          'Hi, I am Gujia LI, an undergraduate student majoring in Medical Laboratory Technology at Nanjing Medical University (NJMU).',
          'This website serves as a personal space to record my study notes, research interests and small projects.',
          'Time punishes everyone who fails to record! — so I write things down here.',
        ],
        image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20bioinformatics%20laboratory%20at%20night%2C%20glowing%20screens%20with%20DNA%20sequences%2C%20dark%20ambiance%2C%20blue%20neon%20light%2C%20cinematic&image_size=landscape_4_3',
        tags: ['NJMU', 'Medical Laboratory Technology', 'GitHub'],
      },
    },
    {
      type: 'cards',
      id: 'research',
      title: 'Research',
      icon: '🔬',
      enabled: true,
      columns: 3,
      // Add your own research topics here, e.g.:
      // data: [ { title: '...', desc: '...', image: '...', link: '#', tags: ['...'] } ]
      data: [],
    },
    {
      type: 'timeline',
      id: 'timeline',
      title: 'Timeline',
      icon: '📅',
      enabled: true,
      data: [
        { year: '2026', title: 'Personal website launched', desc: 'Built a modular personal homepage with HTML/CSS/JS.' },
      ],
    },
  ],
};
