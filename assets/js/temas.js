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
        { id: 'kids',    nombre: 'Peques',        sub: '5 a 10 años',          emo: '🦄', sw: 'linear-gradient(135deg,#ffb3d1,#ffd88a 35%,#a6f0be 68%,#a5d8ff)', meta: '#fff7d6' }
    ];
    var LEMAS = { betis: 'Forever Green', sevilla: 'Live in Red', cookie: '🍪 Nice Cookie 🧁', kids: '🎈 ¡A jugar! 🎈' };
    var CLUB = { betis: 'betis', sevilla: 'sevilla' };
    var DECO = {
        cloud:  { tipo: 'nube', e: ['☁️'], n: 6 },
        green:  { tipo: 'flota', e: ['🍃', '🌿', '🍀'], n: 12 },
        cookie: { tipo: 'flota', e: ['🍪', '🧁', '🍰', '🍩', '🍓', '🍒'], n: 14 },
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
            var s = document.createElement('div'); s.className = 'tema-escudo tema-escudo--hero';
            cab.insertBefore(lema, cab.firstChild); cab.insertBefore(s, cab.firstChild); slots.push(s);
        }
        var tit = document.getElementById('welcomeTitle');
        if (tit && tit.parentElement) {
            var w = document.createElement('div'); w.className = 'tema-escudo tema-escudo--bienvenida';
            tit.parentElement.insertBefore(w, tit.parentElement.firstChild); slots.push(w);
        }
        var pie = document.querySelector('footer');
        if (pie) { var f = document.createElement('div'); f.className = 'tema-escudo tema-escudo--pie'; pie.insertBefore(f, pie.firstChild); slots.push(f); }
        deco = document.createElement('div'); deco.id = 'tema-deco'; deco.setAttribute('aria-hidden', 'true'); document.body.appendChild(deco);
    }
    function pintarDeco(id) {
        if (!deco) return;
        deco.innerHTML = '';
        var club = CLUB[id], cfg = DECO[id];
        if (club) { var m = document.createElement('div'); m.className = 'marca'; m.innerHTML = htmlEscudo(club); deco.appendChild(m); }
        if (!cfg) return;
        for (var i = 0; i < cfg.n; i++) {
            var el = document.createElement('span'), e = cfg.e[i % cfg.e.length];
            el.textContent = e;
            if (cfg.tipo === 'nube') {
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
        slots.forEach(function (s) { s.innerHTML = club ? htmlEscudo(club) : ''; });
        if (lema) lema.textContent = LEMAS[id] || '';
    }
    function aplicar(id, guardar) {
        if (!TEMAS.some(function (t) { return t.id === id; })) id = 'luxury';
        var t = TEMAS.filter(function (x) { return x.id === id; })[0];
        document.documentElement.setAttribute('data-theme', id);
        var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', t.meta);
        if (guardar) { try { localStorage.setItem(CLAVE, id); } catch (e) { /* sin almacenamiento */ } }
        pintarEscudos(id); pintarDeco(id);
        if (CLUB[id] && !(CLUB[id] in oficial)) sondear(CLUB[id], function () { if (document.documentElement.getAttribute('data-theme') === id) { pintarEscudos(id); pintarDeco(id); } });
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
        panel.innerHTML = h + '</div>';
        document.body.appendChild(panel); document.body.appendChild(btn);
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
