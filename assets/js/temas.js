/* Estilos personalizables (luxury, dark, cloud, green, forever green, live in red, nice cookie, peques).
   Cada persona elige el suyo en su dispositivo; se guarda en localStorage. Enlace directo: ?tema=kids */
(function () {
    'use strict';
    var CLAVE = 'vane_tema';
    var TEMAS = [
        { id: 'luxury',  nombre: 'Luxury',        sub: 'Oro y noche',          emo: '👑', sw: 'linear-gradient(135deg,#0b0f19,#1e293b 55%,#fbbf24)', meta: '#0b0f19' },
        { id: 'dark',    nombre: 'Dark',          sub: 'Negro y violeta',      emo: '🌑', sw: 'linear-gradient(135deg,#09090b,#27272a 55%,#818cf8)', meta: '#09090b' },
        { id: 'cloud',   nombre: 'Cloud',         sub: 'Cielo y nubes',        emo: '☁️', sw: 'linear-gradient(135deg,#cfe8ff,#ffffff 55%,#38bdf8)', meta: '#eef6ff' },
        { id: 'green',   nombre: 'Green',         sub: 'Bosque esmeralda',     emo: '🌿', sw: 'linear-gradient(135deg,#03120c,#064e3b 55%,#34d399)', meta: '#03120c' },
        { id: 'betis',   nombre: 'Forever Green', sub: 'Verde y blanco',       emo: '💚', sw: 'linear-gradient(90deg,#0a8a4c 0 33%,#fff 33% 50%,#0a8a4c 50% 66%,#fff 66% 83%,#0a8a4c 83%)', meta: '#002c18' },
        { id: 'sevilla', nombre: 'Live in Red',   sub: 'Rojo y blanco',        emo: '❤️', sw: 'linear-gradient(135deg,#0e0406,#b00a22 55%,#ffffff)', meta: '#0e0406' },
        { id: 'cookie',  nombre: 'Nice Cookie',   sub: 'Repostería dulce',     emo: '🍪', sw: 'linear-gradient(135deg,#fde7cf,#f9a8d4 55%,#92400e)', meta: '#fef7ed' },
        { id: 'magic',   nombre: 'Magic Castle', sub: 'Castillo y orejas',    emo: '🏰', sw: 'linear-gradient(135deg,#0a0f32,#2f43a8 60%,#facc15)', meta: '#0a0f32' },
        { id: 'kids',    nombre: 'Peques',        sub: '5 a 10 años',          emo: '🦄', sw: 'linear-gradient(135deg,#ffb3d1,#ffd88a 35%,#a6f0be 68%,#a5d8ff)', meta: '#fff7d6' }
    ];
    var LEMAS = { magic: '✨ Magic Castle ✨', betis: 'Forever Green', sevilla: 'Live in Red', cookie: '🍪 Nice Cookie 🧁', kids: '🎈 ¡A jugar! 🎈' };
    var CLUB = { betis: 'betis', sevilla: 'sevilla' };
    var DECO = {
        cloud:  { tipo: 'nube', e: ['☁️'], n: 6 },
        green:  { tipo: 'flota', e: ['🍃', '🌿', '🍀'], n: 12 },
        cookie: { tipo: 'flota', e: ['🍪', '🧁', '🍰', '🍩', '🍓', '🍒'], n: 14 },
        magic:  { tipo: 'brilla', e: ['✨', '⭐', '🌟', '✨'], n: 26 },
        kids:   { tipo: 'flota', e: ['⭐', '🎈', '🦄', '🌈', '🚀', '🍭', '🦖', '🎨'], n: 16 }
    };
    var uid = 0;

    /* ---- Escudos: aproximaciones estilizadas (no oficiales). Para usar los oficiales, ver assets/escudos/LEEME.txt ---- */
    function corona(c) {
        return '<g fill="#e8b923" stroke="#8a6a00" stroke-width="1" stroke-linejoin="round">' +
            '<path d="M27 26 L29 9 L40 18 L50 5 L60 18 L71 9 L73 26 Z"/><rect x="26" y="25" width="48" height="7" rx="2"/>' +
            '<circle cx="29" cy="8" r="3"/><circle cx="50" cy="4" r="3"/><circle cx="71" cy="8" r="3"/></g>' +
            '<circle cx="40" cy="28.5" r="1.8" fill="' + c + '"/><circle cx="50" cy="28.5" r="1.8" fill="' + c + '"/><circle cx="60" cy="28.5" r="1.8" fill="' + c + '"/>';
    }
    function svgBetis() {
        var id = 'cb' + (++uid), d = 'M14 36 H86 V74 C86 100 66 114 50 122 C34 114 14 100 14 74 Z';
        var franjas = '';
        for (var i = 0; i < 5; i++) franjas += '<rect x="' + (14 + i * 14.4) + '" y="30" width="14.4" height="100" fill="' + (i % 2 ? '#ffffff' : '#0bb363') + '"/>';
        return '<svg viewBox="0 0 100 126" role="img" aria-label="Escudo estilizado inspirado en el Real Betis Balompié" xmlns="http://www.w3.org/2000/svg">' +
            corona('#0bb363') + '<defs><clipPath id="' + id + '"><path d="' + d + '"/></clipPath></defs>' +
            '<g clip-path="url(#' + id + ')">' + franjas + '<rect x="14" y="60" width="72" height="22" fill="#fff"/>' +
            '<rect x="14" y="60" width="72" height="2.5" fill="#0bb363"/><rect x="14" y="79.5" width="72" height="2.5" fill="#0bb363"/></g>' +
            '<text x="50" y="77.5" text-anchor="middle" font-family="Lora,Georgia,serif" font-weight="800" font-size="17" letter-spacing="2" fill="#067a42">RBB</text>' +
            '<path d="' + d + '" fill="none" stroke="#e8b923" stroke-width="3"/><path d="' + d + '" fill="none" stroke="#064e2b" stroke-width="1" transform="translate(0 0)"/></svg>';
    }
    function svgSevilla() {
        var d1 = 'M16 36 H84 V70 C84 98 64 112 50 121 C36 112 16 98 16 70 Z', d2 = 'M23 43 H77 V69 C77 91 61 103 50 110 C39 103 23 91 23 69 Z';
        return '<svg viewBox="0 0 100 126" role="img" aria-label="Escudo estilizado inspirado en el Sevilla FC" xmlns="http://www.w3.org/2000/svg">' +
            corona('#d4021d') + '<path d="' + d1 + '" fill="#d4021d" stroke="#1a1a1a" stroke-width="1.2"/>' +
            '<path d="' + d2 + '" fill="#ffffff" stroke="#1a1a1a" stroke-width=".8"/>' +
            '<text x="50" y="84" text-anchor="middle" font-family="Lora,Georgia,serif" font-weight="800" font-size="25" letter-spacing="-1" fill="#d4021d" stroke="#d4021d" stroke-width=".8">SFC</text>' +
            '<path d="M30 92 Q50 100 70 92" fill="none" stroke="#d4021d" stroke-width="1.6" stroke-linecap="round"/></svg>';
    }
    /* Castillo de cuento y orejas de ratón: dibujos genéricos propios (no son logos oficiales) */
    function svgCastillo() {
        if (oficial.castillo) return '<img src="' + oficial.castillo + '" alt="Castillo">';
        var torre = function (x, w, y, h, ry, col) {
            return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (130 - y) + '" fill="#e6ebff" stroke="#8fa5e8" stroke-width="1"/>' +
                '<polygon points="' + (x - 4) + ',' + y + ' ' + (x + w + 4) + ',' + y + ' ' + (x + w / 2) + ',' + ry + '" fill="' + col + '" stroke="#1e3a8a" stroke-width="1"/>' +
                '<path d="M' + (x + w / 2 - 3) + ' ' + (y + 22) + 'v8a3 3 0 0 0 6 0v-8a3 3 0 0 0 -6 0z" fill="#facc15"/>';
        };
        return '<svg viewBox="0 -6 200 140" role="img" aria-label="Castillo de cuento" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="20" y="100" width="160" height="30" fill="#e6ebff" stroke="#8fa5e8"/>' +
            torre(12, 22, 84, 0, 62, '#3b6fe0') + torre(166, 22, 84, 0, 62, '#3b6fe0') +
            torre(38, 28, 66, 0, 34, '#2f5bd0') + torre(134, 28, 66, 0, 34, '#2f5bd0') +
            torre(80, 40, 50, 0, 8, '#1d4ed8') +
            '<path d="M100 8V-2" stroke="#8a6a00" stroke-width="1.5"/><polygon points="100,-2 112,2 100,6" fill="#facc15" transform="translate(0 2)"/>' +
            '<path d="M92 130V114a8 8 0 0 1 16 0V130Z" fill="#1e2a6b" stroke="#facc15" stroke-width="1"/>' +
            '<g fill="#facc15"><circle cx="100" cy="30" r="1.5"/><circle cx="53" cy="55" r="1.2"/><circle cx="147" cy="55" r="1.2"/></g></svg>';
    }
    function svgOrejas() {
        if (oficial.orejas) return '<img src="' + oficial.orejas + '" alt="Orejas">';
        return '<svg viewBox="0 0 120 92" role="img" aria-label="Orejas de ratón" xmlns="http://www.w3.org/2000/svg">' +
            '<g fill="#111" stroke="#facc15" stroke-width="2.5"><circle cx="26" cy="26" r="21"/><circle cx="94" cy="26" r="21"/><circle cx="60" cy="58" r="30"/></g>' +
            '<ellipse cx="50" cy="45" rx="9" ry="5" fill="#fff" opacity=".12" transform="rotate(-30 50 45)"/></svg>';
    }
    function escudo(club) { return club === 'betis' ? svgBetis() : svgSevilla(); }
    /* Si existe assets/escudos/<club>.svg|png (oficial puesto por ti) se usa en lugar del dibujo */
    var oficial = {};
    function sondear(club, fin) {
        if (club in oficial) { fin(); return; }
        var exts = ['svg', 'png'], i = 0;
        (function probar() {
            if (i >= exts.length) { oficial[club] = null; fin(); return; }
            var url = 'assets/escudos/' + club + '.' + exts[i++], im = new Image();
            im.onload = function () { oficial[club] = url; fin(); };
            im.onerror = probar;
            im.src = url;
        })();
    }
    function htmlEscudo(club) {
        return oficial[club] ? '<img src="' + oficial[club] + '" alt="Escudo">' : escudo(club);
    }

    /* ---- DOM ---- */
    var slots = [], lema = null, deco = null, btn = null, panel = null;
    function crearSlots() {
        var cab = document.querySelector('header .relative.mx-auto');
        if (cab) {
            lema = document.createElement('div'); lema.className = 'tema-lema';
            var s = document.createElement('div'); s.className = 'tema-escudo tema-escudo--hero'; s.dataset.slot = 'hero';
            cab.insertBefore(lema, cab.firstChild); cab.insertBefore(s, cab.firstChild); slots.push(s);
        }
        var tit = document.getElementById('welcomeTitle');
        if (tit && tit.parentElement) {
            var w = document.createElement('div'); w.className = 'tema-escudo tema-escudo--bienvenida'; w.dataset.slot = 'bienvenida';
            tit.parentElement.insertBefore(w, tit.parentElement.firstChild); slots.push(w);
        }
        var pie = document.querySelector('footer');
        if (pie) { var f = document.createElement('div'); f.className = 'tema-escudo tema-escudo--pie'; f.dataset.slot = 'pie'; pie.insertBefore(f, pie.firstChild); slots.push(f); }
        deco = document.createElement('div'); deco.id = 'tema-deco'; deco.setAttribute('aria-hidden', 'true'); document.body.appendChild(deco);
    }
    function pintarDeco(id) {
        if (!deco) return;
        deco.innerHTML = '';
        var club = CLUB[id], cfg = DECO[id];
        if (club) { var m = document.createElement('div'); m.className = 'marca'; m.innerHTML = htmlEscudo(club); deco.appendChild(m); }
        if (id === 'magic') { var cs = document.createElement('div'); cs.className = 'marca marca--castillo'; cs.innerHTML = svgCastillo(); deco.appendChild(cs); }
        if (!cfg) return;
        for (var i = 0; i < cfg.n; i++) {
            var el = document.createElement('span'), e = cfg.e[i % cfg.e.length];
            el.textContent = e;
            if (cfg.tipo === 'brilla') {
                el.className = 'brilla'; el.style.left = (Math.random() * 96) + '%'; el.style.top = (Math.random() * 80) + '%'; el.style.fontSize = (.7 + Math.random() * 1.1) + 'rem';
                el.style.animationDuration = (2.5 + Math.random() * 4) + 's'; el.style.animationDelay = (-Math.random() * 6) + 's';
            } else if (cfg.tipo === 'nube') {
                el.className = 'nube'; el.style.top = (4 + Math.random() * 55) + '%'; el.style.fontSize = (3 + Math.random() * 4) + 'rem';
                el.style.animationDuration = (70 + Math.random() * 70) + 's'; el.style.animationDelay = (-Math.random() * 120) + 's';
            } else {
                el.className = 'flota'; el.style.left = (Math.random() * 96) + '%'; el.style.fontSize = (1.2 + Math.random() * 1.8) + 'rem';
                el.style.animationDuration = (14 + Math.random() * 16) + 's'; el.style.animationDelay = (-Math.random() * 28) + 's';
                el.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
            }
            deco.appendChild(el);
        }
    }
    function pintarEscudos(id) {
        var club = CLUB[id];
        slots.forEach(function (s) {
            s.innerHTML = club ? htmlEscudo(club) : (id === 'magic' ? (s.dataset.slot === 'hero' ? svgCastillo() : svgOrejas()) : '');
        });
        if (lema) lema.textContent = LEMAS[id] || '';
    }

    /* ---- Musica ambiente por estilo: assets/musica/<tema>.mp3 (o .m4a/.ogg). Apagada por defecto; cada persona la activa en su movil ---- */
    var EXT = ['mp3', 'm4a', 'ogg'];
    var M = { on: false, vol: 0.25, audio: null, estado: '', pausada: false };
    try { M.on = localStorage.getItem('vane_musica') === '1'; var v = parseFloat(localStorage.getItem('vane_musica_vol')); if (v >= 0 && v <= 1) M.vol = v; } catch (e) { /* sin almacenamiento */ }
    function fundir(a, a_vol, fin) {
        var paso = (a_vol - a.volume) / 16, n = 0;
        var iv = setInterval(function () {
            n++; a.volume = Math.max(0, Math.min(1, a.volume + paso));
            if (n >= 16) { clearInterval(iv); a.volume = Math.max(0, Math.min(1, a_vol)); if (fin) fin(); }
        }, 50);
    }
    function detener() {
        var a = M.audio; M.audio = null; M.pausada = false;
        if (a) fundir(a, 0, function () { a.pause(); a.removeAttribute('src'); a.load(); });
    }
    function sonar(id) {
        detener(); M.estado = '';
        if (!M.on) { pintarMus(); return; }
        var a = new Audio(), i = 0; a.loop = true; a.volume = 0; a.preload = 'auto'; M.audio = a;
        function sig() {
            if (M.audio !== a) return;
            if (i >= EXT.length) { M.estado = 'falta'; pintarMus(); return; }
            a.src = 'assets/musica/' + id + '.' + EXT[i++]; a.load(); jugar();
        }
        function jugar() {
            var p = a.play();
            if (p && p.catch) p.catch(function (e) { if (e && e.name === 'NotAllowedError' && M.audio === a) { M.estado = 'bloqueado'; pintarMus(); } });
        }
        a.addEventListener('error', sig);
        a.addEventListener('playing', function () { if (M.audio === a) { M.estado = 'ok'; pintarMus(); fundir(a, M.vol); } });
        sig();
    }
    function visible(el) { return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; }
    /* La musica se calla mientras se ve un video o un efecto a pantalla completa, y vuelve despues */
    setInterval(function () {
        if (!M.on || !M.audio) return;
        var ocupado = visible(document.getElementById('mediaModal')) || !!document.querySelector('[class*="z-[90]"]');
        if (ocupado && !M.audio.paused) { M.audio.pause(); M.pausada = true; }
        else if (!ocupado && M.pausada) { M.pausada = false; var p = M.audio.play(); if (p && p.catch) p.catch(function () {}); }
    }, 700);
    /* Si el navegador bloqueo el autoplay, el primer toque en la pagina arranca la musica */
    document.addEventListener('pointerdown', function () {
        if (M.on && M.audio && M.audio.paused && !M.pausada) { var p = M.audio.play(); if (p && p.catch) p.catch(function () {}); }
    });
    function pintarMus() {
        if (!panel) return;
        var b = panel.querySelector('.mus-btn'), m = panel.querySelector('.mus-msg'), id = document.documentElement.getAttribute('data-theme') || 'luxury';
        b.setAttribute('aria-pressed', M.on ? 'true' : 'false'); b.textContent = M.on ? '🎵 Música: encendida' : '🎵 Música: apagada';
        m.textContent = !M.on ? '' : M.estado === 'falta' ? 'Aún no hay música para este estilo.' : M.estado === 'bloqueado' ? 'Pulsa otra vez para activar el sonido.' : '';
    }
    function aplicar(id, guardar) {
        if (!TEMAS.some(function (t) { return t.id === id; })) id = 'luxury';
        var t = TEMAS.filter(function (x) { return x.id === id; })[0];
        document.documentElement.setAttribute('data-theme', id);
        var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', t.meta);
        if (guardar) { try { localStorage.setItem(CLAVE, id); } catch (e) { /* sin almacenamiento */ } }
        pintarEscudos(id); pintarDeco(id);
        if (M.on) sonar(id); else pintarMus();
        var claves = CLUB[id] ? [CLUB[id]] : (id === 'magic' ? ['castillo', 'orejas'] : []);
        claves.forEach(function (k) {
            if (!(k in oficial)) sondear(k, function () { if (document.documentElement.getAttribute('data-theme') === id) { pintarEscudos(id); pintarDeco(id); } });
        });
        if (panel) panel.querySelectorAll('.op').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false'); });
    }
    function crearSelector() {
        btn = document.createElement('button'); btn.id = 'tema-btn'; btn.type = 'button';
        btn.setAttribute('aria-label', 'Cambiar estilo de la página'); btn.setAttribute('aria-expanded', 'false'); btn.title = 'Estilo de la página';
        btn.innerHTML = '<i class="fa-solid fa-palette" aria-hidden="true"></i>';
        panel = document.createElement('div'); panel.id = 'tema-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Elegir estilo');
        var h = '<div class="cab"><h2>Elige tu estilo</h2><button class="cerrar" type="button" aria-label="Cerrar">✕</button></div><div class="rejilla">';
        TEMAS.forEach(function (t) {
            h += '<button class="op" type="button" data-id="' + t.id + '" aria-pressed="false"><span class="muestra" style="background:' + t.sw + '">' + t.emo + '</span>' +
                 '<span class="nom">' + t.nombre + '</span><span class="sub">' + t.sub + '</span></button>';
        });
        panel.innerHTML = h + '</div><div class="musica"><button class="mus-btn" type="button" aria-pressed="false">🎵 Música: apagada</button>' +
            '<input class="mus-vol" type="range" min="0" max="100" value="' + Math.round(M.vol * 100) + '" aria-label="Volumen de la música"><p class="mus-msg" role="status"></p></div>';
        document.body.appendChild(panel); document.body.appendChild(btn);
        panel.querySelector('.mus-btn').addEventListener('click', function () {
            M.on = !M.on; try { localStorage.setItem('vane_musica', M.on ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
            if (M.on) sonar(document.documentElement.getAttribute('data-theme') || 'luxury'); else { detener(); M.estado = ''; pintarMus(); }
        });
        panel.querySelector('.mus-vol').addEventListener('input', function (e) {
            M.vol = e.target.value / 100; try { localStorage.setItem('vane_musica_vol', String(M.vol)); } catch (er) { /* sin almacenamiento */ }
            if (M.audio) M.audio.volume = M.vol;
        });
        function abrir(v) { panel.hidden = !v; btn.setAttribute('aria-expanded', v ? 'true' : 'false'); }
        btn.addEventListener('click', function () { abrir(panel.hidden); });
        panel.querySelector('.cerrar').addEventListener('click', function () { abrir(false); btn.focus(); });
        panel.addEventListener('click', function (e) { var b = e.target.closest('.op'); if (b) aplicar(b.dataset.id, true); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) abrir(false); });
        document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) abrir(false); });
    }
    function iniciar() {
        crearSlots(); crearSelector();
        aplicar(document.documentElement.getAttribute('data-theme') || 'luxury', false);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
