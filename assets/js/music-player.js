/* ============================================================
 * Music player widget — a small icon next to "Home" in the nav
 * with a dropdown panel for play/pause, mute, volume, track select.
 *
 * Config: window.SITE_CONFIG.music
 *   tracks: [ { title, src }, ... ]
 *   autoplay: bool (browsers block autoplay with sound)
 *   loop: bool
 *   defaultVolume: 0~1
 *
 * To add more songs: drop files into assets/music/ and add
 * entries to SITE_CONFIG.music.tracks.
 * ============================================================ */
(function () {
  'use strict';
  const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.music) || {};
  if (cfg.enabled === false) return;

  const tracks = cfg.tracks || [];
  if (!tracks.length) return;

  /* ---------- audio element (must be in DOM for some browsers) ---------- */
  const audio = document.createElement('audio');
  audio.volume = cfg.defaultVolume ?? 0.4;
  audio.loop = (cfg.loop ?? true) && tracks.length === 1;
  audio.setAttribute('preload', 'none');
  audio.style.display = 'none';
  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(audio);
  });
  if (document.body) document.body.appendChild(audio);
  let currentIdx = 0;
  let isPlaying = false;
  let isMuted = false;
  let prevVolume = audio.volume;

  function loadTrack(idx) {
    currentIdx = (idx + tracks.length) % tracks.length;
    audio.setAttribute('src', tracks[currentIdx].src);
    audio.load();
    updateLabel();
  }

  function play() {
    audio.play().then(function () {
      isPlaying = true;
      updateIcon();
      updateLabel();
    }).catch(function (e) {
      console.warn('[music] play blocked:', e.message);
      isPlaying = false;
      updateIcon();
    });
  }

  function pause() {
    audio.pause();
    isPlaying = false;
    updateIcon();
  }

  function togglePlay() {
    if (isPlaying) pause();
    else play();
  }

  function toggleMute() {
    if (isMuted) {
      audio.volume = prevVolume || 0.4;
      isMuted = false;
    } else {
      prevVolume = audio.volume;
      audio.volume = 0;
      isMuted = true;
    }
    updateIcon();
    if (volSlider) volSlider.value = audio.volume;
  }

  function next() {
    loadTrack(currentIdx + 1);
    play();
  }

  function prev() {
    loadTrack(currentIdx - 1);
    play();
  }

  audio.addEventListener('ended', function () {
    if ((cfg.loop ?? true) && tracks.length > 1) next();
  });

  /* ---------- build UI ---------- */
  // Icon button next to the nav logo (rendered after nav is built)
  let btn, panel, label, iconSpan, volSlider, trackList;

  function buildUI() {
    btn = document.createElement('button');
    btn.className = 'music-btn';
    btn.setAttribute('aria-label', 'Music player');
    btn.innerHTML = '<span class="music-icon">🎵</span>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    panel = document.createElement('div');
    panel.className = 'music-panel';
    panel.innerHTML =
      '<div class="mp-now"><span class="mp-icon"></span><span class="mp-label">—</span></div>' +
      '<div class="mp-controls">' +
      '  <button class="mp-prev"  title="Previous">⏮</button>' +
      '  <button class="mp-play"  title="Play/Pause">▶</button>' +
      '  <button class="mp-next"  title="Next">⏭</button>' +
      '  <button class="mp-mute"  title="Mute">🔊</button>' +
      '</div>' +
      '<div class="mp-volume">' +
      '  <input type="range" class="mp-vol" min="0" max="1" step="0.01" value="' + audio.volume + '">' +
      '</div>' +
      '<div class="mp-tracks"></div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // Cache elements
    iconSpan = btn.querySelector('.music-icon');
    label = panel.querySelector('.mp-label');
    volSlider = panel.querySelector('.mp-vol');
    trackList = panel.querySelector('.mp-tracks');

    // Build track list
    tracks.forEach(function (t, i) {
      const item = document.createElement('div');
      item.className = 'mp-track';
      item.textContent = t.title;
      item.addEventListener('click', function () {
        loadTrack(i);
        play();
      });
      trackList.appendChild(item);
    });

    // Wire controls
    panel.querySelector('.mp-prev').addEventListener('click', prev);
    panel.querySelector('.mp-next').addEventListener('click', next);
    panel.querySelector('.mp-mute').addEventListener('click', toggleMute);
    volSlider.addEventListener('input', function () {
      audio.volume = parseFloat(volSlider.value);
      isMuted = audio.volume === 0;
      updateIcon();
    });

    // Close panel when clicking elsewhere
    document.addEventListener('click', function (e) {
      if (!btn.contains(e.target) && !panel.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    // Autoplay on first user interaction (browsers block autoplay
    // even with sound until the user interacts with the page).
    // This also "unlocks" the audio element so subsequent play()
    // calls work without issues.
    let unlocked = false;
    const startOnInteract = function () {
      if (unlocked) return;
      unlocked = true;
      document.removeEventListener('click', startOnInteract);
      document.removeEventListener('keydown', startOnInteract);
      document.removeEventListener('pointerdown', startOnInteract);
      // Don't auto-play; just mark as unlocked so play button works
      // play() will be called when user clicks the play button
    };
    document.addEventListener('click', startOnInteract);
    document.addEventListener('keydown', startOnInteract);
    document.addEventListener('pointerdown', startOnInteract);

    // Make the play button a reliable toggle: always call
    // audio.play() / audio.pause() directly on click.
    panel.querySelector('.mp-play').addEventListener('click', function (e) {
      e.stopPropagation();
      if (audio.paused) {
        play();
      } else {
        pause();
      }
    });

    loadTrack(0);
    updateIcon();
  }

  function updateIcon() {
    if (iconSpan) {
      if (isPlaying) { iconSpan.textContent = '🎶'; iconSpan.classList.add('playing'); }
      else if (isMuted) { iconSpan.textContent = '🔇'; iconSpan.classList.remove('playing'); }
      else { iconSpan.textContent = '🎵'; iconSpan.classList.remove('playing'); }
    }
    const playBtn = panel && panel.querySelector('.mp-play');
    if (playBtn) playBtn.textContent = isPlaying ? '⏸' : '▶';
    const muteBtn = panel && panel.querySelector('.mp-mute');
    if (muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔊';

    // Highlight current track
    if (trackList) {
      Array.prototype.forEach.call(trackList.children, function (el, i) {
        el.classList.toggle('active', i === currentIdx);
      });
    }
  }

  function updateLabel() {
    if (label) label.textContent = tracks[currentIdx] ? tracks[currentIdx].title : '—';
  }

  // Initialize after DOM is ready and nav has been built by main.js
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Wait for nav to render
      setTimeout(buildUI, 50);
    });
  } else {
    setTimeout(buildUI, 50);
  }
})();
