/* ============================================================================
   EFECTOS DE FOTOS PARA "EL JUEGO DE SU MEMORIA"
   - Fuegos artificiales de fotos  (tipo 'fotos-fuegos')
   - Nave espacial entre meteoritos y fotos (tipo 'fotos-nave')
   - Teatro del castillo de cuento (tipo 'fotos-castillo') y Bingo de recuerdos (tipo 'fotos-bingo')

   Clave de la sincronización: cada efecto es una FUNCIÓN PURA DEL TIEMPO.
   dibujar(ctx, w, h, t) pinta exactamente el mismo fotograma lógico en cualquier
   dispositivo para el mismo t (semilla fija, sin estado entre fotogramas). Así el
   "reproductor virtual" (crearPlayer) se comporta como un <video>: tiene
   currentTime, play(), pause(), duration, ended... y la lógica de sincronía de la
   web (cuenta atrás, latido del administrador, corrección de desfase) funciona igual.
   ============================================================================ */
(function (global) {
    'use strict';

    var TAU = Math.PI * 2;
    var MAX_FOTOS = 120;
    var EXT = /\.(jpe?g|png|webp|gif|avif|bmp)(\?.*)?$/i;

    /* ------------------------------ utilidades ------------------------------ */
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerp(a, b, k) { return a + (b - a) * k; }
    function suave(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function salidaCubica(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
    function hash(str) {
        var h = 1779033703 ^ str.length;
        for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
        h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^ (h >>> 16)) >>> 0;
    }
    function rngDe(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function barajar(n, rnd) {
        var a = [], i, j, x;
        for (i = 0; i < n; i++) a.push(i);
        for (i = n - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); x = a[i]; a[i] = a[j]; a[j] = x; }
        return a;
    }
    /* Ajustes editables por efecto (llegan en opc.ajustes; vacío = valor por defecto) */
    function ajNum(A, k, def, min, max) {
        var v = A && A[k]; if (v == null || v === '') return def;
        v = Number(v); if (!isFinite(v)) return def;
        return clamp(Math.round(v), min, max);
    }
    function ajTxt(A, k, def, max) {
        var v = A && A[k]; if (typeof v !== 'string') return def;
        v = v.trim(); return v ? v.slice(0, max || 40) : def;
    }
    var FOTO_K = 1;                                   // escala global de las polaroids (ajuste «Tamaño de las fotos»)
    function ahoraMs() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

    /* Foto de la lista; si aún no se ha decodificado, se usa otra ya disponible (arranque parcial) */
    function fotoDe(imgs, idx) {
        var im = imgs[idx];
        if (im) return im;
        for (var i = 0; i < imgs.length; i++) { var o = imgs[(idx + i) % imgs.length]; if (o) return o; }
        return null;
    }

    /* Marco tipo polaroid con halo de color. La foto se muestra COMPLETA (sin recortar). */
    function pintarFoto(ctx, img, x, y, S, rot, alpha, hue, brillo, zs, idx) {
        if (alpha <= 0.003) return;
        S *= FOTO_K;
        var iw = img ? img.width : 4, ih = img ? img.height : 3;
        var k = Math.min(S / iw, S / ih), dw = iw * k, dh = ih * k;
        var b = S * 0.05, base = S * 0.07;
        var fw = dw + 2 * b, fh = dh + 2 * b + base;
        if (zs && alpha > 0.5) zs.push({ i: idx, x: x, y: y, w: fw, h: fh, rot: rot });
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.globalAlpha = clamp(alpha, 0, 1);
        if (brillo !== 0) { ctx.shadowColor = 'hsla(' + hue + ',100%,66%,0.9)'; ctx.shadowBlur = S * (brillo || 0.2); }
        ctx.fillStyle = '#fdfdfd';
        ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
        if (img) ctx.drawImage(img, -dw / 2, -fh / 2 + b, dw, dh);
        else { ctx.fillStyle = '#1e293b'; ctx.fillRect(-dw / 2, -fh / 2 + b, dw, dh); }
        ctx.restore();
    }

    function crearEstrellas(rnd, n) {
        var e = [];
        for (var i = 0; i < n; i++) e.push({ x: rnd(), y: rnd(), r: 0.4 + rnd() * 1.3, f: 0.5 + rnd() * 2.2, ph: rnd() * TAU });
        return e;
    }

    /* ======================================================================
       EFECTO 1: FUEGOS ARTIFICIALES DE FOTOS
       Cada cohete sube y estalla en 4 fotos GRANDES que vuelan hasta su sitio,
       se quedan ~4 s flotando y se desvanecen. Cada foto se ve entera.
       ====================================================================== */
    function crearFuegos(imgs, seed) {
        var N = Math.max(1, imgs.length);
        var rnd = rngDe(seed), orden = barajar(N, rnd);
        var P = 4, INT = 3.9, T0 = 1.4, VUELO = 1.15, VUELA = 0.85, HOLD = 4.2, VIDA = 5.0;
        var K = Math.max(1, Math.ceil(N / P)), bursts = [], estrellas = crearEstrellas(rnd, 90);
        var k, j, i;
        for (k = 0; k < K; k++) {
            var fotos = [], ch = [];
            var cnt = Math.min(P, N - k * P);
            for (j = 0; j < cnt; j++) {
                fotos.push({
                    idx: orden[k * P + j],
                    ang: (j / cnt) * TAU + Math.PI / 4 + (k % 2) * 0.3 + (rnd() - 0.5) * 0.3,
                    rad: 0.92 + rnd() * 0.16, rot: (rnd() - 0.5) * 0.3,
                    hue: Math.floor(rnd() * 360), ph: rnd() * TAU, delay: j * 0.07
                });
            }
            for (i = 0; i < 46; i++) ch.push({ ang: rnd() * TAU, v: 0.35 + rnd() * 0.95, vida: 0.9 + rnd() * 0.9, r: 1 + rnd() * 1.8, hue: 0 });
            var hueB = Math.floor(rnd() * 360);
            for (i = 0; i < ch.length; i++) ch[i].hue = (hueB + (rnd() - 0.5) * 70 + 360) % 360;
            bursts.push({ L: T0 + k * INT, B: T0 + k * INT + VUELO, side: k % 2, jx: rnd() - 0.5, jy: rnd() - 0.5, xl: 0.2 + rnd() * 0.6, hue: hueB, fotos: fotos, ch: ch });
        }
        var duracion = bursts[K - 1].B + VIDA + 0.8;
        var sonidos = [];
        bursts.forEach(function (b) { sonidos.push({ t: b.L, tipo: 'lanzar' }, { t: b.B, tipo: 'estallar' }); });

        var zonas = [];
        function tam(w, h) { return (w <= h * 1.15) ? Math.min(w * 0.40, h * 0.30) : Math.min(h * 0.46, w * 0.20); }
        function centro(b, w, h) {
            var S = tam(w, h), ext = S * 0.66 * 1.08 * 0.78 + S * 0.62, c;
            if (w <= h * 1.15) c = { x: w * (0.5 + b.jx * 0.08), y: h * (b.side ? 0.30 : 0.69) + b.jy * h * 0.03 };
            else c = { x: w * (b.side ? 0.27 : 0.73) + b.jx * w * 0.03, y: h * 0.5 + b.jy * h * 0.05 };
            if (w > 2 * ext) c.x = clamp(c.x, ext, w - ext);
            if (h > 2 * ext) c.y = clamp(c.y, ext, h - ext);
            return c;
        }

        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            // Fondo nocturno
            var g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#04040c'); g.addColorStop(0.6, '#0a0a1e'); g.addColorStop(1, '#140a24');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            var s, a;
            for (s = 0; s < estrellas.length; s++) {
                var e = estrellas[s];
                a = 0.35 + 0.35 * Math.sin(t * e.f + e.ph);
                ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
                ctx.fillRect(e.x * w, e.y * h, e.r, e.r);
            }
            var S = tam(w, h), rho = S * 0.66;
            var kmin = Math.max(0, Math.floor((t - VIDA - VUELO - T0) / INT));
            var kmax = Math.min(K - 1, Math.floor((t - T0) / INT));
            for (k = kmin; k <= kmax; k++) {
                var b = bursts[k], c = centro(b, w, h), col = 'hsl(' + b.hue + ',100%,68%)';
                if (t < b.L) continue;
                if (t < b.B) {                                  // cohete subiendo
                    var u = (t - b.L) / VUELO, ex = Math.pow(u, 0.75);
                    var x0 = w * b.xl, y0 = h + 12;
                    ctx.save(); ctx.globalCompositeOperation = 'lighter';
                    for (i = 9; i >= 0; i--) {
                        var uu = Math.max(0, u - i * 0.028), ee = Math.pow(uu, 0.75);
                        var px = lerp(x0, c.x, ee), py = lerp(y0, c.y, ee);
                        ctx.fillStyle = 'hsla(' + b.hue + ',100%,70%,' + ((1 - i / 10) * 0.55).toFixed(3) + ')';
                        ctx.beginPath(); ctx.arc(px, py, Math.max(1, S * 0.022 * (1 - i / 12)), 0, TAU); ctx.fill();
                    }
                    ctx.restore();
                    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lerp(x0, c.x, ex), lerp(y0, c.y, ex), S * 0.03, 0, TAU); ctx.fill();
                    continue;
                }
                var ag = t - b.B;
                // Destello
                if (ag < 0.35) {
                    var fa = 1 - ag / 0.35, gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, S * 1.6 * (0.4 + ag * 2));
                    gr.addColorStop(0, 'hsla(' + b.hue + ',100%,85%,' + (0.7 * fa).toFixed(3) + ')'); gr.addColorStop(1, 'hsla(' + b.hue + ',100%,60%,0)');
                    ctx.fillStyle = gr; ctx.fillRect(c.x - S * 2, c.y - S * 2, S * 4, S * 4);
                }
                // Chispas (movimiento en forma cerrada: no dependen del fotograma anterior)
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (s = 0; s < b.ch.length; s++) {
                    var sp = b.ch[s];
                    if (ag > sp.vida) continue;
                    var dist = sp.v * S * 2.6 * (1 - Math.exp(-2.4 * ag)) / 2.4 * 2.4;
                    var sx = c.x + Math.cos(sp.ang) * dist, sy = c.y + Math.sin(sp.ang) * dist + 0.5 * S * 0.8 * ag * ag;
                    a = 1 - ag / sp.vida;
                    ctx.fillStyle = 'hsla(' + sp.hue + ',100%,68%,' + (a * 0.9).toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(sx, sy, sp.r * (S / 120 + 0.6), 0, TAU); ctx.fill();
                }
                ctx.restore();
                // Fotos
                for (j = 0; j < b.fotos.length; j++) {
                    var f = b.fotos[j], af = ag - f.delay;
                    if (af < 0 || (af > VIDA && k < K - 1)) continue;
                    var vu = salidaCubica(af / VUELA);
                    var px2 = c.x + Math.cos(f.ang) * rho * f.rad * vu + Math.sin(af * 0.9 + f.ph) * S * 0.025;
                    var py2 = c.y + Math.sin(f.ang) * rho * f.rad * vu + Math.cos(af * 0.7 + f.ph) * S * 0.03;
                    var esc = (0.35 + 0.65 * vu) * (1 + 0.022 * Math.sin(af * 2.1 + f.ph));
                    var al = Math.min(1, af / 0.22), rot = f.rot + (1 - vu) * 0.9 * (j % 2 ? 1 : -1) + Math.sin(af * 0.8 + f.ph) * 0.035;
                    if (af > HOLD && k < K - 1) {
                        var o = (af - HOLD) / (VIDA - HOLD);
                        al *= 1 - o; py2 += o * o * S * 0.35; esc *= 1 + o * 0.08;
                    }
                    pintarFoto(ctx, fotoDe(imgs, f.idx), px2, py2, S * esc, rot, al, f.hue, 0.22, zonas, f.idx);
                }
            }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: sonidos, musica: null, zonas: zonas };
    }

    /* ======================================================================
       EFECTO 2: NAVE ESPACIAL
       La nave viaja hacia el fondo esquivando meteoritos; las fotos son
       "cuerpos celestes" con anillo que sobrevuelan los costados de la nave.
       ====================================================================== */
    function crearNave(imgs, seed) {
        var N = Math.max(1, imgs.length);
        var rnd = rngDe(seed), orden = barajar(N, rnd);
        var ZS = 3, ZF = 62, VM = 15, PINT = 3.4, PT0 = 4.2, RANGO = 0.6;
        var duracion = PT0 + (N - 1) * PINT + 5.4;
        var i, j;

        function forma() { var f = []; for (var q = 0; q < 12; q++) f.push(0.74 + rnd() * 0.34); return f; }
        function crateres() { var c = []; for (var q = 0; q < 3; q++) c.push({ a: rnd() * TAU, d: rnd() * 0.45, r: 0.1 + rnd() * 0.14 }); return c; }

        // Meteoritos "de colisión": la nave los esquiva
        var met = [], tt = 3.2;
        while (tt < duracion - 1) {
            met.push({ T: tt, u: (rnd() * 2 - 1) * 0.82, r: 0.17 + rnd() * 0.12, dv: (rnd() - 0.5) * 0.34, rot0: rnd() * TAU, vrot: (rnd() - 0.5) * 2.2, forma: forma(), cr: crateres(), deco: false });
            tt += 0.85 + rnd() * 0.6;
        }
        // Meteoritos decorativos (pasan por encima o por debajo)
        var deco = [], nd = Math.floor(duracion * 1.6);
        for (i = 0; i < nd; i++) {
            var su = rnd() < 0.5 ? -1 : 1, sv = rnd() < 0.5 ? -1 : 1;
            deco.push({ T: 1.5 + rnd() * (duracion - 2), u: su * (0.3 + rnd() * 1.3), r: 0.1 + rnd() * 0.16, dv: sv * (0.65 + rnd() * 0.9), rot0: rnd() * TAU, vrot: (rnd() - 0.5) * 3, forma: forma(), cr: crateres(), deco: true });
        }
        // Fotos-cuerpo celeste
        var fotos = [];
        for (j = 0; j < N; j++) {
            var lado = (j % 2) ? 1 : -1;
            fotos.push({ Tp: PT0 + j * PINT, u: lado * (0.62 + rnd() * 0.18), dv: -(0.95 + rnd() * 0.35), Ru: 0.42, hue: Math.floor(rnd() * 360), idx: orden[j], ph: rnd() * TAU, rot: (rnd() - 0.5) * 0.22 });
        }
        // Trayectoria de la nave: posiciones seguras en el instante en que cada meteorito la cruza
        var claves = [{ T: 0, x: 0 }], prev = 0;
        for (i = 0; i < met.length; i++) {
            var m = met[i], need = m.r + 0.17, nx;
            if (Math.abs(prev - m.u) >= need) {
                nx = clamp(prev + (rnd() - 0.5) * 0.25, -RANGO, RANGO);
                if (Math.abs(nx - m.u) < need) nx = prev;
            } else {
                var a1 = m.u - need, b1 = m.u + need, cand = [];
                if (a1 >= -RANGO) cand.push(a1);
                if (b1 <= RANGO) cand.push(b1);
                if (!cand.length) cand.push(clamp(m.u > 0 ? a1 : b1, -RANGO, RANGO));
                nx = cand.length === 1 ? cand[0] : (Math.abs(cand[0] - prev) <= Math.abs(cand[1] - prev) ? cand[0] : cand[1]);
            }
            claves.push({ T: m.T, x: nx }); prev = nx;
        }
        function naveX(t) {
            var n = claves.length;
            if (t <= claves[0].T) return claves[0].x;
            if (t >= claves[n - 1].T) return claves[n - 1].x;
            var lo = 0, hi = n - 1;
            while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (claves[mid].T <= t) lo = mid; else hi = mid; }
            return lerp(claves[lo].x, claves[hi].x, suave((t - claves[lo].T) / (claves[hi].T - claves[lo].T)));
        }
        var estrellas = []; for (i = 0; i < 230; i++) estrellas.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, z0: rnd() * 30, h: Math.floor(200 + rnd() * 60) });

        function zFoto(tau) {
            if (tau <= -2.4) { var x = clamp((-2.4 - tau) / 4.6, 0, 1.6); return 4.6 + (ZF * 0.7 - 4.6) * x * x; }
            return 4.6 - (tau + 2.4) / 6.0 * 3.4;
        }

        function pintarMeteorito(ctx, sx, sy, R, m, t, alpha) {
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(m.rot0 + m.vrot * t); ctx.globalAlpha = alpha;
            ctx.beginPath();
            for (var q = 0; q < 12; q++) { var an = q / 12 * TAU, r = R * m.forma[q]; if (q === 0) ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); else ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
            ctx.closePath();
            var gr = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R * 1.1);
            gr.addColorStop(0, '#b5a89c'); gr.addColorStop(0.55, '#6e625a'); gr.addColorStop(1, '#2b2522');
            ctx.fillStyle = gr; ctx.fill();
            ctx.lineWidth = Math.max(1, R * 0.06); ctx.strokeStyle = 'rgba(255,190,120,0.35)'; ctx.stroke();
            ctx.fillStyle = 'rgba(30,24,22,0.45)';
            for (var c = 0; c < m.cr.length; c++) { var cc = m.cr[c]; ctx.beginPath(); ctx.arc(Math.cos(cc.a) * cc.d * R, Math.sin(cc.a) * cc.d * R, cc.r * R, 0, TAU); ctx.fill(); }
            ctx.restore();
        }

        function pintarNaveEspacial(ctx, x, y, s, roll, t) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(roll);
            var fl = 0.85 + 0.25 * Math.sin(t * 47) + 0.12 * Math.sin(t * 23);
            ctx.globalCompositeOperation = 'lighter';
            [-0.3, 0.3].forEach(function (ox) {
                var g = ctx.createRadialGradient(ox * s, 0.28 * s, 0, ox * s, 0.28 * s, s * 0.55 * fl);
                g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, 'rgba(120,220,255,0.75)'); g.addColorStop(1, 'rgba(40,120,255,0)');
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox * s, 0.28 * s, s * 0.55 * fl, 0, TAU); ctx.fill();
            });
            ctx.globalCompositeOperation = 'source-over';
            // alas y fuselaje (vista desde atrás)
            var cuerpo = ctx.createLinearGradient(0, -s, 0, 0.6 * s);
            cuerpo.addColorStop(0, '#e8eeff'); cuerpo.addColorStop(1, '#4b5c8f');
            ctx.fillStyle = cuerpo; ctx.strokeStyle = 'rgba(210,225,255,0.8)'; ctx.lineWidth = Math.max(1, s * 0.035);
            ctx.beginPath();
            ctx.moveTo(0, -0.95 * s); ctx.lineTo(0.2 * s, -0.15 * s); ctx.lineTo(0.98 * s, 0.42 * s); ctx.lineTo(0.72 * s, 0.6 * s);
            ctx.lineTo(0.3 * s, 0.46 * s); ctx.lineTo(0, 0.62 * s); ctx.lineTo(-0.3 * s, 0.46 * s); ctx.lineTo(-0.72 * s, 0.6 * s);
            ctx.lineTo(-0.98 * s, 0.42 * s); ctx.lineTo(-0.2 * s, -0.15 * s); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(30,40,80,0.55)';
            ctx.beginPath(); ctx.moveTo(0, -0.7 * s); ctx.lineTo(0.06 * s, 0.35 * s); ctx.lineTo(-0.06 * s, 0.35 * s); ctx.closePath(); ctx.fill();
            var cab = ctx.createRadialGradient(0, -0.3 * s, 0, 0, -0.3 * s, 0.26 * s);
            cab.addColorStop(0, '#d9fbff'); cab.addColorStop(1, '#2a8fd0');
            ctx.fillStyle = cab; ctx.beginPath(); ctx.ellipse(0, -0.3 * s, 0.13 * s, 0.22 * s, 0, 0, TAU); ctx.fill();
            var par = (Math.sin(t * 6) > 0);
            ctx.fillStyle = par ? '#ff4d4d' : '#7a1f1f'; ctx.beginPath(); ctx.arc(-0.9 * s, 0.42 * s, s * 0.05, 0, TAU); ctx.fill();
            ctx.fillStyle = par ? '#1f6b3a' : '#4dff88'; ctx.beginPath(); ctx.arc(0.9 * s, 0.42 * s, s * 0.05, 0, TAU); ctx.fill();
            ctx.restore();
        }

        var zonas = [];
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            var D = Math.min(w, h * 0.9), Lx = 0.45 * w, Ly = 0.45 * D, vx = w / 2, vy = h * 0.40, shipY = h * 0.76;
            var vS = (shipY - vy) / Ly, uShip = naveX(t), camU = uShip * 0.55, k, q;
            // Fondo: nebulosas
            ctx.fillStyle = '#03030a'; ctx.fillRect(0, 0, w, h);
            var n1 = ctx.createRadialGradient(w * (0.3 + 0.08 * Math.sin(t * 0.13)), h * 0.35, 0, w * 0.3, h * 0.35, Math.max(w, h) * 0.75);
            n1.addColorStop(0, 'hsla(' + (265 + 25 * Math.sin(t * 0.07)) + ',70%,28%,0.55)'); n1.addColorStop(1, 'rgba(3,3,10,0)');
            ctx.fillStyle = n1; ctx.fillRect(0, 0, w, h);
            var n2 = ctx.createRadialGradient(w * 0.8, h * (0.55 + 0.05 * Math.cos(t * 0.11)), 0, w * 0.8, h * 0.55, Math.max(w, h) * 0.6);
            n2.addColorStop(0, 'hsla(' + (205 + 20 * Math.cos(t * 0.09)) + ',80%,26%,0.45)'); n2.addColorStop(1, 'rgba(3,3,10,0)');
            ctx.fillStyle = n2; ctx.fillRect(0, 0, w, h);
            // Estrellas en movimiento (rayitas de velocidad)
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (q = 0; q < estrellas.length; q++) {
                var st = estrellas[q], z = (((st.z0 - 9 * t) % 30) + 30) % 30 + 0.7, zp = z + 0.45;
                var x1 = vx + (st.x - camU * 0.2) * w * 0.55 / z, y1 = vy + st.y * h * 0.62 / z;
                var x2 = vx + (st.x - camU * 0.2) * w * 0.55 / zp, y2 = vy + st.y * h * 0.62 / zp;
                if (x1 < -20 || x1 > w + 20 || y1 < -20 || y1 > h + 20) continue;
                ctx.strokeStyle = 'hsla(' + st.h + ',80%,85%,' + clamp(1.1 / z, 0.08, 0.95).toFixed(3) + ')';
                ctx.lineWidth = clamp(1.6 / z + 0.4, 0.5, 2.2);
                ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y1); ctx.stroke();
            }
            ctx.restore();

            // Objetos visibles, ordenados de lejos a cerca
            var obj = [], lista = met.concat(deco), o, tau, Z;
            for (q = 0; q < lista.length; q++) {
                o = lista[q]; tau = t - o.T; Z = ZS + VM * (-tau);
                if (Z > 0.35 && Z < ZF) obj.push({ tipo: 'm', o: o, Z: Z });
            }
            for (q = 0; q < fotos.length; q++) {
                o = fotos[q]; tau = t - o.Tp;
                if (q === fotos.length - 1) tau = Math.min(tau, -0.2);          // la última foto se queda a la vista
                if (tau < -7.5 || tau > 3.6) continue;
                obj.push({ tipo: 'f', o: o, Z: zFoto(tau), tau: tau });
            }
            obj.sort(function (a, b) { return b.Z - a.Z; });
            var navePintada = false, sNave = Math.max(14, D * 0.105);
            var nx = vx + (uShip - camU) * Lx;
            var roll = clamp((naveX(t + 0.06) - naveX(t - 0.06)) / 0.12 * 0.42, -0.5, 0.5);
            for (q = 0; q < obj.length; q++) {
                var it = obj[q];
                if (!navePintada && it.Z <= ZS) { pintarNaveEspacial(ctx, nx, shipY + Math.sin(t * 2.3) * D * 0.006, sNave, roll, t); navePintada = true; }
                var kk = ZS / it.Z;
                if (it.tipo === 'm') {
                    var mm = it.o, sx = vx + (mm.u - camU) * Lx * kk, sy = vy + (vS + mm.dv) * Ly * kk;
                    var R = mm.r * 0.45 * D * kk, al = clamp((ZF - it.Z) / 14, 0, 1) * (mm.deco ? 0.8 : 1);
                    if (sx < -R * 2 || sx > w + R * 2 || sy < -R * 2 || sy > h + R * 2) continue;
                    pintarMeteorito(ctx, sx, sy, R, mm, t, al);
                } else {
                    var ff = it.o, fx = vx + (ff.u - camU) * Lx * kk, fy = vy + (vS + ff.dv) * Ly * kk;
                    var Sf = ff.Ru * 2 * 0.45 * D * kk, alf = clamp((46 - it.Z) / 12, 0, 1);
                    if (fx < -Sf || fx > w + Sf || fy < -Sf || fy > h + Sf) continue;
                    // anillo orbital + brillo
                    ctx.save(); ctx.translate(fx, fy); ctx.rotate(ff.rot * 2 + Math.sin(t * 0.4 + ff.ph) * 0.1); ctx.globalAlpha = alf * 0.65;
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.strokeStyle = 'hsla(' + ff.hue + ',100%,70%,0.8)'; ctx.lineWidth = Math.max(1, Sf * 0.022);
                    ctx.beginPath(); ctx.ellipse(0, 0, Sf * 0.95, Sf * 0.3, -0.35, 0, TAU); ctx.stroke();
                    var lun = t * 0.9 + ff.ph;
                    ctx.fillStyle = '#fff'; ctx.beginPath();
                    var lx = Math.cos(lun) * Sf * 0.95, ly = Math.sin(lun) * Sf * 0.3, ca = Math.cos(-0.35), sa = Math.sin(-0.35);
                    ctx.arc(lx * ca - ly * sa, lx * sa + ly * ca, Math.max(1.5, Sf * 0.035), 0, TAU); ctx.fill();
                    ctx.restore();
                    pintarFoto(ctx, fotoDe(imgs, ff.idx), fx, fy, Sf, ff.rot + Math.sin(t * 0.5 + ff.ph) * 0.05, alf, ff.hue, 0.24, zonas, ff.idx);
                }
            }
            if (!navePintada) pintarNaveEspacial(ctx, nx, shipY + Math.sin(t * 2.3) * D * 0.006, sNave, roll, t);
        }
        var ev = []; met.forEach(function (m) { ev.push({ t: m.T, tipo: 'whoosh', v: 0.4 }); });
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'espacio', zonas: zonas };
    }

    /* ======================================================================
       AYUDAS PARA LOS EFECTOS NUEVOS
       ====================================================================== */
    function crearCanvas(w, h) {
        if (global.document && global.document.createElement) { var c = global.document.createElement('canvas'); c.width = w; c.height = h; return c; }
        return global.__crearCanvas ? global.__crearCanvas(w, h) : null;
    }
    var cacheEsc = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
    function copiaEscalada(img, lado, cuadrada) {
        if (!img) return null;
        lado = Math.max(4, Math.round(lado));
        var m = cacheEsc && cacheEsc.get(img);
        if (!m) { m = {}; if (cacheEsc) cacheEsc.set(img, m); }
        var key = (cuadrada ? 'q' : 'e') + lado;
        if (m[key]) return m[key];
        var cv, c;
        if (cuadrada) {
            cv = crearCanvas(lado, lado); if (!cv) return img;
            c = cv.getContext('2d');
            var s = Math.min(img.width, img.height);
            c.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, lado, lado);
        } else {
            var k = Math.min(1, lado / Math.max(img.width, img.height));
            cv = crearCanvas(Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k))); if (!cv) return img;
            c = cv.getContext('2d'); c.drawImage(img, 0, 0, cv.width, cv.height);
        }
        m[key] = cv; return cv;
    }
    // La foto cubre todo el rectángulo (recortando lo que sobre)
    function pintarCubriendo(ctx, img, x, y, w, h, zoom) {
        if (!img) { ctx.fillStyle = '#1e293b'; ctx.fillRect(x, y, w, h); return; }
        var k = Math.max(w / img.width, h / img.height) * (zoom || 1), sw = w / k, sh = h / k;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    }
    // La foto cabe entera dentro del rectángulo
    function cajaFoto(img, w, h) {
        var iw = img ? img.width : 4, ih = img ? img.height : 3, k = Math.min(w / iw, h / ih);
        return { w: iw * k, h: ih * k };
    }
    function textoGrande(ctx, txt, x, y, px, relleno, alpha) {
        ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
        ctx.font = 'bold ' + Math.round(px) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = relleno; ctx.shadowColor = 'rgba(255,200,80,0.6)'; ctx.shadowBlur = px * 0.18;
        ctx.fillText(txt, x, y); ctx.restore();
    }
    function chispas(ctx, w, h, t, n, rnd) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < n; i++) {
            var x = rnd() * w, y = rnd() * h, f = 0.6 + rnd() * 2, ph = rnd() * TAU, a = Math.max(0, Math.sin(t * f + ph));
            ctx.fillStyle = 'rgba(255,230,160,' + (a * a * 0.9).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(x, y, 1 + a * 2.2, 0, TAU); ctx.fill();
        }
        ctx.restore();
    }
    function fondoNoche(ctx, w, h, c1, c2) {
        var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }

    /* ======================================================================
       EFECTO 3: VIDEOWALL — los 16 móviles forman una pantalla gigante (4×4)
       ====================================================================== */
    function crearMuro(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd);
        var TF = 6.4, TR = 1.5, fin0 = 1 + N * TF, duracion = fin0 + 11, ruido = [], i;
        for (i = 0; i < 64; i++) ruido.push(rnd());
        var brillos = rngDe(seed + 7);
        function dibujar(ctx, w, h, t) {
            ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, w, h);
            if (t < fin0) {
                var k = Math.max(0, Math.floor((t - 1) / TF)), local = Math.max(0, t - 1 - k * TF);
                var act = fotoDe(imgs, orden[k % N]), ant = k > 0 ? fotoDe(imgs, orden[(k - 1) % N]) : null;
                var zAct = 1 + 0.05 * (local / TF);
                if (t < 1) { /* introducción: pantalla en negro con destellos */ }
                else if (local >= TR) pintarCubriendo(ctx, act, 0, 0, w, h, zAct);
                else {
                    var GX = 8, GY = Math.max(6, Math.round(8 * h / w)), tw = w / GX, th = h / GY, gx, gy;
                    for (gy = 0; gy < GY; gy++) for (gx = 0; gx < GX; gx++) {
                        var retraso = ((gx / GX) * 0.6 + (gy / GY) * 0.4) * 0.62 * TR + ruido[(gy * GX + gx) % 64] * 0.2 * TR;
                        var p = clamp((local - retraso) / (TR * 0.28), 0, 1), cx = (gx + 0.5) * tw, cy = (gy + 0.5) * th;
                        var cara = p < 0.5 ? ant : act, zz = p < 0.5 ? 1.05 : 1;
                        var esc = Math.max(0.001, Math.abs(Math.cos(p * Math.PI)));
                        ctx.save(); ctx.translate(cx, cy); ctx.scale(esc, 1);
                        ctx.beginPath(); ctx.rect(-tw / 2, -th / 2, tw + 0.6, th + 0.6); ctx.clip();
                        if (cara) pintarCubriendo(ctx, cara, -cx, -cy, w, h, zz);
                        ctx.restore();
                    }
                }
                var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
                vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
            } else {
                var f = t - fin0, a1 = clamp(1 - f / 1.2, 0, 1);
                var grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
                grad.addColorStop(0, '#3a1d5c'); grad.addColorStop(1, '#05060f'); ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
                if (a1 > 0) { ctx.globalAlpha = a1; pintarCubriendo(ctx, fotoDe(imgs, orden[(N - 1) % N]), 0, 0, w, h, 1.05); ctx.globalAlpha = 1; }
                var px = Math.min(w * 0.62, h * 0.42), e = salidaCubica((f - 0.5) / 1.5);
                var dor = ctx.createLinearGradient(0, h / 2 - px / 2, 0, h / 2 + px / 2); dor.addColorStop(0, '#fff3b0'); dor.addColorStop(0.5, '#f5b82e'); dor.addColorStop(1, '#b8731a');
                textoGrande(ctx, '40', w / 2, h / 2, px * (0.6 + 0.4 * e), dor, e);
                var rr = rngDe(seed + 99); chispas(ctx, w, h, t, 160, rr);
                var flash = Math.max(0, 1 - (f - 0.5) / 0.6); if (f > 0.5 && flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.5).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
            }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) ev.push({ t: 1 + q0 * TF, tipo: 'whoosh', v: 0.5 }); ev.push({ t: fin0 + 0.5, tipo: 'fanfarria', v: 1 });
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, muro: true, musica: 'celebracion' };
    }

    /* ======================================================================
       EFECTO 4: OLA DE LUZ — una ola luminosa recorre el muro y descubre las fotos
       ====================================================================== */
    function crearOla(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd);
        var INT = 3.2, V = 5.4, fin0 = 1 + (N - 1) * INT + V + 0.5, duracion = fin0 + 6.5;
        function dibujar(ctx, w, h, t) {
            fondoNoche(ctx, w, h, '#050616', '#12082b');
            var rr = rngDe(seed + 3); chispas(ctx, w, h, t, 70, rr);
            var k, kmin = Math.max(0, Math.floor((t - 1 - V) / INT)), kmax = Math.min(N - 1, Math.floor((t - 1) / INT));
            var skew = w * 0.35;
            for (k = kmin; k <= kmax; k++) {
                var p = (t - 1 - k * INT) / V; if (p < 0 || p > 1) continue;
                var bw = 0.2 + 0.05 * Math.sin(k), xc = lerp(-bw - 0.35, 1 + bw + 0.1, p) * w;
                var hue = (k * 47 + t * 20) % 360, xl = xc - bw * w, xr = xc + bw * w;
                ctx.save();
                ctx.beginPath(); ctx.moveTo(xl, 0); ctx.lineTo(xr, 0); ctx.lineTo(xr - skew, h); ctx.lineTo(xl - skew, h); ctx.closePath(); ctx.clip();
                pintarCubriendo(ctx, fotoDe(imgs, orden[k % N]), 0, 0, w, h, 1 + 0.04 * p);
                var gl = ctx.createLinearGradient(xl, 0, xr, 0);
                gl.addColorStop(0, 'hsla(' + hue + ',100%,70%,0.55)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'hsla(' + ((hue + 60) % 360) + ',100%,70%,0.55)');
                ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
                ctx.restore();
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = Math.max(3, w * 0.012);
                [[xl, 'hsla(' + hue + ',100%,65%,0.85)'], [xr, 'hsla(' + ((hue + 60) % 360) + ',100%,65%,0.85)']].forEach(function (b) {
                    ctx.strokeStyle = b[1]; ctx.shadowColor = b[1]; ctx.shadowBlur = w * 0.04;
                    ctx.beginPath(); ctx.moveTo(b[0], 0); ctx.lineTo(b[0] - skew, h); ctx.stroke();
                });
                ctx.restore();
            }
            if (t > fin0) {                         // final: ondas de colores desde el centro del muro
                var f = t - fin0, R = Math.hypot(w, h) * 0.6;
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (var q = 0; q < 6; q++) {
                    var r = ((f * 0.55 + q / 6) % 1) * R, a = (1 - r / R) * clamp(f / 0.8, 0, 1);
                    ctx.strokeStyle = 'hsla(' + ((q * 60 + f * 90) % 360) + ',100%,62%,' + (a * 0.9).toFixed(3) + ')'; ctx.lineWidth = Math.max(4, w * 0.03);
                    ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, TAU); ctx.stroke();
                }
                ctx.restore();
                var px = Math.min(w * 0.62, h * 0.42), e = salidaCubica(f / 1.2);
                var dor = ctx.createLinearGradient(0, h / 2 - px / 2, 0, h / 2 + px / 2); dor.addColorStop(0, '#fff3b0'); dor.addColorStop(1, '#d9901c');
                textoGrande(ctx, '40', w / 2, h / 2, px * (0.7 + 0.3 * e), dor, e);
            }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) ev.push({ t: 1 + q0 * INT + 0.6, tipo: 'whoosh', v: 0.5 }); ev.push({ t: fin0, tipo: 'fanfarria', v: 1 });
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, muro: true, musica: 'fiesta' };
    }

    /* ======================================================================
       EFECTO 5: MOSAICO — cientos de fotos pequeñas vuelan y forman el «40»
       ====================================================================== */
    function dentroDe4(x, y) {
        var d = function (px, py, ax, ay, bx, by) { var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, s = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1); return Math.hypot(px - ax - s * dx, py - ay - s * dy); };
        return (x >= 0.56 && x <= 0.80 && y >= 0.04 && y <= 0.96) || (y >= 0.58 && y <= 0.80 && x >= 0.04 && x <= 0.96) || d(x, y, 0.64, 0.04, 0.05, 0.69) < 0.1;
    }
    function dentroDe0(x, y) {
        var q = Math.pow((x - 0.5) / 0.42, 2) + Math.pow((y - 0.5) / 0.47, 2);
        return q <= 1 && q >= 0.36;
    }
    function crearMosaico(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), G = clamp(Math.ceil(Math.sqrt(N / 0.8)), 9, 18);
        function construir(g) {
            var cs = [], gx, gy, dg;
            for (dg = 0; dg < 2; dg++) for (gy = 0; gy < g; gy++) for (gx = 0; gx < g; gx++) {
                var x = (gx + 0.5) / g, y = (gy + 0.5) / g;
                if (dg === 0 ? dentroDe4(x, y) : dentroDe0(x, y)) cs.push({ d: dg, gx: gx, gy: gy });
            }
            return cs;
        }
        var celdas = construir(G);
        while (celdas.length < N && G < 26) { G++; celdas = construir(G); }       // al menos una casilla por foto: todas aparecen
        var orden = barajar(celdas.length, rnd), fotoOrden = barajar(N, rnd), TA = 14, VUELO = 1.5, HOLD = 8, duracion = 1 + TA + VUELO + HOLD, ev = [];
        celdas.forEach(function (c, i) {
            var rango = orden[i];
            c.ta = 1 + (rango / celdas.length) * TA; c.ang = rnd() * TAU; c.dist = 0.7 + rnd() * 0.6; c.rot = (rnd() - 0.5) * 6;
            c.foto = fotoOrden[rango % N];                       // las N primeras en llegar son todas distintas; el resto completa el dibujo
            if (rango % 5 === 0) ev.push({ t: c.ta + VUELO * 0.85, tipo: 'pop', v: 0.5 });
        });
        ev.push({ t: 1 + TA + VUELO, tipo: 'chime', v: 1 });
        var zonas = [];
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            fondoNoche(ctx, w, h, '#06040f', '#150b2a');
            var vertical = w <= h * 1.1, cs, ox, oy;
            if (vertical) cs = Math.min(w * 0.94 / G, h * 0.95 / (2 * G));
            else cs = Math.min(w * 0.94 / (2 * G), h * 0.9 / G);
            var tamTotalW = vertical ? G * cs : 2 * G * cs, tamTotalH = vertical ? 2 * G * cs : G * cs;
            ox = (w - tamTotalW) / 2; oy = (h - tamTotalH) / 2;
            var llegadas = clamp((t - 1) / TA, 0, 1);
            var halo = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(tamTotalW, tamTotalH) * 0.7);
            halo.addColorStop(0, 'hsla(40,100%,55%,' + (0.28 * llegadas).toFixed(3) + ')'); halo.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
            var lado = Math.max(8, Math.round(cs * 2)), brillo = (t > 1 + TA + VUELO) ? ((t - 1 - TA - VUELO) / HOLD) : -1;
            for (var i = 0; i < celdas.length; i++) {
                var c = celdas[i];
                if (t < c.ta - 0.2) continue;
                var tx = ox + (vertical ? c.gx : c.d * G + c.gx) * cs + cs / 2, ty = oy + (vertical ? c.d * G + c.gy : c.gy) * cs + cs / 2;
                var u = clamp((t - c.ta) / VUELO, 0, 1), e = salidaCubica(u), R = Math.max(w, h) * c.dist;
                var x0 = w / 2 + Math.cos(c.ang) * R, y0 = h / 2 + Math.sin(c.ang) * R;
                var x1 = lerp(x0, tx, e), y1 = lerp(y0, ty, e);
                ctx.save(); ctx.translate(x1, y1); ctx.rotate(c.rot * (1 - e));
                var s = cs * (0.5 + 0.5 * e) * 0.94;
                ctx.drawImage(copiaEscalada(fotoDe(imgs, c.foto), lado, true), -s / 2, -s / 2, s, s);
                if (u >= 1) zonas.push({ i: c.foto, x: x1, y: y1, w: s, h: s, rot: 0 });
                if (u >= 1 && brillo >= 0) {                                   // barrido dorado al final
                    var dx = ((tx - ox) / tamTotalW + (ty - oy) / tamTotalH) * 0.5, a = Math.max(0, 1 - Math.abs(dx - ((brillo * 1.6) % 1.4 - 0.2)) * 7);
                    if (a > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,220,120,' + (a * 0.65).toFixed(3) + ')'; ctx.fillRect(-s / 2, -s / 2, s, s); }
                }
                ctx.restore();
            }
            var rr = rngDe(seed + 5); if (llegadas > 0.5) chispas(ctx, w, h, t, 90, rr);
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'magico', zonas: zonas };
    }

    /* ======================================================================
       EFECTO 6: ENFOQUE DE MISTERIO — cada foto aparece borrosa y se va descubriendo
       ====================================================================== */
    function crearEnfoque(imgs, seed, opc) {
        var A = opc && opc.ajustes, txtPregunta = ajTxt(A, 'eTexto', '¿Quién será?', 30);
        var REV = ajNum(A, 'eDescubre', 5, 2, 20), VISTA = ajNum(A, 'eVista', 3, 1, 15), TF = 0.6 + REV + VISTA;          // por defecto TF = 8,6 s
        var focoK = ajNum(A, 'eFoco', 100, 0, 250) / 100, tamK = ajNum(A, 'eTam', 100, 40, 100) / 100;
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), duracion = 1 + (N - 1) * TF + TF - 0.8, zonas = [];
        var niveles = [6, 10, 16, 26, 42, 70, 120, 220, 9999];                    // resolución (px de ancho) de cada paso del desenfoque
        if (A && A.eBlur != null && A.eBlur !== '') {                              // intensidad 1 (leve) – 10 (casi irreconocible)
            var ini = 3 * Math.pow(40, (10 - ajNum(A, 'eBlur', 8, 1, 10)) / 9); niveles = [];
            for (var q = 0; q < 8; q++) niveles.push(Math.round(ini * Math.pow(220 / ini, q / 7)));
            niveles.push(9999);
        }
        var fases = []; for (var i = 0; i < N; i++) fases.push({ a: rnd() * TAU, b: rnd() * TAU, f1: 0.6 + rnd() * 0.5, f2: 0.8 + rnd() * 0.5 });
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            fondoNoche(ctx, w, h, '#07050f', '#130a22');
            var k = Math.floor((t - 1) / TF); if (k < 0) { var rr = rngDe(seed + 1); chispas(ctx, w, h, t, 60, rr); return; }
            var l = t - 1 - k * TF; if (k >= N) { k = N - 1; l = TF; }
            var img = fotoDe(imgs, orden[k % N]), fz = fases[k], ultima = (k === N - 1);
            var caja = cajaFoto(img, w * 0.9 * tamK, h * 0.78 * tamK), x = w / 2, y = h * 0.5, fw = caja.w, fh = caja.h;
            var alfa = Math.min(clamp(l / 0.6, 0, 1), ultima ? 1 : clamp((TF - l) / 0.5, 0, 1));
            var prog = clamp((l - 0.6) / REV, 0, 1), nivel = prog * (niveles.length - 2), n0 = Math.floor(nivel), fr = nivel - n0;
            ctx.save(); ctx.globalAlpha = alfa; ctx.translate(x, y);
            var b = Math.min(fw, fh) * 0.035; ctx.fillStyle = '#f7f7f7'; ctx.shadowColor = 'rgba(255,230,160,0.55)'; ctx.shadowBlur = Math.min(w, h) * 0.05;
            ctx.fillRect(-fw / 2 - b, -fh / 2 - b, fw + 2 * b, fh + 2 * b); ctx.shadowBlur = 0;
            if (prog >= 1) zonas.push({ i: orden[k % N], x: x, y: y, w: fw + 2 * b, h: fh + 2 * b, rot: 0 });
            ctx.beginPath(); ctx.rect(-fw / 2, -fh / 2, fw, fh); ctx.clip();
            ctx.imageSmoothingEnabled = true;
            var A = copiaEscalada(img, niveles[n0]), B = copiaEscalada(img, niveles[n0 + 1]);
            ctx.drawImage(A, -fw / 2, -fh / 2, fw, fh); ctx.globalAlpha = alfa * fr; ctx.drawImage(B, -fw / 2, -fh / 2, fw, fh); ctx.globalAlpha = alfa;
            if (prog < 1) {                                                    // foco que recorre la foto y la deja nítida
                var rad = Math.min(fw, fh) * (0.2 + 0.14 * prog) * focoK, lx = Math.sin(t * fz.f1 + fz.a) * fw * 0.32, ly = Math.cos(t * fz.f2 + fz.b) * fh * 0.32;
                ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, rad, 0, TAU); ctx.clip(); ctx.drawImage(img, -fw / 2, -fh / 2, fw, fh); ctx.restore();
                ctx.strokeStyle = 'rgba(255,240,190,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly, rad, 0, TAU); ctx.stroke();
            } else ctx.drawImage(img || A, -fw / 2, -fh / 2, fw, fh);
            var ff = (l - 0.6 - REV) / 0.7; if (ff > 0 && ff < 1) { ctx.fillStyle = 'rgba(255,255,255,' + ((1 - ff) * 0.8).toFixed(3) + ')'; ctx.fillRect(-fw / 2, -fh / 2, fw, fh); }
            ctx.restore();
            if (prog < 1) { ctx.save(); ctx.globalAlpha = alfa * (1 - prog); ctx.font = 'bold ' + Math.round(Math.min(w * 0.08, 34)) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde9a8'; ctx.fillText(txtPregunta, w / 2, h * 0.07); ctx.restore(); }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) { ev.push({ t: 1 + q0 * TF + 0.1, tipo: 'whoosh', v: 0.4 }, { t: 1 + q0 * TF + 0.6 + REV, tipo: 'ding', v: 1 }); }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'nostalgia', zonas: zonas };
    }

    /* ======================================================================
       EFECTO 7: ROMPECABEZAS — las piezas vuelan y la foto se recompone
       ====================================================================== */
    function crearPuzzle(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), CX = 4, CY = 3, TF = 9, duracion = 1 + (N - 1) * TF + 7.5, zonas = [];
        var piezas = []; for (var i = 0; i < CX * CY; i++) piezas.push({ ang: rnd() * TAU, dist: 0.8 + rnd() * 0.5, rot: (rnd() - 0.5) * 5, d: rnd() * 0.9 });
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            fondoNoche(ctx, w, h, '#0a0a18', '#1a1030');
            var k = Math.floor((t - 1) / TF), rr = rngDe(seed + 2); chispas(ctx, w, h, t, 40, rr);
            if (k < 0) return;
            var l = t - 1 - k * TF; if (k >= N) { k = N - 1; l = TF; }
            var ultima = (k === N - 1), img = fotoDe(imgs, orden[k % N]), cb = cajaFoto(img, w * 0.9, h * 0.74), fw = cb.w, fh = cb.h;
            var x0 = (w - fw) / 2, y0 = (h - fh) / 2, pw = fw / CX, ph = fh / CY, sw = img.width / CX, sh = img.height / CY;
            for (var p = 0; p < piezas.length; p++) {
                var pi = piezas[p], cx = p % CX, cy = Math.floor(p / CX);
                var entra = clamp((l - 0.3 - pi.d) / 1.2, 0, 1), sale = ultima ? 0 : clamp((l - 7.3 - pi.d * 0.5) / 1.1, 0, 1);
                var e = salidaCubica(entra), se = sale * sale, R = Math.max(w, h) * pi.dist;
                var tx = x0 + cx * pw + pw / 2, ty = y0 + cy * ph + ph / 2;
                var ex = w / 2 + Math.cos(pi.ang) * R, ey = h / 2 + Math.sin(pi.ang) * R;
                var px = lerp(ex, tx, e), py = lerp(ey, ty, e);
                if (sale > 0) { px = lerp(tx, w / 2 - Math.cos(pi.ang) * R, se); py = lerp(ty, h / 2 - Math.sin(pi.ang) * R, se); }
                var gap = (1 - e) * 5 + (e < 1 ? 2 : 0), rot = pi.rot * (1 - e) + (sale > 0 ? se * pi.rot : 0);
                ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.globalAlpha = clamp(entra * 3, 0, 1) * (1 - se * 0.6);
                ctx.shadowColor = 'rgba(255,230,160,0.4)'; ctx.shadowBlur = e < 1 ? 14 : 0;
                ctx.drawImage(img, cx * sw, cy * sh, sw, sh, -pw / 2 + gap / 2, -ph / 2 + gap / 2, pw - gap, ph - gap);
                ctx.restore();
            }
            if (l > 4.0 && (l < 7.4 || ultima)) {
                zonas.push({ i: orden[k % N], x: w / 2, y: h / 2, w: fw, h: fh, rot: 0 });                                          // foto completa: marco y destello
                var a = Math.min(clamp((l - 4.0) / 0.5, 0, 1), ultima ? 1 : clamp((7.4 - l) / 0.5, 0, 1));
                ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fde9a8'; ctx.lineWidth = Math.max(3, w * 0.01); ctx.shadowColor = '#f5b82e'; ctx.shadowBlur = w * 0.04; ctx.strokeRect(x0, y0, fw, fh); ctx.restore();
            }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) { var b0 = 1 + q0 * TF; piezas.forEach(function (pz) { ev.push({ t: b0 + 0.3 + pz.d + 1.2, tipo: 'click', v: 0.6 }); }); ev.push({ t: b0 + 4.0, tipo: 'chime', v: 0.9 }, { t: b0 + 7.3, tipo: 'whoosh', v: 0.5 }); }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'magico', zonas: zonas };
    }

    /* ======================================================================
       EFECTO 8: POLAROIDS REVELADAS — salen en blanco, se revelan y forman un collage
       ====================================================================== */
    function crearPolaroid(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), INT = 5.2, duracion = 1 + (N - 1) * INT + 6.8 + 3;
        var casillas = barajar(N + 10, rnd), items = [], zonas = [];
        for (var j = 0; j < N; j++) items.push({ idx: orden[j], cas: casillas[j], rot: (rnd() - 0.5) * 0.5, ph: rnd() * TAU, jx: rnd() - 0.5, jy: rnd() - 0.5 });
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2b1b12'); g.addColorStop(1, '#171009'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            var cols = w < h ? 4 : 7, filas = Math.ceil((N + 10) / cols), S = Math.min(w, h) * 0.78, Sp = Math.min(w / cols * 1.15, h / filas * 1.15) * 0.92, j;
            for (j = 0; j < N; j++) {
                var it = items[j], tj = 1 + j * INT, l = t - tj; if (l < 6.0) continue;
                var cx0 = it.cas % cols, cy0 = Math.floor(it.cas / cols), px = (cx0 + 0.5 + it.jx * 0.3) / cols * w, py = (cy0 + 0.5 + it.jy * 0.3) / filas * h;
                var e = suave((l - 6.0) / 0.8);
                var fx = lerp(w / 2, px, e), fy = lerp(h * 0.5, py, e), esc = lerp(1, Sp / S, e);
                pintarFoto(ctx, fotoDe(imgs, it.idx), fx, fy, S * esc, lerp(0, it.rot, e), 0.97, 40, 0.06, zonas, it.idx);
            }
            var k = Math.floor((t - 1) / INT); if (k >= 0 && k < N) {
                var l2 = t - 1 - k * INT; if (l2 < 6.8) {
                    var itc = items[k], dentro = salidaCubica(l2 / 1.0), caeA = l2 > 6.0 ? suave((l2 - 6.0) / 0.8) : 0, img = fotoDe(imgs, itc.idx);
                    if (caeA === 0) {
                        var yc = lerp(h * 1.0 + S * 0.5, h * 0.5, dentro), cb = cajaFoto(img, S, S), b = S * 0.05, base = S * 0.07, fw = cb.w + 2 * b, fh = cb.h + 2 * b + base;
                        zonas.push({ i: itc.idx, x: w / 2, y: yc, w: fw, h: fh, rot: itc.rot * 0.5 * (1 - dentro) });
                        ctx.save(); ctx.translate(w / 2, yc); ctx.rotate(itc.rot * 0.5 * (1 - dentro)); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = S * 0.08; ctx.shadowOffsetY = S * 0.03;
                        ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-fw / 2, -fh / 2, fw, fh); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                        ctx.fillStyle = '#d9d6cc'; ctx.fillRect(-cb.w / 2, -fh / 2 + b, cb.w, cb.h);
                        var rev = clamp((l2 - 1.3) / 3.6, 0, 1);               // revelado químico: del verde oscuro a la foto
                        ctx.save(); ctx.globalAlpha = rev * rev; ctx.drawImage(img, -cb.w / 2, -fh / 2 + b, cb.w, cb.h); ctx.restore();
                        ctx.fillStyle = 'rgba(28,48,44,' + (0.88 * (1 - rev)).toFixed(3) + ')'; ctx.fillRect(-cb.w / 2, -fh / 2 + b, cb.w, cb.h);
                        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 * (1 - rev)).toFixed(3) + ')'; ctx.fillRect(-cb.w / 2, -fh / 2 + b, cb.w, cb.h * 0.2 * (1 - rev));
                        ctx.restore();
                    } else {
                        var c2 = items[k], cx1 = c2.cas % cols, cy1 = Math.floor(c2.cas / cols), ppx = (cx1 + 0.5 + c2.jx * 0.3) / cols * w, ppy = (cy1 + 0.5 + c2.jy * 0.3) / filas * h;
                        pintarFoto(ctx, img, lerp(w / 2, ppx, caeA), lerp(h * 0.5, ppy, caeA), lerp(S, Sp, caeA), lerp(0, c2.rot, caeA), 0.97, 40, 0.06, zonas, c2.idx);
                    }
                }
            }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) { var tj = 1 + q0 * INT; ev.push({ t: tj + 0.05, tipo: 'obturador', v: 1 }, { t: tj + 0.2, tipo: 'impresora', v: 0.8 }, { t: tj + 4.9, tipo: 'ding', v: 0.8 }); }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'nostalgia', zonas: zonas };
    }

    /* ======================================================================
       EFECTO 9: TÚNEL DEL TIEMPO — viaje por un túnel con las fotos en las paredes
       ====================================================================== */
    function crearTunel(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), V = 1.25, GAP = 3.4, Z0 = 9, camMax = Z0 + (N - 1) * GAP - 2.8, duracion = camMax / V + 3.5;
        var X0 = 1, paneles = [];
        for (var j = 0; j < N; j++) paneles.push({ idx: orden[j], pared: j % 4, z: Z0 + j * GAP, hue: Math.floor(rnd() * 360) });
        function tira(ctx, img, pared, z1, z2, L, vx, vy, F, Y0, mitadAlto, ancho) {
            // Dibuja una pared del túnel en perspectiva con tiras (la textura avanza linealmente con la profundidad)
            var n = 90, i;
            for (i = 0; i < n; i++) {
                var za = lerp(z1, z2, i / n), zb = lerp(z1, z2, (i + 1) / n), zm = (za + zb) / 2;
                if (zb < 0.9 || za > 40) continue;
                za = Math.max(za, 0.9); if (zb <= za) continue;
                var u0 = i / n, u1 = (i + 1) / n;
                if (pared < 2) {                               // izquierda / derecha
                    var sg = pared === 0 ? -1 : 1, xa = vx + sg * X0 * F / za, xb = vx + sg * X0 * F / zb, hh = mitadAlto * F / zm;
                    var x = Math.min(xa, xb), wd = Math.abs(xb - xa) + 1.2;
                    var su = pared === 0 ? u0 : 1 - u1;
                    ctx.drawImage(img, su * img.width, 0, (u1 - u0) * img.width, img.height, x, vy - hh, wd, hh * 2);
                } else {                                       // techo / suelo
                    var sv = pared === 2 ? -1 : 1, ya = vy + sv * Y0 * F / za, yb = vy + sv * Y0 * F / zb, ww = ancho * F / zm;
                    var y = Math.min(ya, yb), ht = Math.abs(yb - ya) + 1;
                    var sv0 = pared === 2 ? u0 : 1 - u1;
                    ctx.drawImage(img, 0, sv0 * img.height, img.width, (u1 - u0) * img.height, vx - ww, y, ww * 2, ht);
                }
            }
        }
        function dibujar(ctx, w, h, t) {
            var F = w * 0.5, vx = w / 2, vy = h / 2, Y0 = h / w * X0, cam = Math.min(V * t, camMax), k;
            ctx.fillStyle = '#02020a'; ctx.fillRect(0, 0, w, h);
            // Anillos de luz que vienen hacia la cámara
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (k = 0; k < 16; k++) {
                var z = (((k * 2.2 - cam) % 35.2) + 35.2) % 35.2 + 0.95, a = clamp(1.4 / z, 0, 0.8), ex = X0 * F / z, ey = Y0 * F / z;
                ctx.strokeStyle = 'hsla(' + ((200 + z * 9 + t * 25) % 360) + ',90%,62%,' + a.toFixed(3) + ')'; ctx.lineWidth = clamp(2.2 / z + 0.6, 0.6, 3.5);
                ctx.strokeRect(vx - ex, vy - ey, ex * 2, ey * 2);
            }
            ctx.restore();
            // Paneles de fotos, de lejos a cerca
            var lista = [];
            for (var j = 0; j < paneles.length; j++) { var p = paneles[j], zi = p.z - cam; if (zi < 18 && zi > -6) lista.push({ p: p, z: zi }); }
            lista.sort(function (a, b) { return b.z - a.z; });
            for (var q = 0; q < lista.length; q++) {
                var P = lista[q].p, zi2 = lista[q].z, img = fotoDe(imgs, P.idx), ia = img.width / img.height, L;
                var lateral = P.pared < 2, mitad = lateral ? Y0 * 0.62 : X0 * 0.62;
                L = lateral ? (mitad * 2) * ia : (mitad * 2) / ia;
                L = clamp(L, 1.4, 4.2);
                var za = zi2, zb = zi2 + L; if (zb < 0.95) continue;
                var alfa = clamp((22 - za) / 8, 0, 1);
                ctx.save(); ctx.globalAlpha = alfa;
                tira(ctx, img, P.pared, za, zb, L, vx, vy, F, Y0, mitad, mitad);
                ctx.restore();
                // marco luminoso de la entrada del panel
                var zf = Math.max(za, 0.95);
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alfa * 0.8; ctx.strokeStyle = 'hsla(' + P.hue + ',100%,70%,0.9)'; ctx.lineWidth = 2;
                if (lateral) { var sx = vx + (P.pared === 0 ? -1 : 1) * X0 * F / zf, hh2 = mitad * F / zf; ctx.beginPath(); ctx.moveTo(sx, vy - hh2); ctx.lineTo(sx, vy + hh2); ctx.stroke(); }
                ctx.restore();
            }
            var vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.max(w, h) * 0.65); vg.addColorStop(0, 'rgba(120,160,255,0.22)'); vg.addColorStop(0.35, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
            ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
        }
        var ev = []; paneles.forEach(function (pn) { ev.push({ t: (pn.z - 2.4) / V, tipo: 'whoosh', v: 0.5 }); });
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'espacio' };
    }

    /* ======================================================================
       EFECTO 10: FAROLILLOS AL CIELO — fotos que suben flotando en la noche
       ====================================================================== */
    function crearFarolillos(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), INT = 2.4, VIDA = 15, duracion = 1 + (N - 1) * INT + VIDA * 0.45 + 4.5, j, zonas = [];
        var fa = [], estrellas = crearEstrellas(rnd, 110), orbes = [];
        for (j = 0; j < N; j++) fa.push({ T: 1 + j * INT, x: 0.14 + rnd() * 0.72, prof: 0.8 + rnd() * 0.45, ph: rnd() * TAU, amp: 0.02 + rnd() * 0.035, idx: orden[j] });
        for (j = 0; j < Math.floor(duracion / 0.8); j++) orbes.push({ T: rnd() * duracion, x: rnd(), v: 0.06 + rnd() * 0.06, r: 2 + rnd() * 4, ph: rnd() * TAU });
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            fondoNoche(ctx, w, h, '#050818', '#1d1030');
            var s;
            for (s = 0; s < estrellas.length; s++) { var e = estrellas[s], a = 0.3 + 0.3 * Math.sin(t * e.f + e.ph); ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; ctx.fillRect(e.x * w, e.y * h * 0.8, e.r, e.r); }
            var lu = ctx.createRadialGradient(w * 0.82, h * 0.12, 0, w * 0.82, h * 0.12, w * 0.3); lu.addColorStop(0, 'rgba(255,245,210,0.9)'); lu.addColorStop(0.12, 'rgba(255,245,210,0.55)'); lu.addColorStop(1, 'rgba(255,245,210,0)');
            ctx.fillStyle = lu; ctx.fillRect(0, 0, w, h);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (s = 0; s < orbes.length; s++) {                                // farolillos lejanos sin foto
                var o = orbes[s], l0 = t - o.T; if (l0 < 0 || l0 > 22) continue;
                var oy = h * (1.05 - o.v * l0 * 0.9), ox = (o.x + Math.sin(l0 * 0.6 + o.ph) * 0.02) * w;
                ctx.fillStyle = 'rgba(255,170,70,' + (0.55 * clamp(oy / h, 0, 1)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(ox, oy, o.r, 0, TAU); ctx.fill();
            }
            ctx.restore();
            var Sb = Math.min(w * 0.34, h * 0.2);
            for (j = 0; j < N; j++) {
                var f = fa[j], l = t - f.T, esUlt = (j === N - 1); if (l < 0 || (l > VIDA && !esUlt)) continue;
                var u = (esUlt ? Math.min(l, VIDA * 0.45) : l) / VIDA, py = lerp(h + Sb * 0.8, -Sb * 0.9, u), px = (f.x + Math.sin(l * 0.55 + f.ph) * f.amp) * w, sz = Sb * f.prof;
                var al = Math.min(clamp(l / 1.2, 0, 1), esUlt ? 1 : clamp((VIDA - l) / 1.8, 0, 1)), fl = 0.88 + 0.12 * Math.sin(l * 9 + f.ph);
                var gr = ctx.createRadialGradient(px, py, 0, px, py, sz * 1.15); gr.addColorStop(0, 'rgba(255,170,60,' + (0.55 * al * fl).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)');
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(px - sz * 1.2, py - sz * 1.2, sz * 2.4, sz * 2.4); ctx.restore();
                pintarFoto(ctx, fotoDe(imgs, f.idx), px, py, sz, Math.sin(l * 0.8 + f.ph) * 0.07, al, 30, 0.2, zonas, f.idx);
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * fl;
                var fg = ctx.createRadialGradient(px, py + sz * 0.62, 0, px, py + sz * 0.62, sz * 0.2); fg.addColorStop(0, 'rgba(255,240,170,0.95)'); fg.addColorStop(1, 'rgba(255,140,40,0)');
                ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(px, py + sz * 0.62, sz * 0.07, sz * 0.14, 0, 0, TAU); ctx.fill(); ctx.restore();
            }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: [], musica: 'magico', zonas: zonas };
    }

    /* ======================================================================
       EFECTO 11: LLUVIA DE RECUERDOS — fotos que caen girando entre confeti
       ====================================================================== */
    function crearLluvia(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), INT = 1.35, j, conf = [];
        var fo = [], maxVida = 0;
        for (j = 0; j < N; j++) { var vida = 8.5 + rnd() * 3; maxVida = Math.max(maxVida, vida); fo.push({ T: 1 + j * INT, x: 0.12 + rnd() * 0.76, vida: vida, prof: 0.75 + rnd() * 0.5, ph: rnd() * TAU, fr: 0.7 + rnd() * 0.8, rot: (rnd() - 0.5) * 1.2, idx: orden[j], hue: Math.floor(rnd() * 360) }); }
        var duracion = fo.reduce(function (m, f) { return Math.max(m, f.T + f.vida); }, 0) + 4.5, zonas = [];
        for (j = 0; j < 90; j++) conf.push({ x: rnd(), v: 0.08 + rnd() * 0.12, ph: rnd(), w: 3 + rnd() * 6, hue: Math.floor(rnd() * 360), sp: 1 + rnd() * 3 });
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            fondoNoche(ctx, w, h, '#0a0620', '#1c0e3a');
            var s;
            for (s = 0; s < conf.length; s++) {
                var c = conf[s], y = (((c.ph + t * c.v) % 1) * (h + 40)) - 20, x = (c.x + Math.sin(t * 0.8 + c.ph * 9) * 0.03) * w, e = Math.abs(Math.cos(t * c.sp + c.ph * 7));
                ctx.fillStyle = 'hsla(' + c.hue + ',90%,62%,0.8)'; ctx.save(); ctx.translate(x, y); ctx.rotate(t * c.sp); ctx.fillRect(-c.w / 2, -c.w * e / 2, c.w, Math.max(1, c.w * e)); ctx.restore();
            }
            var Sb = Math.min(w * 0.34, h * 0.19), cols = Math.max(2, Math.floor(w / (Sb * 0.8))), filas = Math.ceil(N / cols);
            var paso = Math.min(Sb * 0.62, (h * 0.78 - Sb) / Math.max(1, filas - 1));
            for (j = 0; j < N; j++) {
                var f = fo[j], l = t - f.T; if (l < 0) continue;
                var sz = Sb * f.prof, rc = j % cols, rf = Math.floor(j / cols);
                var rx = (rc + 0.5 + (f.x - 0.5) * 0.25) / cols * w, ry = h - sz * 0.55 - rf * paso;      // reposo: montón en el fondo
                var u = clamp(l / f.vida, 0, 1), sw = Math.sin(l * f.fr + f.ph) * 0.07 * w * (1 - u);
                var px = lerp(f.x * w + sw, rx, suave(u)), py = lerp(-sz * 0.9, ry, u);
                var al = clamp(l / 0.6, 0, 1), giro = Math.cos(l * f.fr * 1.3 + f.ph), esc = lerp(0.55 + 0.45 * Math.abs(giro), 1, suave((u - 0.8) / 0.2));
                var rot = lerp(f.rot + Math.sin(l * f.fr + f.ph) * 0.25, f.rot * 0.6, suave(u));
                ctx.save(); ctx.translate(px, py); ctx.scale(esc, 1); ctx.translate(-px, -py);
                pintarFoto(ctx, fotoDe(imgs, f.idx), px, py, sz, rot, al, f.hue, 0.16, zonas, f.idx);
                ctx.restore();
            }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: [], musica: 'fiesta', zonas: zonas };
    }

    /* ======================================================================
       EFECTO 12: TRAGAPERRAS DE RECUERDOS — tres rodillos giran y se paran en tres fotos
       ====================================================================== */
    function crearTragaperras(imgs, seed, opc) {
        var txtFicha = ajTxt(opc && opc.ajustes, 'rFicha', '40', 4);
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), RONDA = 8.4, R = Math.ceil(N / 3);
        var duracion = 1 + (R - 1) * RONDA + 7.6;
        var D = [0, 1, 2].map(function (r) { return R * Math.ceil((16 + 5 * r) / R); }), DUR = [2.4, 3.3, 4.2], bombillas = 22, chisp = [], ev = [], i, r, k, m;
        for (i = 0; i < 40; i++) chisp.push({ a: rnd() * TAU, v: 0.4 + rnd() * 0.9, hue: Math.floor(rnd() * 360) });
        for (k = 0; k < R; k++) {                                                // sonidos: ticks de los rodillos, topes y premio
            for (r = 0; r < 3; r++) {
                var ultimo = -1;
                for (m = 1; m <= D[r] + 1; m++) {
                    var f = m / (D[r] + 1), x = 1 - Math.pow(1 - f, 1 / 3), tt = 1 + k * RONDA + 0.4 + DUR[r] * x;
                    if (tt - ultimo >= 0.04) { ev.push({ t: tt, tipo: 'tick', v: 0.35 + 0.65 * (1 - x) }); ultimo = tt; }
                }
                ev.push({ t: 1 + k * RONDA + 0.4 + DUR[r], tipo: 'tope', v: 1 });
            }
            ev.push({ t: 1 + k * RONDA + 0.5 + DUR[2], tipo: 'premio', v: 1 });
        }
        var zonas = [];
        function idxDe(rr, c) { var q = 3 * ((((c - 1) % R) + R) % R) + rr; return q < N ? orden[q] : -1; }
        function pos(r, t) {                                                     // posición (en casillas) del rodillo r
            var kk = Math.floor((t - 1) / RONDA); if (kk < 0) return 0;
            kk = Math.min(kk, R - 1);
            var l = t - 1 - kk * RONDA, base = kk * (D[r] + 1), xx = clamp((l - 0.4) / DUR[r], 0, 1), e = 1 - Math.pow(1 - xx, 3);
            return base + (D[r] + 1) * e;
        }
        // casilla c del rodillo r → foto (cada foto sale exactamente una vez en las paradas; si sobran huecos, ficha «40»)
        function foto(rr, c) { var q = 3 * ((((c - 1) % R) + R) % R) + rr; return q < N ? fotoDe(imgs, orden[q]) : null; }
        function fichaDorada(ctx, x, y, s) {
            var g = ctx.createLinearGradient(x, y - s / 2, x, y + s / 2); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f5b82e'); g.addColorStop(1, '#b8731a');
            ctx.fillStyle = g; ctx.fillRect(x - s * 0.44, y - s * 0.44, s * 0.88, s * 0.88);
            ctx.fillStyle = '#5a3406'; ctx.font = 'bold ' + Math.round(s * 0.42) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txtFicha, x, y + 2);
        }
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            fondoNoche(ctx, w, h, '#14041f', '#33081c');
            var cs = Math.min(w * 0.27, h * 0.2), anchoMaq = cs * 3.34, altoVent = cs * 1.0, cx = w / 2, cy = h * 0.5, b;
            var ma = ctx.createLinearGradient(0, cy - cs * 1.4, 0, cy + cs * 1.4); ma.addColorStop(0, '#ffd966'); ma.addColorStop(0.5, '#c8860f'); ma.addColorStop(1, '#8a5206');
            ctx.fillStyle = ma; var rx = cx - anchoMaq / 2 - cs * 0.12, ry = cy - cs * 0.95, rw = anchoMaq + cs * 0.24, rh = cs * 1.9;
            ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, cs * 0.15); else ctx.rect(rx, ry, rw, rh); ctx.fill();
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (b = 0; b < bombillas; b++) {                                  // bombillas del marco
                var q = b / bombillas, bx, by, per = 2 * (rw + rh), d = q * per;
                if (d < rw) { bx = rx + d; by = ry; } else if (d < rw + rh) { bx = rx + rw; by = ry + (d - rw); } else if (d < 2 * rw + rh) { bx = rx + rw - (d - rw - rh); by = ry + rh; } else { bx = rx; by = ry + rh - (d - 2 * rw - rh); }
                var on = Math.sin(t * 6 + b * 0.9) > 0; ctx.fillStyle = on ? 'rgba(255,250,200,0.95)' : 'rgba(255,170,40,0.35)'; ctx.beginPath(); ctx.arc(bx, by, cs * 0.045, 0, TAU); ctx.fill();
            }
            ctx.restore();
            textoGrande(ctx, '¡SORTEO!', cx, ry - cs * 0.42, Math.min(cs * 0.55, w * 0.1), '#ffe9a0', 1);
            ctx.fillStyle = '#12060e'; ctx.fillRect(cx - anchoMaq / 2, cy - altoVent, anchoMaq, altoVent * 2);
            var kr = Math.floor((t - 1) / RONDA), l = t - 1 - Math.max(0, kr) * RONDA;
            for (var rr = 0; rr < 3; rr++) {
                var rxr = cx - (cs * 3.16) / 2 + rr * (cs * 1.08), p = pos(rr, t), vel = Math.abs(pos(rr, t + 0.04) - pos(rr, t - 0.04)) / 0.08;
                ctx.save(); ctx.beginPath(); ctx.rect(rxr, cy - altoVent, cs, altoVent * 2); ctx.clip();
                ctx.fillStyle = '#f4f1e8'; ctx.fillRect(rxr, cy - altoVent, cs, altoVent * 2);
                for (var c = Math.floor(p) - 2; c <= Math.floor(p) + 2; c++) {
                    var y = cy + (c - p) * cs, im = foto(rr, c);
                    ctx.globalAlpha = vel > 6 ? 0.85 : 1;
                    if (!im) { fichaDorada(ctx, rxr + cs / 2, y, cs); continue; }
                    var cb = cajaFoto(im, cs * 0.88, cs * 0.88);
                    ctx.drawImage(im, rxr + (cs - cb.w) / 2, y - cb.h / 2, cb.w, cb.h);
                    if (vel < 0.05 && c === Math.round(p)) zonas.push({ i: idxDe(rr, c), x: rxr + cs / 2, y: y, w: cb.w, h: cb.h, rot: 0 });
                    if (vel > 6) { ctx.globalAlpha = 0.3; ctx.drawImage(im, rxr + (cs - cb.w) / 2, y - cb.h / 2 + vel * 0.9, cb.w, cb.h); }
                }
                ctx.restore();
            }
            ctx.save(); ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.lineWidth = Math.max(2, cs * 0.03); ctx.beginPath(); ctx.moveTo(cx - anchoMaq / 2, cy); ctx.lineTo(cx + anchoMaq / 2, cy); ctx.stroke(); ctx.restore();
            var sh = ctx.createLinearGradient(0, cy - altoVent, 0, cy + altoVent); sh.addColorStop(0, 'rgba(0,0,0,0.7)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.7)');
            ctx.fillStyle = sh; ctx.fillRect(cx - anchoMaq / 2, cy - altoVent, anchoMaq, altoVent * 2);
            var fin = 0.4 + DUR[2] + 0.1;                                      // explosión de premio al parar el último rodillo
            if (kr >= 0 && l > fin && l < fin + 2.4) {
                var a = (l - fin) / 2.4; ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (var s = 0; s < chisp.length; s++) { var ch = chisp[s], d2 = ch.v * cs * 2.4 * (1 - Math.exp(-3 * a * 1.3)), x2 = cx + Math.cos(ch.a) * d2, y2 = cy + Math.sin(ch.a) * d2 + a * a * cs * 0.8;
                    ctx.fillStyle = 'hsla(' + ch.hue + ',100%,65%,' + ((1 - a) * 0.9).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x2, y2, 2 + cs * 0.025, 0, TAU); ctx.fill(); }
                ctx.restore();
                var fl = Math.max(0, 1 - (l - fin) / 0.45); if (fl > 0) { ctx.save(); ctx.globalAlpha = fl * 0.4; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.restore(); }
            }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: null, zonas: zonas };
    }

    /* ======================================================================
       EFECTO 13: TARTA DE RECUERDOS (repostería)
       Cada foto cae sobre una placa de fondant, se queda un rato para admirarla y
       vuela a decorar la tarta. Al final se encienden las velas del «40».
       ====================================================================== */
    function crearPasteleria(imgs, seed, opc) {
        var txtTarta = ajTxt(opc && opc.ajustes, 'tTexto', '¡Felices 40!', 24);
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), j;
        var INT = 5.0, T0 = 1.2, DROP = 0.9, SHOW = 3.0, FLY = 0.9, VUELO_TOTAL = DROP + SHOW + FLY;
        var tFin = T0 + (N - 1) * INT + VUELO_TOTAL, tVelas = tFin + 0.6, duracion = tVelas + 9.5;
        var pasteles = ['#ff8fab', '#ffd166', '#8ecae6', '#b8f2e6', '#cdb4db', '#ffafcc'];
        var fotos = [], sprinkles = [], confeti = [], bokeh = [], ev = [];
        for (j = 0; j < N; j++) {
            fotos.push({ T: T0 + j * INT, idx: orden[j], rot: (rnd() - 0.5) * 0.2, ph: rnd() * TAU });
            ev.push({ t: T0 + j * INT + 0.35, tipo: 'pop', v: 0.7 }, { t: T0 + j * INT + VUELO_TOTAL, tipo: 'click', v: 0.6 });
        }
        ev.push({ t: tVelas, tipo: 'chime', v: 1 }, { t: tVelas + 0.5, tipo: 'fanfarria', v: 0.9 });
        for (j = 0; j < 170; j++) sprinkles.push({ x: rnd(), y: rnd(), r: rnd() * TAU, c: pasteles[Math.floor(rnd() * pasteles.length)], tier: Math.floor(rnd() * 3) });
        for (j = 0; j < 110; j++) confeti.push({ x: rnd(), v: 0.12 + rnd() * 0.18, ph: rnd(), w: 4 + rnd() * 6, c: pasteles[Math.floor(rnd() * pasteles.length)], sp: 1 + rnd() * 3 });
        for (j = 0; j < 16; j++) bokeh.push({ x: rnd(), y: rnd(), r: 0.03 + rnd() * 0.07, c: pasteles[Math.floor(rnd() * pasteles.length)], v: 0.01 + rnd() * 0.02, ph: rnd() * TAU });
        var permSlots = barajar(400, rngDe(seed + 11)), cacheLay = {}, zonas = [];

        // Disposición: tarta de tres pisos y casillas para las fotos (empaquetado hexagonal en las caras)
        function disposicion(w, h) {
            var key = Math.round(w) + 'x' + Math.round(h);
            if (cacheLay[key]) return cacheLay[key];
            var L = {}, apais = w > h * 1.15, i, y;
            if (apais) { L.cx = w * 0.72; L.Wc = Math.min(w * 0.5, h * 0.62); L.base = h * 0.93; L.hx = w * 0.27; L.hy = h * 0.5; L.hs = Math.min(w * 0.36, h * 0.6); L.bx = w * 0.27; L.by = h * 0.16; }
            else { L.cx = w / 2; L.Wc = Math.min(w * 0.88, h * 0.5); L.base = h * 0.92; L.hx = w / 2; L.hy = h * 0.27; L.hs = Math.min(w * 0.62, h * 0.33); L.bx = w / 2; L.by = h * 0.1; }
            var ws = [1, 0.74, 0.5], hh = [0.3, 0.27, 0.24];
            y = L.base - L.Wc * 0.04; L.tiers = [];
            for (i = 0; i < 3; i++) { var th = L.Wc * hh[i], tw = L.Wc * ws[i]; y -= th; L.tiers.push({ x: L.cx - tw / 2, y: y, w: tw, h: th, ry: tw * 0.07 }); }
            var r = Math.min(L.Wc * 0.085, w * 0.07), slots, guard = 0;
            do {
                slots = []; var d = r * 2.25;
                L.tiers.forEach(function (t, ti) {
                    var yTop = t.y + t.ry + t.h * 0.1 + r * 1.15, yBot = t.y + t.h - r * 1.1, rows = yBot < yTop ? 1 : Math.floor((yBot - yTop) / (d * 0.9)) + 1, k, q;
                    for (k = 0; k < rows; k++) {
                        var yy = rows > 1 ? yTop + k * (yBot - yTop) / (rows - 1) : (yTop + yBot) / 2;
                        var cols = Math.max(1, Math.floor((t.w - 2 * r) / d) + 1), n = (k % 2 && cols > 1) ? cols - 1 : cols;
                        for (q = 0; q < n; q++) slots.push({ x: L.cx + (q - (n - 1) / 2) * d, y: yy, tier: ti });
                    }
                });
                r *= 0.92; guard++;
            } while (slots.length < N && guard < 60);
            L.r = r / 0.92; L.slots = slots; cacheLay[key] = L;
            return L;
        }
        function slotDe(L, j) { return L.slots[permSlots[j] % L.slots.length]; }
        function rebote(x) {                                                      // caída con rebote
            x = clamp(x, 0, 1);
            if (x < 1 / 2.75) return 7.5625 * x * x;
            if (x < 2 / 2.75) { x -= 1.5 / 2.75; return 7.5625 * x * x + 0.75; }
            if (x < 2.5 / 2.75) { x -= 2.25 / 2.75; return 7.5625 * x * x + 0.9375; }
            x -= 2.625 / 2.75; return 7.5625 * x * x + 0.984375;
        }
        function placa(ctx, img, x, y, S, rot, alpha) {                           // placa de fondant con perlas; la foto se ve entera
            if (alpha <= 0.003) return;
            var cb = cajaFoto(img, S, S), b = S * 0.07, fw = cb.w + 2 * b, fh = cb.h + 2 * b;
            ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = clamp(alpha, 0, 1);
            ctx.shadowColor = 'rgba(190,90,120,0.45)'; ctx.shadowBlur = S * 0.12; ctx.shadowOffsetY = S * 0.04;
            ctx.fillStyle = '#fff6f0'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-fw / 2, -fh / 2, fw, fh, S * 0.07); else ctx.rect(-fw / 2, -fh / 2, fw, fh); ctx.fill();
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.fillStyle = '#ffd3e0'; var pr = Math.max(2, S * 0.022), per = 2 * (fw + fh), n = Math.floor(per / (pr * 3.2)), q;
            for (q = 0; q < n; q++) {                                             // perlas de azúcar en el borde
                var dd = q / n * per, px, py;
                if (dd < fw) { px = -fw / 2 + dd; py = -fh / 2 + b / 2; } else if (dd < fw + fh) { px = fw / 2 - b / 2; py = -fh / 2 + (dd - fw); }
                else if (dd < 2 * fw + fh) { px = fw / 2 - (dd - fw - fh); py = fh / 2 - b / 2; } else { px = -fw / 2 + b / 2; py = fh / 2 - (dd - 2 * fw - fh); }
                ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
            }
            if (img) ctx.drawImage(img, -cb.w / 2, -cb.h / 2, cb.w, cb.h); else { ctx.fillStyle = '#e5c9d3'; ctx.fillRect(-cb.w / 2, -cb.h / 2, cb.w, cb.h); }
            ctx.restore();
        }
        function decoracion(ctx, img, x, y, r, alpha) {                          // fotito redonda con aro de glaseado
            if (alpha <= 0.003) return;
            ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.shadowColor = 'rgba(120,50,80,0.35)'; ctx.shadowBlur = r * 0.35; ctx.shadowOffsetY = r * 0.12;
            ctx.fillStyle = '#fffaf5'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, TAU); ctx.clip();
            var mini = copiaEscalada(img, Math.max(8, Math.round(r * 3)), true);
            if (mini) ctx.drawImage(mini, x - r * 0.84, y - r * 0.84, r * 1.68, r * 1.68);
            ctx.restore();
        }
        function tarta(ctx, L, t) {
            var cx = L.cx, i, k;
            ctx.fillStyle = 'rgba(120,60,70,0.18)'; ctx.beginPath(); ctx.ellipse(cx, L.base + L.Wc * 0.02, L.Wc * 0.66, L.Wc * 0.09, 0, 0, TAU); ctx.fill();
            var pl = ctx.createLinearGradient(cx - L.Wc * 0.62, 0, cx + L.Wc * 0.62, 0); pl.addColorStop(0, '#d8dce6'); pl.addColorStop(0.5, '#ffffff'); pl.addColorStop(1, '#cfd4e0');
            ctx.fillStyle = pl; ctx.beginPath(); ctx.ellipse(cx, L.base - L.Wc * 0.015, L.Wc * 0.62, L.Wc * 0.075, 0, 0, TAU); ctx.fill();
            var cuerpo = [['#f9c6da', '#ec94b5'], ['#fff0d2', '#f1d29a'], ['#d9bff0', '#b98ddb']];
            for (i = 0; i < 3; i++) {
                var T = L.tiers[i], ry = T.ry, c = cuerpo[i];
                var g = ctx.createLinearGradient(T.x, 0, T.x + T.w, 0); g.addColorStop(0, c[1]); g.addColorStop(0.25, c[0]); g.addColorStop(0.75, c[0]); g.addColorStop(1, c[1]);
                ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(T.x, T.y + T.h); ctx.ellipse(cx, T.y + T.h, T.w / 2, ry, 0, Math.PI, 0, true); ctx.lineTo(T.x + T.w, T.y); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(cx, T.y, T.w / 2, ry, 0, 0, TAU); ctx.fill();            // cara superior
                // glaseado que gotea
                var nd = Math.max(5, Math.round(T.w / (L.Wc * 0.075))), dw = T.w / nd; ctx.fillStyle = '#fffaf6';
                ctx.beginPath(); ctx.moveTo(T.x, T.y);
                for (k = 0; k < nd; k++) {
                    var xa = T.x + k * dw, xb = xa + dw, xm = (xa + xb) / 2, lg = T.h * (0.1 + 0.14 * (0.5 + 0.5 * Math.sin(k * 2.7 + i * 1.3)));
                    var ya = T.y + ry * Math.sqrt(Math.max(0, 1 - Math.pow((xa - cx) / (T.w / 2), 2))), yb = T.y + ry * Math.sqrt(Math.max(0, 1 - Math.pow((xb - cx) / (T.w / 2), 2)));
                    var ym = T.y + ry * Math.sqrt(Math.max(0, 1 - Math.pow((xm - cx) / (T.w / 2), 2)));
                    ctx.lineTo(xa, ya); ctx.bezierCurveTo(xa, ym + lg, xb, ym + lg, xb, yb);
                }
                ctx.lineTo(T.x + T.w, T.y); ctx.ellipse(cx, T.y, T.w / 2, ry, 0, 0, Math.PI, true); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(cx, T.y, T.w / 2, ry, 0, 0, TAU); ctx.fill();
                // perlas en la base
                var np = Math.max(8, Math.round(T.w / (L.Wc * 0.05))), rp = L.Wc * 0.016; ctx.fillStyle = '#fffaf6';
                for (k = 0; k <= np; k++) { var px = T.x + (k / np) * T.w, py = T.y + T.h + ry * Math.sqrt(Math.max(0, 1 - Math.pow((px - cx) / (T.w / 2), 2))); ctx.beginPath(); ctx.arc(px, py - rp, rp, 0, TAU); ctx.fill(); }
                // sprinkles
                sprinkles.forEach(function (sp) { if (sp.tier !== i) return; ctx.save(); ctx.translate(T.x + sp.x * T.w, T.y + T.h * (0.2 + 0.7 * sp.y)); ctx.rotate(sp.r); ctx.fillStyle = sp.c; ctx.fillRect(-3, -1, 6, 2); ctx.restore(); });
            }
        }
        function velas(ctx, L, t) {
            var T = L.tiers[2], sd = T.w * 0.5, digitos = ['4', '0'], i;
            for (i = 0; i < 2; i++) {
                var x = L.cx + (i ? 1 : -1) * sd * 0.36, y = T.y + T.ry * 0.3, l = t - (tVelas + i * 0.3);
                var al = clamp((t - (tVelas - 0.4 + i * 0.2)) / 0.5, 0, 1);
                ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y + (1 - al) * -10);
                ctx.font = 'bold ' + Math.round(sd) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
                var g = ctx.createLinearGradient(0, -sd, 0, 0); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#ff9ec0'); g.addColorStop(1, '#ffd166');
                ctx.lineWidth = Math.max(2, sd * 0.05); ctx.strokeStyle = '#b3446b'; ctx.strokeText(digitos[i], 0, 0); ctx.fillStyle = g; ctx.fillText(digitos[i], 0, 0);
                if (l > 0) {                                                       // llama
                    var fa = clamp(l / 0.4, 0, 1), fl = 1 + 0.12 * Math.sin(t * 17 + i * 2) + 0.06 * Math.sin(t * 29), fy = -sd * 1.0, fr = sd * 0.1;
                    ctx.globalCompositeOperation = 'lighter';
                    var gl = ctx.createRadialGradient(0, fy, 0, 0, fy, sd * 0.8 * fl); gl.addColorStop(0, 'rgba(255,200,90,' + (0.6 * fa) + ')'); gl.addColorStop(1, 'rgba(255,150,40,0)');
                    ctx.fillStyle = gl; ctx.fillRect(-sd, fy - sd, sd * 2, sd * 2);
                    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al * fa;
                    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(0, fy, fr * 0.9 * fl, fr * 1.9 * fl, 0, 0, TAU); ctx.fill();
                    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(0, fy + fr * 0.3, fr * 0.45 * fl, fr * 1.0 * fl, 0, 0, TAU); ctx.fill();
                }
                ctx.restore();
            }
        }
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            var L = disposicion(w, h), j2, i;
            var fondo = ctx.createLinearGradient(0, 0, 0, h); fondo.addColorStop(0, '#fff6ee'); fondo.addColorStop(1, '#ffdce6'); ctx.fillStyle = fondo; ctx.fillRect(0, 0, w, h);
            bokeh.forEach(function (b) { ctx.globalAlpha = 0.22; ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc((b.x + Math.sin(t * b.v + b.ph) * 0.03) * w, ((b.y + t * b.v * 0.3) % 1.1) * h, b.r * Math.min(w, h), 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
            // guirnalda de banderines
            var sag = h * 0.045, n = 14, bw = w / n;
            ctx.strokeStyle = 'rgba(160,100,110,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath();
            for (i = 0; i <= 40; i++) { var u = i / 40, gy = h * 0.012 + Math.sin(u * Math.PI) * sag; if (i === 0) ctx.moveTo(u * w, gy); else ctx.lineTo(u * w, gy); } ctx.stroke();
            for (i = 0; i < n; i++) {
                var u0 = (i + 0.5) / n, gy0 = h * 0.012 + Math.sin(u0 * Math.PI) * sag, sw = Math.sin(t * 1.4 + i) * bw * 0.05;
                ctx.fillStyle = pasteles[i % pasteles.length]; ctx.beginPath(); ctx.moveTo(u0 * w - bw * 0.36, gy0); ctx.lineTo(u0 * w + bw * 0.36, gy0); ctx.lineTo(u0 * w + sw, gy0 + bw * 0.78); ctx.closePath(); ctx.fill();
            }
            var mesa = ctx.createLinearGradient(0, L.base, 0, h); mesa.addColorStop(0, '#f6d9c4'); mesa.addColorStop(1, '#e9bfa6'); ctx.fillStyle = mesa; ctx.fillRect(0, L.base + L.Wc * 0.03, w, h);
            tarta(ctx, L, t);
            // fotos ya colocadas (y la que vuela hacia su sitio)
            var heroS = L.hs;
            for (j2 = 0; j2 < N; j2++) {
                var f = fotos[j2], l = t - f.T; if (l < 0) break;
                var sl = slotDe(L, j2), img = fotoDe(imgs, f.idx);
                if (l >= VUELO_TOTAL) {
                    var pop = 1 + 0.08 * Math.max(0, 1 - (l - VUELO_TOTAL) / 0.35) * Math.abs(Math.sin((l - VUELO_TOTAL) * 14));
                    decoracion(ctx, img, sl.x, sl.y, L.r * pop, 1);
                    zonas.push({ i: f.idx, x: sl.x, y: sl.y, r: L.r + 6 });
                    if (l - VUELO_TOTAL < 0.6) {                                                   // chispitas al aterrizar
                        var a = (l - VUELO_TOTAL) / 0.6; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,225,140,' + ((1 - a) * 0.9).toFixed(3) + ')'; ctx.lineWidth = 2;
                        for (i = 0; i < 8; i++) { var an = i / 8 * TAU, r1 = L.r * (1 + a * 1.6), r2 = L.r * (1.3 + a * 2.4); ctx.beginPath(); ctx.moveTo(sl.x + Math.cos(an) * r1, sl.y + Math.sin(an) * r1); ctx.lineTo(sl.x + Math.cos(an) * r2, sl.y + Math.sin(an) * r2); ctx.stroke(); }
                        ctx.restore();
                    }
                }
            }
            for (j2 = 0; j2 < N; j2++) {                                                           // placa en primer plano
                var f2 = fotos[j2], l2 = t - f2.T; if (l2 < 0) break; if (l2 >= VUELO_TOTAL) continue;
                var s2 = slotDe(L, j2), im2 = fotoDe(imgs, f2.idx), x, y, S, rot = f2.rot, al = 1;
                if (l2 < DROP) { var u = l2 / DROP; x = L.hx; y = lerp(-heroS, L.hy, rebote(u)); S = heroS; al = Math.min(1, l2 / 0.15); }
                else if (l2 < DROP + SHOW) { var q = l2 - DROP; x = L.hx; y = L.hy + Math.sin(q * 2 + f2.ph) * heroS * 0.012; S = heroS * (1 + 0.018 * Math.sin(q * 3 + f2.ph)); rot = f2.rot + Math.sin(q * 1.3 + f2.ph) * 0.03; }
                else { var v = suave((l2 - DROP - SHOW) / FLY); x = lerp(L.hx, s2.x, v); y = lerp(L.hy, s2.y, v) - Math.sin(v * Math.PI) * heroS * 0.18; S = lerp(heroS, L.r * 2, v); rot = lerp(f2.rot, 0, v); al = 1 - clamp((v - 0.55) / 0.45, 0, 1); decoracion(ctx, im2, x, y, S / 2 * 0.98, clamp((v - 0.45) / 0.55, 0, 1)); }
                placa(ctx, im2, x, y, S, rot, al);
                if (al > 0.5) zonas.push({ i: f2.idx, x: x, y: y, w: S, h: S, rot: rot });
            }
            if (t >= tVelas - 0.5) {
                velas(ctx, L, t);
                var bt = clamp((t - (tVelas + 1.0)) / 0.9, 0, 1);
                if (bt > 0) {
                    var sz = Math.min(w * 0.13, 60) * (0.7 + 0.3 * rebote(bt));
                    ctx.save(); ctx.globalAlpha = bt; ctx.font = 'bold ' + Math.round(sz) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.lineWidth = sz * 0.14; ctx.strokeStyle = '#fff'; ctx.strokeText(txtTarta, L.bx, L.by + sz * 0.6); ctx.fillStyle = '#d6336c'; ctx.fillText(txtTarta, L.bx, L.by + sz * 0.6); ctx.restore();
                }
                for (i = 0; i < confeti.length; i++) {
                    var c = confeti[i], cy = (((c.ph + (t - tVelas) * c.v) % 1) * (h + 40)) - 20, cxx = (c.x + Math.sin(t * 0.9 + c.ph * 9) * 0.03) * w, ee = Math.abs(Math.cos(t * c.sp + c.ph * 7));
                    if (t < tVelas) continue;
                    ctx.fillStyle = c.c; ctx.save(); ctx.translate(cxx, cy); ctx.rotate(t * c.sp); ctx.fillRect(-c.w / 2, -c.w * ee / 2, c.w, Math.max(1, c.w * ee)); ctx.restore();
                }
            }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'pasteleria', zonas: zonas, layout: disposicion };
    }

    /* ======================================================================
       EFECTO: TEATRO DEL CASTILLO DE CUENTO
       Se abre el telón sobre un castillo de cuento con fuegos artificiales y
       las fotos llegan en estelas mágicas desde la torre más alta.
       ====================================================================== */
    function estrella4(ctx, x, y, r, a) {
        if (a <= 0.01 || r <= 0.3) return;
        ctx.globalAlpha = Math.min(1, a);
        ctx.beginPath();
        ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
        ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
        ctx.fill();
    }
    function salidaAtras(x) { x = clamp(x, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
    function ventanaArco(c, x, y, s) {
        c.fillStyle = '#ffd98a'; c.beginPath(); c.moveTo(x - s, y + s * 1.6); c.lineTo(x - s, y); c.arc(x, y, s, Math.PI, 0); c.lineTo(x + s, y + s * 1.6); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(120,60,120,0.5)'; c.lineWidth = Math.max(0.6, s * 0.18);
        c.beginPath(); c.moveTo(x, y - s); c.lineTo(x, y + s * 1.6); c.stroke();
    }
    function techoCono(c, x, yb, wb, hh) {
        var g = c.createLinearGradient(x - wb / 2, 0, x + wb / 2, 0);
        g.addColorStop(0, '#3f9bf0'); g.addColorStop(0.55, '#1f64c8'); g.addColorStop(1, '#14327a');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - wb / 2, yb);
        c.quadraticCurveTo(x - wb * 0.18, yb - hh * 0.55, x, yb - hh);
        c.quadraticCurveTo(x + wb * 0.18, yb - hh * 0.55, x + wb / 2, yb);
        c.quadraticCurveTo(x, yb + wb * 0.08, x - wb / 2, yb); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(190,225,255,0.35)'; c.lineWidth = Math.max(1, wb * 0.03);
        c.beginPath(); c.moveTo(x - wb * 0.28, yb - hh * 0.06); c.quadraticCurveTo(x - wb * 0.1, yb - hh * 0.5, x - wb * 0.01, yb - hh * 0.93); c.stroke();
        c.strokeStyle = '#f2c14b'; c.lineWidth = Math.max(1, wb * 0.05);
        c.beginPath(); c.moveTo(x - wb / 2, yb); c.lineTo(x + wb / 2, yb); c.stroke();
        c.lineWidth = Math.max(1, wb * 0.025); c.beginPath(); c.moveTo(x, yb - hh); c.lineTo(x, yb - hh - wb * 0.28); c.stroke();
        c.fillStyle = '#f7cf4a'; c.beginPath(); c.arc(x, yb - hh, Math.max(1.5, wb * 0.07), 0, TAU); c.fill();
        c.fillStyle = '#ff5fa2'; c.beginPath(); c.moveTo(x, yb - hh - wb * 0.28); c.lineTo(x + wb * 0.22, yb - hh - wb * 0.22); c.lineTo(x, yb - hh - wb * 0.16); c.closePath(); c.fill();
    }
    function torreCuerpo(c, x, yb, wb, hb) {
        var g = c.createLinearGradient(x - wb / 2, 0, x + wb / 2, 0);
        g.addColorStop(0, '#f6d7ea'); g.addColorStop(0.6, '#d9a9d6'); g.addColorStop(1, '#9777c0');
        c.fillStyle = g; c.fillRect(x - wb / 2, yb - hb, wb, hb);
        c.fillStyle = '#f2c14b'; c.fillRect(x - wb * 0.58, yb - hb - wb * 0.06, wb * 1.16, wb * 0.12);
        for (var wy = yb - hb * 0.3; wy > yb - hb + wb * 0.9; wy -= wb * 1.5) ventanaArco(c, x, wy, wb * 0.15);
    }
    function geomCastillo(w, h) {
        var cw = Math.min(w * 0.92, h * 0.73);
        return { gy: h * 0.78, u: cw / 100, cx: w / 2 };
    }
    var TORRES = [[-43, 8, 22, 17], [43, 8, 22, 17], [-31, 9, 30, 21], [31, 9, 30, 21], [-18, 10, 40, 24], [18, 10, 40, 24], [-8.5, 4.5, 52, 19], [8.5, 4.5, 52, 19], [0, 13, 54, 31]];
    function pintarDecorado(c, w, h) {
        var G = geomCastillo(w, h), gy = G.gy, u = G.u, cx = G.cx, i, g;
        g = c.createLinearGradient(0, gy - h * 0.14, 0, gy + h * 0.03); g.addColorStop(0, '#3a2a6e'); g.addColorStop(1, '#1d1442');
        c.fillStyle = g; c.beginPath(); c.moveTo(0, gy + h * 0.03); c.lineTo(0, gy - h * 0.05);
        c.bezierCurveTo(w * 0.2, gy - h * 0.13, w * 0.35, gy - h * 0.02, w * 0.5, gy - h * 0.06);
        c.bezierCurveTo(w * 0.65, gy - h * 0.1, w * 0.8, gy - h * 0.12, w, gy - h * 0.04);
        c.lineTo(w, gy + h * 0.03); c.closePath(); c.fill();
        var gw = c.createLinearGradient(cx - 46 * u, 0, cx + 46 * u, 0);
        gw.addColorStop(0, '#e9c4e2'); gw.addColorStop(0.5, '#d2a2d2'); gw.addColorStop(1, '#8f70b8');
        c.fillStyle = gw; c.fillRect(cx - 46 * u, gy - 14 * u, 92 * u, 14 * u);
        c.fillStyle = '#c796cc';
        for (i = -22; i < 22; i++) c.fillRect(cx + i * 2.1 * u, gy - 16.2 * u, 1.2 * u, 2.2 * u);
        for (i = 0; i < TORRES.length; i++) {
            var T = TORRES[i], tx = cx + T[0] * u;
            torreCuerpo(c, tx, gy, T[1] * u, T[2] * u);
            techoCono(c, tx, gy - T[2] * u - T[1] * u * 0.06, T[1] * u * 1.28, T[3] * u);
        }
        c.fillStyle = '#2a1646'; c.beginPath(); c.moveTo(cx - 6 * u, gy); c.lineTo(cx - 6 * u, gy - 8 * u); c.arc(cx, gy - 8 * u, 6 * u, Math.PI, 0); c.lineTo(cx + 6 * u, gy); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,200,120,0.55)'; c.beginPath(); c.moveTo(cx - 4 * u, gy); c.lineTo(cx - 4 * u, gy - 7.5 * u); c.arc(cx, gy - 7.5 * u, 4 * u, Math.PI, 0); c.lineTo(cx + 4 * u, gy); c.closePath(); c.fill();
        for (i = -6; i <= 6; i++) ventanaArco(c, cx + i * 6.4 * u, gy - 8.5 * u, 0.9 * u);
        var bru = c.createLinearGradient(0, gy - h * 0.03, 0, gy + h * 0.02); bru.addColorStop(0, 'rgba(180,120,200,0)'); bru.addColorStop(1, 'rgba(180,120,200,0.35)');
        c.fillStyle = bru; c.fillRect(0, gy - h * 0.03, w, h * 0.05);
        c.fillStyle = '#150c2e';
        for (i = 0; i < 9; i++) { var bx = w * (0.04 + i * 0.12 + ((i * 37) % 7) * 0.004); c.beginPath(); c.arc(bx, gy + h * 0.012, h * (0.022 + (i % 3) * 0.006), Math.PI, 0); c.fill(); }
        g = c.createLinearGradient(0, gy, 0, h * 0.93); g.addColorStop(0, '#4a2c1a'); g.addColorStop(1, '#170c06');
        c.fillStyle = g; c.fillRect(0, gy, w, h * 0.93 - gy);
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
        for (i = -9; i <= 9; i++) { c.beginPath(); c.moveTo(cx + i * w * 0.03, gy); c.lineTo(cx + i * w * 0.16, h * 0.93); c.stroke(); }
        g = c.createRadialGradient(cx, gy, 2, cx, gy, w * 0.5); g.addColorStop(0, 'rgba(255,205,235,0.32)'); g.addColorStop(1, 'rgba(255,205,235,0)');
        c.fillStyle = g; c.fillRect(0, gy, w, h * 0.93 - gy);
    }
    function pintarMarco(c, w, h) {
        var hv = h * 0.115, cw = Math.max(6, w * 0.035), i, x;
        c.fillStyle = '#2a1608'; c.fillRect(0, 0, cw, h * 0.93); c.fillRect(w - cw, 0, cw, h * 0.93);
        c.fillStyle = '#d4a52f'; c.fillRect(cw - 2, 0, 2, h * 0.93); c.fillRect(w - cw, 0, 2, h * 0.93);
        var gv = c.createLinearGradient(0, 0, 0, hv * 1.5); gv.addColorStop(0, '#5a0a18'); gv.addColorStop(1, '#a3162f');
        c.fillStyle = gv; c.fillRect(0, 0, w, hv);
        var nf = Math.max(4, Math.round(w / (h * 0.16))), rw = w / nf;
        c.strokeStyle = '#e5b93c'; c.lineWidth = Math.max(1.5, h * 0.005);
        for (i = 0; i < nf; i++) {
            c.beginPath(); c.moveTo(i * rw, hv); c.quadraticCurveTo(i * rw + rw / 2, hv + rw * 0.55, (i + 1) * rw, hv); c.closePath(); c.fill(); c.stroke();
        }
        c.fillStyle = '#e5b93c'; c.fillRect(0, hv - h * 0.012, w, h * 0.012);
        for (i = 0; i <= nf; i++) {
            x = i * rw; c.fillStyle = '#f2c14b'; c.beginPath(); c.arc(x, hv + h * 0.006, h * 0.012, 0, TAU); c.fill();
            c.fillRect(x - h * 0.003, hv + h * 0.01, h * 0.006, h * 0.03);
        }
        c.fillStyle = '#07040c'; c.fillRect(0, h * 0.93, w, h * 0.07);
        c.fillStyle = '#d4a52f'; c.fillRect(0, h * 0.93, w, 2);
        c.fillStyle = '#030106';
        for (i = 0; i < nf * 3; i++) { x = (i + 0.5) * (w / (nf * 3)); c.beginPath(); c.arc(x, h * 0.995, h * (0.026 + (i % 2) * 0.007), Math.PI, 0); c.fill(); }
    }
    function crearCastillo(imgs, seed, opc) {
        var A = opc && opc.ajustes;
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd);
        var P = ajNum(A, 'cFotos', 3, 1, 3), INT = ajNum(A, 'cSeg', 6, 6, 30), VIDA = INT * 0.8, VUELO = 1.0, SAL = 0.8;
        var tTit = ajTxt(A, 'cTitulo', '40 AÑOS DE VANE', 36), tSub = ajTxt(A, 'cSub', 'Una función de recuerdos', 40);
        var tFinT = ajTxt(A, 'cFinTit', 'Fin de la función', 36), tFinS = ajTxt(A, 'cFinSub', 'Gracias por tanta magia', 40);
        var T_ABRE = 2.8, D_ABRE = 4.2, T_F = T_ABRE + D_ABRE + 0.6, D_CIERRA = 3.6;
        var K = Math.max(1, Math.ceil(N / P)), T_CIERRA = T_F + K * INT + 0.3, duracion = T_CIERRA + D_CIERRA + 1.8;
        var estrellas = crearEstrellas(rnd, 90), grupos = [], bursts = [], sonidos = [], capas = {}, zonas = [], k, j, i;
        for (k = 0; k < K; k++) {
            var cnt = Math.min(P, N - k * P), fotos = [];
            for (j = 0; j < cnt; j++) fotos.push({ idx: orden[k * P + j], slot: j, rot: (rnd() - 0.5) * 0.14, ph: rnd() * TAU, d: j * 0.55 });
            grupos.push({ t0: T_F + k * INT, flip: k % 2, fotos: fotos });
            for (j = 0; j < cnt; j++) {
                var ts = T_F + k * INT + j * 0.55;
                sonidos.push({ t: ts + 0.05, tipo: 'destello', v: 0.7 }, { t: ts + VUELO * 0.9, tipo: 'chime', v: 0.45 });
            }
        }
        var tb = T_ABRE + 1.2;
        while (tb < T_CIERRA + 0.5 && bursts.length < 160) {
            bursts.push({ t: tb, x: 0.14 + rnd() * 0.72, y: 0.15 + rnd() * 0.27, hue: Math.floor(rnd() * 360), R: 0.14 + rnd() * 0.08, off: rnd() * TAU });
            sonidos.push({ t: tb - 1.0, tipo: 'lanzar', v: 0.35 }, { t: tb, tipo: 'estallar', v: 0.35 });
            tb += 1.7 + rnd() * 0.6;
        }
        sonidos.push({ t: 0.6, tipo: 'chime', v: 0.6 }, { t: T_ABRE, tipo: 'whoosh', v: 0.8 }, { t: T_ABRE + 0.4, tipo: 'fanfarria', v: 0.6 },
            { t: T_CIERRA, tipo: 'whoosh', v: 0.8 }, { t: T_CIERRA + D_CIERRA * 0.8, tipo: 'premio', v: 0.7 });
        sonidos.sort(function (a, b) { return a.t - b.t; });

        function abre(t) {
            if (t < T_ABRE) return 0;
            if (t < T_ABRE + D_ABRE) return suave((t - T_ABRE) / D_ABRE);
            if (t < T_CIERRA) return 1;
            return 1 - suave((t - T_CIERRA) / D_CIERRA);
        }
        function capa(ctx, nombre, w, h, a, fn) {
            var key = w + 'x' + h + '@' + a, c = capas[nombre];
            if (!c || c.key !== key) {
                var cv = crearCanvas(Math.max(1, Math.round(w * a)), Math.max(1, Math.round(h * a)));
                if (!cv) { fn(ctx, w, h); return; }
                var cc = cv.getContext('2d'); cc.scale(a, a); fn(cc, w, h);
                c = capas[nombre] = { key: key, cv: cv };
            }
            ctx.drawImage(c.cv, 0, 0, w, h);
        }
        function tamFoto(w, h) { return (w <= h * 1.15) ? Math.min(w * 0.46, h * 0.25) : Math.min(h * 0.40, w * 0.21); }
        function slot(flip, s, w, h, cnt) {
            var vert = w <= h * 1.15, V, H;
            if (cnt >= 3) { V = [[0.30, 0.30], [0.70, 0.46], [0.33, 0.64]]; H = [[0.18, 0.46], [0.82, 0.46], [0.5, 0.68]]; }
            else if (cnt === 2) { V = [[0.34, 0.33], [0.66, 0.61]]; H = [[0.27, 0.46], [0.73, 0.46]]; }
            else { V = [[0.5, 0.46]]; H = [[0.5, 0.46]]; }
            var p = vert ? V[s] : H[s], fx = flip ? 1 - p[0] : p[0];
            if (cnt >= 3 && !vert && s === 2 && flip) fx = 0.5;
            return { x: w * fx, y: h * p[1] };
        }
        function facFotos(cnt) { return cnt >= 3 ? 1 : (cnt === 2 ? 1.12 : 1.3); }
        function telon(ctx, w, h, uAbre, t) {
            var hb = h * 0.93, F = 12, e = suave(uAbre);
            var xt0 = lerp(w * 0.5, w * 0.075, e), xb0 = lerp(w * 0.5, w * 0.04, Math.min(1, e * 1.12));
            var mov = (uAbre > 0.001 && uAbre < 0.999) ? Math.sin(t * 2.3) * w * 0.006 : 0, side, k2;
            for (side = 0; side < 2; side++) {
                ctx.save();
                if (side) { ctx.translate(w, 0); ctx.scale(-1, 1); }
                var xt = xt0 + mov, xb = xb0 + mov;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(xt, 0); ctx.lineTo(xb, hb); ctx.lineTo(0, hb); ctx.closePath(); ctx.clip();
                for (k2 = 0; k2 < F; k2++) {
                    var f0 = k2 / F, f1 = (k2 + 1) / F, sh = ((k2 % 2) ? 0.62 : 0.28) + 0.08 * Math.sin(k2 * 1.7 + t * (mov ? 0.9 : 0.1));
                    ctx.fillStyle = 'hsl(350,' + Math.round(68 + 12 * sh) + '%,' + Math.round(14 + 26 * sh) + '%)'; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.8;
                    ctx.beginPath(); ctx.moveTo(xt * f0, 0); ctx.lineTo(xt * f1, 0); ctx.lineTo(xb * f1, hb); ctx.lineTo(xb * f0, hb); ctx.closePath(); ctx.fill(); ctx.stroke();
                }
                var sombra = ctx.createLinearGradient(0, 0, 0, hb); sombra.addColorStop(0, 'rgba(0,0,0,0.05)'); sombra.addColorStop(1, 'rgba(0,0,0,0.5)');
                ctx.fillStyle = sombra; ctx.fillRect(0, 0, Math.max(xt, xb) + 2, hb);
                ctx.restore();
                ctx.save();
                if (side) { ctx.translate(w, 0); ctx.scale(-1, 1); }
                ctx.strokeStyle = '#e5b93c'; ctx.lineWidth = Math.max(2, w * 0.012);
                ctx.beginPath(); ctx.moveTo(xt, 0); ctx.lineTo(xb, hb); ctx.stroke();
                ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, hb - 2); ctx.lineTo(xb, hb - 2); ctx.stroke(); ctx.setLineDash([]);
                ctx.restore();
            }
        }
        function titulo(ctx, txt, x, y, px, maxW, alpha) {
            if (alpha <= 0.01) return;
            ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = 'bold ' + Math.round(px) + 'px Lora, Georgia, serif';
            var m = ctx.measureText(txt).width;
            if (m > maxW) { px *= maxW / m; ctx.font = 'bold ' + Math.round(px) + 'px Lora, Georgia, serif'; m = ctx.measureText(txt).width; }
            var g = ctx.createLinearGradient(x - m / 2, 0, x + m / 2, 0); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#f2c14b'); g.addColorStop(1, '#b8860b');
            ctx.fillStyle = g; ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = px * 0.2; ctx.shadowOffsetY = px * 0.05;
            ctx.fillText(txt, x, y); ctx.restore();
        }
        function fuegos(ctx, w, h, t) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (var b = 0; b < bursts.length; b++) {
                var B = bursts[b], age = t - B.t;
                if (age < 0 || age > 2.2) continue;
                var R = B.R * Math.min(w, h * 1.2), e = salidaCubica(age / 1.4), al = Math.pow(Math.max(0, 1 - age / 2.2), 1.5), bx = B.x * w, by = B.y * h;
                for (var q = 0; q < 26; q++) {
                    var ang = q * (TAU / 26) + B.off, sp = 0.55 + 0.45 * (((q * 7) % 5) / 4);
                    ctx.fillStyle = 'hsla(' + ((B.hue + (q % 2) * 40) % 360) + ',100%,68%,' + al.toFixed(3) + ')';
                    ctx.beginPath(); ctx.arc(bx + Math.cos(ang) * R * sp * e, by + Math.sin(ang) * R * sp * e + age * age * h * 0.02, 1.8, 0, TAU); ctx.fill();
                }
            }
            ctx.restore();
        }
        function dibujar(ctx, w, h, t) {
            zonas.length = 0;
            var a = ctx.getTransform ? ctx.getTransform().a : 1, G = geomCastillo(w, h), i2, s, e;
            var g = ctx.createLinearGradient(0, 0, 0, h * 0.8); g.addColorStop(0, '#0a0826'); g.addColorStop(0.55, '#2b1760'); g.addColorStop(1, '#8b3a86');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            for (i2 = 0; i2 < estrellas.length; i2++) {
                s = estrellas[i2]; e = 0.3 + 0.4 * Math.sin(t * s.f + s.ph);
                ctx.fillStyle = 'rgba(255,255,255,' + e.toFixed(3) + ')'; ctx.fillRect(s.x * w, s.y * h * 0.66, s.r, s.r);
            }
            var lr = Math.min(w, h) * 0.05, lg = ctx.createRadialGradient(w * 0.84, h * 0.24, lr * 0.4, w * 0.84, h * 0.24, lr * 3);
            lg.addColorStop(0, 'rgba(255,248,215,0.9)'); lg.addColorStop(0.3, 'rgba(255,240,190,0.25)'); lg.addColorStop(1, 'rgba(255,240,190,0)');
            ctx.fillStyle = lg; ctx.fillRect(w * 0.84 - lr * 3, h * 0.24 - lr * 3, lr * 6, lr * 6);
            ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(w * 0.84, h * 0.24, lr, 0, TAU); ctx.fill();
            var u = abre(t), st = t % 7;
            if (u > 0.2 && st < 1.0) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                var sx = w * (1.0 - 0.7 * st), sy = h * (0.14 + 0.28 * st), cola = ctx.createLinearGradient(sx, sy, sx + w * 0.16, sy - h * 0.06);
                cola.addColorStop(0, 'rgba(255,255,255,0.9)'); cola.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = cola; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + w * 0.16, sy - h * 0.06); ctx.stroke(); ctx.restore();
            }
            if (u > 0.05) fuegos(ctx, w, h, t);
            capa(ctx, 'dec', w, h, a, pintarDecorado);
            var punta = { x: G.cx, y: G.gy - 88 * G.u };
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            var pg = ctx.createRadialGradient(punta.x, punta.y, 1, punta.x, punta.y, G.u * 14), pul = 0.5 + 0.3 * Math.sin(t * 2.2);
            pg.addColorStop(0, 'rgba(255,230,160,' + pul.toFixed(3) + ')'); pg.addColorStop(1, 'rgba(255,230,160,0)');
            ctx.fillStyle = pg; ctx.fillRect(punta.x - G.u * 14, punta.y - G.u * 14, G.u * 28, G.u * 28);
            ctx.fillStyle = '#fff2b8';
            for (i2 = 0; i2 < 5; i2++) {
                var an = t * 0.8 + i2 * TAU / 5, rr = G.u * (6 + 2 * Math.sin(t * 1.3 + i2));
                estrella4(ctx, punta.x + Math.cos(an) * rr, punta.y + Math.sin(an) * rr * 0.8, G.u * 1.6, 0.4 + 0.5 * Math.sin(t * 3 + i2 * 2));
            }
            ctx.restore(); ctx.globalAlpha = 1;
            if (u > 0.3) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                for (i2 = 0; i2 < 2; i2++) {
                    var bx0 = i2 ? w * 0.94 : w * 0.06, foco = ctx.createLinearGradient(bx0, 0, w / 2, h * 0.7);
                    foco.addColorStop(0, 'rgba(255,240,200,' + (0.12 * u).toFixed(3) + ')'); foco.addColorStop(1, 'rgba(255,240,200,0)');
                    ctx.fillStyle = foco; ctx.beginPath(); ctx.moveTo(bx0 - w * 0.02, 0); ctx.lineTo(bx0 + w * 0.02, 0); ctx.lineTo(w * (0.5 + (i2 ? 0.28 : -0.28)), h * 0.8); ctx.lineTo(w * (0.5 + (i2 ? -0.1 : 0.1)), h * 0.8); ctx.closePath(); ctx.fill();
                }
                ctx.restore();
            }
            var S0 = tamFoto(w, h), S = S0, kmin = Math.max(0, Math.floor((t - T_F - VIDA - 1.5) / INT)), kmax = Math.min(K - 1, Math.floor((t - T_F) / INT));
            for (var kk = kmin; kk <= kmax; kk++) {
                var gp = grupos[kk];
                S = Math.min(S0 * facFotos(gp.fotos.length), h * 0.5, w * 0.8);
                for (j = 0; j < gp.fotos.length; j++) {
                    var f = gp.fotos[j], age = t - (gp.t0 + f.d);
                    if (age < 0 || age > VIDA) continue;
                    var p = slot(gp.flip, f.slot, w, h, gp.fotos.length), ee = clamp(age / VUELO, 0, 1), ez = salidaCubica(ee);
                    var cxp = (punta.x + p.x) / 2, cyp = Math.min(punta.y, p.y) - h * 0.12, mz = 1 - ez;
                    var px = mz * mz * punta.x + 2 * mz * ez * cxp + ez * ez * p.x, py = mz * mz * punta.y + 2 * mz * ez * cyp + ez * ez * p.y;
                    var sc = ee < 1 ? 0.15 + 0.85 * salidaAtras(ee) : 1, alpha = suave(ee * 3), fo = 1;
                    if (age > VIDA - SAL) { fo = Math.max(0, (VIDA - age) / SAL); alpha *= fo; sc *= 1 + (1 - fo) * 0.08; }
                    if (ee >= 1) py += Math.sin(t * 1.3 + f.ph) * S * 0.02;
                    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe9a0';
                    if (ee < 1) for (i2 = 1; i2 <= 10; i2++) {
                        var e2 = Math.max(0, ez - i2 * 0.04), m2 = 1 - e2;
                        estrella4(ctx, m2 * m2 * punta.x + 2 * m2 * e2 * cxp + e2 * e2 * p.x, m2 * m2 * punta.y + 2 * m2 * e2 * cyp + e2 * e2 * p.y, S * 0.07 * (1 - i2 / 11), 0.9 * (1 - i2 / 11));
                    }
                    var ag = age - VUELO;
                    if (ag > 0 && ag < 0.8) for (i2 = 0; i2 < 10; i2++) {
                        var an2 = i2 * TAU / 10 + f.ph, rr2 = S * 0.75 * salidaCubica(ag / 0.8);
                        estrella4(ctx, p.x + Math.cos(an2) * rr2, p.y + Math.sin(an2) * rr2, S * 0.06, 1 - ag / 0.8);
                    }
                    ctx.restore(); ctx.globalAlpha = 1;
                    pintarFoto(ctx, fotoDe(imgs, f.idx), px, py, S * sc, f.rot, alpha, 45, 0.25, zonas, f.idx);
                }
            }
            telon(ctx, w, h, u, t);
            capa(ctx, 'marco', w, h, a, pintarMarco);
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            var nl = Math.max(8, Math.round(w / (h * 0.06))), paso = w / nl;
            for (i2 = 0; i2 < nl; i2++) {
                var lx = (i2 + 0.5) * paso, ly = h * 0.93, la = 0.55 + 0.2 * Math.sin(t * 3 + i2 * 1.3), lgr = ctx.createRadialGradient(lx, ly, 1, lx, ly, h * 0.045);
                lgr.addColorStop(0, 'rgba(255,214,120,' + la.toFixed(3) + ')'); lgr.addColorStop(1, 'rgba(255,214,120,0)');
                ctx.fillStyle = lgr; ctx.fillRect(lx - h * 0.045, ly - h * 0.045, h * 0.09, h * 0.09);
            }
            ctx.restore();
            var ta = (t < T_ABRE + 1.0) ? 1 - suave((t - T_ABRE) / 1.0) : 0;
            if (t > T_CIERRA + D_CIERRA * 0.7) ta = suave((t - T_CIERRA - D_CIERRA * 0.7) / 1.0);
            if (ta > 0.01) {
                var fin = t > T_CIERRA;
                titulo(ctx, fin ? tFinT : tTit, w / 2, h * 0.44, Math.min(w * 0.09, h * 0.075), w * 0.8, ta);
                titulo(ctx, fin ? tFinS : tSub, w / 2, h * 0.52, Math.min(w * 0.045, h * 0.04), w * 0.7, ta * 0.9);
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff2b8';
                for (i2 = 0; i2 < 7; i2++) estrella4(ctx, w * (0.2 + 0.6 * ((i2 * 0.37 + t * 0.05) % 1)), h * (0.4 + 0.16 * Math.sin(t * 1.5 + i2 * 2.1)), Math.min(w, h) * 0.018, ta * (0.4 + 0.5 * Math.sin(t * 4 + i2)));
                ctx.restore(); ctx.globalAlpha = 1;
            }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: sonidos, musica: 'fantasia', zonas: zonas };
    }

    /* ======================================================================
       EFECTO: BINGO DE RECUERDOS (juego sincronizado)
       Todos los móviles ven la misma foto en el mismo instante (orden fijo por
       semilla). Cada móvil tiene su cartón y marca con un toque. «Línea» y
       «Bingo» se comparten por Firestore (config_sistema/bingo-<semilla>).
       ====================================================================== */
    var BING = {};
    function idDispositivo() {
        try {
            var id = global.localStorage && global.localStorage.getItem('vane_bingo_id');
            if (!id) { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); global.localStorage.setItem('vane_bingo_id', id); }
            return id;
        } catch (e) { /* sin almacenamiento: id solo de esta sesión */ }
        if (!BING.__id) BING.__id = Math.random().toString(36).slice(2, 12);
        return BING.__id;
    }
    function servAhora() {
        try { if (typeof ahoraServidor === 'function') { var v = ahoraServidor(); if (isFinite(v)) return v; } } catch (e) { /* reloj local */ }
        return Date.now();
    }
    function vigente(d, t) {
        if (!d || typeof d.t !== 'number' || typeof d.serv !== 'number') return false;
        var edadReal = (servAhora() - d.serv) / 1000, edadEf = t - d.t;
        return edadEf > -5 && Math.abs(edadReal - edadEf) <= 3 + 0.05 * Math.max(0, edadEf);
    }
    function hablar(txt) {
        try {
            var s = global.speechSynthesis; if (!s || !global.SpeechSynthesisUtterance) return;
            var u = new global.SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.pitch = 1.15; s.cancel(); s.speak(u);
        } catch (e) { /* ignorar */ }
    }
    function audible(cv) { return !!cv && !cv.muted && !cv.paused; }
    function volSala(cv) { return clamp((cv.volume == null ? 1 : cv.volume) * (cv.volumenEfectos == null ? 1 : cv.volumenEfectos), 0, 1); }
    function volLocal(cv) { return (cv && cv.volumenEfectos === 0) ? 0 : 0.85; }
    function estadoBingo(clave) {
        var S = BING[clave];
        if (!S) S = BING[clave] = { id: '', alias: '', marcas: {}, nMarcas: 0, ev: { linea: null, bingo: null }, doc: null, viejos: {}, ultimoT: 0, canal: null, sonado: {}, bolaSonada: -1, cuenta: 99, sacudida: {}, aviso: null };
        return S;
    }
    function reiniciarBingo(S) {
        ['linea', 'bingo'].forEach(function (k) {
            if (S.ev[k]) S.viejos[S.ev[k].serv] = true;
            if (S.doc && S.doc[k]) S.viejos[S.doc[k].serv] = true;
            S.ev[k] = null;
        });
        S.marcas = {}; S.nMarcas = 0; S.sonado = {}; S.bolaSonada = -1; S.cuenta = 99; S.sacudida = {}; S.aviso = null;
    }
    function abrirCanal(S, clave) {
        if (S.canal) return;
        S.canal = { ref: null };
        try {
            var fb = global.firebase;
            if (fb && fb.apps && fb.apps.length && fb.firestore) {
                S.canal.ref = fb.firestore().collection('config_sistema').doc('bingo-' + clave);
                S.canal.ref.onSnapshot(function (snap) { S.doc = snap.exists ? snap.data() : null; }, function () { /* sin permisos o sin red: se juega en local */ });
            }
        } catch (e) { S.canal.ref = null; }
    }
    function actualizarEventos(S, t) {
        ['linea', 'bingo'].forEach(function (k) {
            var d = S.doc && S.doc[k];
            if (d && !S.viejos[d.serv] && vigente(d, t) && (!S.ev[k] || S.ev[k].serv !== d.serv)) S.ev[k] = d;
        });
    }
    function reclamar(S, tipo, t) {
        if (S.ev[tipo]) return;
        var e = { t: t, serv: servAhora(), por: S.alias, dev: S.id };
        S.ev[tipo] = e;
        try { if (global.navigator && global.navigator.vibrate) global.navigator.vibrate([120, 60, 120]); } catch (x) { /* ignorar */ }
        var ref = S.canal && S.canal.ref;
        if (!ref) return;
        try {
            global.firebase.firestore().runTransaction(function (tx) {
                return tx.get(ref).then(function (snap) {
                    var d = snap.exists ? snap.data() : null;
                    if (d && d[tipo] && vigente(d[tipo], S.ultimoT) && d[tipo].dev !== S.id) return;
                    var o = {}; o[tipo] = e; tx.set(ref, o, { merge: true });
                });
            }).catch(function () { /* se queda en local */ });
        } catch (x) { /* ignorar */ }
    }
    function crearBingo(imgs, seed, opc) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), posSalida = [], i;
        for (i = 0; i < N; i++) posSalida[orden[i]] = i;
        var A = opc && opc.ajustes;
        var T0 = ajNum(A, 'bCuenta', 6, 3, 30), PAUSA = 5, FINAL = 14, INT = 5, D = Number(opc && opc.duracion), segF = ajNum(A, 'bSeg', null, 3, 14);
        if (segF) INT = segF;                                              // si se indica, manda sobre la duración total
        else if (D >= 10) INT = clamp((D - T0 - PAUSA - FINAL) / N, 3, 14);
        var tTit = ajTxt(A, 'bTitulo', 'BINGO DE RECUERDOS', 30), tPrep = ajTxt(A, 'bPrepara', '¡Prepara tu cartón!', 30), tLinea = ajTxt(A, 'bLinea', '¡LÍNEA!', 14), tBingo = ajTxt(A, 'bBingo', '¡BINGO!', 14), tFin = ajTxt(A, 'bFin', '¡Se acabaron las fotos!', 30);
        var duracion = T0 + N * INT + PAUSA + FINAL;
        var clave = String(seed), S = estadoBingo(clave);
        S.id = idDispositivo(); S.alias = 'Cartón nº ' + (10 + hash(S.id) % 90);
        abrirCanal(S, clave);
        var cCols = ajNum(A, 'bCols', 5, 1, 5), cFilas = ajNum(A, 'bFilas', 3, 1, 5);
        var n = Math.min(cCols * cFilas, N), cols = Math.min(cCols, n), filas = Math.ceil(n / cols);
        var carton = barajar(N, rngDe(hash(S.id + ':' + clave))).slice(0, n);
        var celdas = [], zonas = [], canvasAct = null, rc = rngDe((seed ^ 0x5bd1e995) >>> 0), conf = [], estrellas = crearEstrellas(rc, 60);
        for (i = 0; i < 90; i++) conf.push({ x: rc(), y0: -0.35 * rc(), v: 0.16 + rc() * 0.3, s: 1 + rc() * 3, ph: rc() * TAU, hue: Math.floor(rc() * 360), w: 5 + rc() * 6 });

        function bolaActual(g) { return Math.max(-1, Math.min(N - 1, Math.floor((g - T0) / INT))); }
        function tJuego(t) {
            var B = S.ev.bingo, L = S.ev.linea;
            if (B && t >= B.t) t = B.t;
            if (!L || t < L.t) return t;
            return t < L.t + PAUSA ? L.t : t - PAUSA;
        }
        function filaCompleta(r, bi) {
            var cnt = 0;
            for (var c = 0; c < cols; c++) {
                var k = r * cols + c; if (k >= n) continue;
                var p = carton[k]; cnt++;
                if (typeof S.marcas[p] !== 'number' || posSalida[p] > bi) return false;
            }
            return cnt > 0;
        }
        function comprobar(t) {
            var bi = bolaActual(tJuego(t)), r, k, todo = true, linea = false;
            for (r = 0; r < filas; r++) if (filaCompleta(r, bi)) linea = true;
            for (k = 0; k < n; k++) if (typeof S.marcas[carton[k]] !== 'number' || posSalida[carton[k]] > bi) todo = false;
            if (todo) reclamar(S, 'bingo', t);
            else if (linea && !S.ev.linea) reclamar(S, 'linea', t);
        }
        // Abre la foto en grande (el visor de la web escucha el evento «fotoclick» del canvas)
        function ampliar(idx) {
            var cv = canvasAct; if (!cv || idx == null || idx < 0) return;
            try { cv.dispatchEvent(new global.CustomEvent('fotoclick', { detail: { idx: idx, img: fotoDe(imgs, idx) } })); } catch (e) { /* ignorar */ }
        }
        function celdaEn(x, y) {
            for (var i2 = 0; i2 < celdas.length; i2++) { var q = celdas[i2]; if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return q; }
            return null;
        }
        // Pulsación larga sobre una casilla del cartón: ver la foto en grande sin marcarla
        function pulsarLargo(x, y) {
            var c = celdaEn(x, y);
            if (!c) return false;
            ampliar(c.idx);
            return true;
        }
        function pulsar(x, y) {
            var cv = canvasAct, t = S.ultimoT, c = celdaEn(x, y);
            if (!cv || !c) return;
            var B = S.ev.bingo, L = S.ev.linea;
            // Casilla ya marcada, juego en pausa o cantando línea/bingo: el toque amplía la foto
            if (cv.paused || (B && t >= B.t) || (L && t >= L.t && t < L.t + PAUSA) || typeof S.marcas[c.idx] === 'number') { ampliar(c.idx); return; }
            var bi = bolaActual(tJuego(t));
            if (bi < 0 || posSalida[c.idx] > bi) {
                S.sacudida[c.idx] = t; S.aviso = { txt: '¡Esa foto aún no ha salido!', t: t };
                if (audible(cv)) sonar('broma', volSala(cv), 1, 'fotos-bingo');            // el sonido solo en el dispositivo con el sonido activado (admin o visor principal)
                enviarBroma();                                              // pero todos ven el aviso de quién se ha equivocado
                return;
            }
            S.marcas[c.idx] = t; S.nMarcas++;
            sonar('pop', volLocal(cv), 1.4, 'fotos-bingo');
            comprobar(t);
        }
        // Aviso a todos: quien se equivoca lo anuncia por Firestore (como mucho una vez cada 2,5 s)
        function enviarBroma() {
            var ahora = Date.now(); if (ahora - (S.ultBroma || 0) < 2500) return;
            S.ultBroma = ahora;
            var ref = S.canal && S.canal.ref; if (!ref) return;
            try { ref.set({ broma: { serv: servAhora(), por: S.alias, dev: S.id } }, { merge: true }).catch(function () { /* se queda en local */ }); } catch (x) { /* ignorar */ }
        }
        function audioJuego(cv, t, g, bi, L, B) {
            var ok = audible(cv);
            var M = S.doc && S.doc.broma;                                   // aviso visible en todos; el sonido solo en el dispositivo que no esté silenciado (evita ecos)
            if (M && typeof M.serv === 'number' && M.dev !== S.id && !S.sonado['M' + M.serv] && Math.abs(servAhora() - M.serv) < 6000) {
                S.sonado['M' + M.serv] = 1;
                if (ok) sonar('broma', volSala(cv), 1, 'fotos-bingo');
                S.aviso = { txt: String(M.por || 'Alguien').slice(0, 20) + ' se ha equivocado 😅', t: t };
            }
            if (g < T0) { var cu = Math.ceil(T0 - g); if (cu <= 3 && cu !== S.cuenta) { S.cuenta = cu; if (ok) sonar('click', volSala(cv), 1, 'fotos-bingo'); } }
            if (bi > S.bolaSonada) { if (bi === S.bolaSonada + 1 && ok) sonar('bola', volSala(cv), 1, 'fotos-bingo'); S.bolaSonada = bi; }
            if (L && !S.sonado['L' + L.serv]) {
                S.sonado['L' + L.serv] = 1;
                if (ok && t - L.t < 3) { sonar('linea', volSala(cv), 1, 'fotos-bingo'); hablar('¡Línea!'); }
            }
            if (B && !S.sonado['B' + B.serv]) {
                S.sonado['B' + B.serv] = 1;
                if (ok && t - B.t < 3) { sonar('bingo', volSala(cv), 1, 'fotos-bingo'); hablar('¡Bingo!'); }
            }
        }
        function texto(ctx, txt, x, y, px, color, align, serif, maxW) {
            var fam = serif ? 'Lora, Georgia, serif' : 'Montserrat, system-ui, sans-serif';
            ctx.font = (serif ? 'bold ' : '600 ') + Math.round(px) + 'px ' + fam;
            if (maxW) { var mw = ctx.measureText(txt).width; if (mw > maxW) { px = px * maxW / mw; ctx.font = (serif ? 'bold ' : '600 ') + Math.max(8, Math.round(px)) + 'px ' + fam; } }
            ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(txt, x, y);
        }
        function miniatura(ctx, img, x, y, s) {
            ctx.fillStyle = '#fdfdfd'; ctx.fillRect(x, y, s, s);
            var b = s * 0.08, cj = cajaFoto(img, s - 2 * b, s - 2 * b);
            if (img) ctx.drawImage(img, x + (s - cj.w) / 2, y + (s - cj.h) / 2, cj.w, cj.h);
        }
        function celda(ctx, x, y, cs, idx, t) {
            var m = cs * 0.05, sa = typeof S.sacudida[idx] === 'number' ? t - S.sacudida[idx] : 9, dx = sa < 0.5 ? Math.sin(sa * 55) * cs * 0.06 * (1 - sa / 0.5) : 0;
            ctx.save(); ctx.translate(x + dx, y);
            ctx.fillStyle = '#fff8e7'; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = cs * 0.06;
            ctx.fillRect(m, m, cs - 2 * m, cs - 2 * m); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
            var img = fotoDe(imgs, idx), lado = cs - 2 * m - cs * 0.08, cj = cajaFoto(img, lado, lado);
            if (img) ctx.drawImage(img, (cs - cj.w) / 2, (cs - cj.h) / 2, cj.w, cj.h);
            else { ctx.fillStyle = '#1e293b'; ctx.fillRect((cs - lado) / 2, (cs - lado) / 2, lado, lado); }
            if (typeof S.marcas[idx] === 'number') {
                var ma = t - S.marcas[idx], sc = ma < 0.3 ? 1.8 - 0.8 * salidaCubica(ma / 0.3) : 1, rr = cs * 0.4 * sc;
                var rg = ctx.createRadialGradient(cs / 2, cs / 2, cs * 0.05, cs / 2, cs / 2, rr);
                rg.addColorStop(0, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.35, 'rgba(236,72,153,0.55)'); rg.addColorStop(1, 'rgba(190,24,93,0.75)');
                ctx.globalAlpha = ma < 0.3 ? 0.4 + 0.6 * (ma / 0.3) : 1; ctx.fillStyle = rg;
                ctx.beginPath(); ctx.arc(cs / 2, cs / 2, rr, 0, TAU); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1.5, cs * 0.03); ctx.stroke(); ctx.globalAlpha = 1;
            }
            if (sa < 0.5) { ctx.fillStyle = 'rgba(239,68,68,' + (0.5 * (1 - sa / 0.5)).toFixed(3) + ')'; ctx.fillRect(m, m, cs - 2 * m, cs - 2 * m); }
            ctx.restore();
        }
        function cantar(ctx, w, h, age, txt, sub, bingo) {
            var dim = bingo ? 0.45 * Math.min(1, age * 3) : 0.55 * Math.min(1, age * 4) * (age > PAUSA ? Math.max(0, 1 - (age - PAUSA) / 0.6) : 1);
            ctx.fillStyle = 'rgba(2,6,23,' + dim.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h);
            var cx = w / 2, cy = h * 0.42, i2;
            if (bingo) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy); ctx.rotate(age * 0.25);
                for (i2 = 0; i2 < 16; i2++) {
                    ctx.rotate(TAU / 16); ctx.fillStyle = 'hsla(' + (i2 * 22 + age * 40) % 360 + ',100%,65%,0.16)';
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(w, h), -h * 0.05); ctx.lineTo(Math.max(w, h), h * 0.05); ctx.closePath(); ctx.fill();
                }
                ctx.restore();
            }
            for (i2 = 0; i2 < (bingo ? 90 : 60); i2++) {
                var c = conf[i2], a = bingo ? (age + c.ph) % 7 : age, px = c.x * w + Math.sin(a * c.s + c.ph) * w * 0.03, py = (c.y0 + a * c.v) * h;
                if (py < -10 || py > h + 10) continue;
                ctx.save(); ctx.translate(px, py); ctx.rotate(a * c.s + c.ph); ctx.fillStyle = 'hsl(' + c.hue + ',90%,60%)'; ctx.fillRect(-c.w / 2, -c.w / 4, c.w, c.w / 2); ctx.restore();
            }
            var px2 = Math.min(w * 0.19, h * 0.17) * (1 + 0.05 * Math.sin(age * 8)) * salidaAtras(Math.min(1, age / 0.45));
            ctx.save(); ctx.font = 'bold ' + Math.round(px2) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            var mw2 = ctx.measureText(txt).width; if (mw2 > w * 0.9) { px2 *= w * 0.9 / mw2; ctx.font = 'bold ' + Math.round(px2) + 'px Lora, Georgia, serif'; }
            var gr = ctx.createLinearGradient(cx - px2 * 2, 0, cx + px2 * 2, 0); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.5, '#f2c14b'); gr.addColorStop(1, '#ff7ab8');
            ctx.lineWidth = px2 * 0.09; ctx.strokeStyle = 'rgba(40,10,60,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, cx, cy);
            ctx.fillStyle = gr; ctx.shadowColor = 'rgba(255,200,80,0.8)'; ctx.shadowBlur = px2 * 0.25; ctx.fillText(txt, cx, cy); ctx.restore();
            if (sub) texto(ctx, sub, cx, cy + px2 * 0.85, Math.min(w * 0.06, px2 * 0.3), '#fde68a', 'center', true);
        }
        function dibujar(ctx, w, h, t) {
            var cv = ctx.canvas; canvasAct = cv; zonas.length = 0;
            if (t < T0 + 1 && S.ultimoT > T0 + 6) reiniciarBingo(S);
            S.ultimoT = t; actualizarEventos(S, t);
            var L = S.ev.linea, B = S.ev.bingo, g = tJuego(t), bi = bolaActual(g), fin = !!(B && t >= B.t), i2, r, c;
            audioJuego(cv, t, g, bi, L, B);
            var gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a0b3b'); gr.addColorStop(0.55, '#2c0f55'); gr.addColorStop(1, '#0f0a2a');
            ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe9a8';
            for (i2 = 0; i2 < estrellas.length; i2++) { var s = estrellas[i2], a = Math.max(0, Math.sin(t * s.f + s.ph)); ctx.globalAlpha = a * a * 0.8; ctx.fillRect(s.x * w, s.y * h, s.r + 0.5, s.r + 0.5); }
            ctx.restore(); ctx.globalAlpha = 1;
            var nb = Math.max(8, Math.round(w / (h * 0.06))), bw = w / nb;
            for (i2 = 0; i2 < nb; i2++) {
                var bx = i2 * bw, by = h * 0.004 + Math.sin(((i2 + 0.5) / nb) * Math.PI) * h * 0.01;
                ctx.fillStyle = 'hsl(' + (i2 * 47 % 360) + ',85%,60%)'; ctx.beginPath(); ctx.moveTo(bx + bw * 0.1, by); ctx.lineTo(bx + bw * 0.9, by); ctx.lineTo(bx + bw / 2, by + h * 0.032); ctx.closePath(); ctx.fill();
            }
            var port = w <= h * 1.15, S0, cx, cy, cs, cardX, cardY, histY, stX, stY;
            if (port) {
                S0 = Math.min(w * 0.6, h * 0.25); cx = w / 2; cy = h * 0.265; cs = Math.min(w * 0.96 / cols, h * 0.435 / filas);
                cardX = (w - cs * cols) / 2; cardY = h * 0.55 + (h * 0.435 - cs * filas) / 2; histY = h * 0.435; stX = w / 2; stY = h * 0.525;
            } else {
                S0 = Math.min(w * 0.36, h * 0.6); cx = w * 0.215; cy = h * 0.47; cs = Math.min(w * 0.55 / cols, h * 0.74 / filas);
                cardX = w * 0.42 + (w * 0.575 - cs * cols) / 2; cardY = h * 0.12 + (h * 0.76 - cs * filas) / 2; histY = h * 0.85; stX = cardX + cs * cols / 2; stY = cardY + cs * filas + h * 0.05;
            }
            var hp = Math.max(11, h * 0.042);
            if (bi <= 0 && !fin) texto(ctx, 'Mantén pulsada una foto para verla en grande', cx, h * 0.108, Math.min(Math.max(10, h * 0.024), (port ? w : w * 0.43) * 0.03), '#c4b5fd', 'center', false);
            texto(ctx, tTit, port ? w / 2 : w * 0.5, h * 0.062, Math.min(hp, w * 0.058), '#fde68a', 'center', true, w * 0.8);
            if (bi >= 0) texto(ctx, (bi + 1) + ' / ' + N, w - w * 0.03, h * 0.062, Math.max(10, h * 0.026), '#c4b5fd', 'right', false);
            if (g < T0) {
                var qa = salidaCubica(Math.min(1, t / 0.8));
                pintarFoto(ctx, null, cx, cy, S0 * (0.8 + 0.2 * qa), -0.04, qa, 45, 0.3, null, -1);
                texto(ctx, '?', cx, cy - S0 * 0.04, S0 * 0.5, 'rgba(253,230,138,0.9)', 'center', true);
                texto(ctx, Math.ceil(T0 - g) + '', cx, cy + S0 * 0.38, S0 * 0.2, '#fff', 'center', true);
                texto(ctx, tPrep, cx, cy + S0 * 0.72, Math.max(11, S0 * 0.11), '#fde68a', 'center', false, S0 * 1.6);
            } else {
                var ido = orden[bi], fase = g - (T0 + bi * INT), e = clamp(fase / 0.6, 0, 1), sc = 0.35 + 0.65 * salidaAtras(e);
                pintarFoto(ctx, fotoDe(imgs, ido), cx, cy, S0 * sc, lerp(0.35, -0.04, salidaCubica(e)), 1, 45, 0.3, zonas, ido);
                if (fase < 0.9) {
                    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe9a0';
                    for (i2 = 0; i2 < 12; i2++) { var an = i2 * TAU / 12 + bi, rr = S0 * 0.8 * salidaCubica(fase / 0.9); estrella4(ctx, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr, S0 * 0.06, 1 - fase / 0.9); }
                    ctx.restore(); ctx.globalAlpha = 1;
                }
                var bw2 = S0 * 0.9, bpr = clamp(fase / INT, 0, 1);
                ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(cx - bw2 / 2, cy + S0 * 0.585, bw2, 3);
                ctx.fillStyle = '#f59e0b'; ctx.fillRect(cx - bw2 / 2, cy + S0 * 0.585, bw2 * bpr, 3);
                var nh = Math.min(bi, 6), hs = Math.min(S0 / 6.5, h * 0.075), hx = cx - (nh * (hs + 4) - 4) / 2;
                for (i2 = 1; i2 <= nh; i2++) {
                    var mx = hx + (i2 - 1) * (hs + 4);
                    miniatura(ctx, fotoDe(imgs, orden[bi - i2]), mx, histY, hs);
                    zonas.push({ i: orden[bi - i2], x: mx + hs / 2, y: histY + hs / 2, w: hs, h: hs, rot: 0 });
                }
            }
            celdas.length = 0;
            for (r = 0; r < filas; r++) for (c = 0; c < cols; c++) {
                var k = r * cols + c; if (k >= n) continue;
                celdas.push({ idx: carton[k], x: cardX + c * cs, y: cardY + r * cs, w: cs, h: cs });
                celda(ctx, cardX + c * cs, cardY + r * cs, cs, carton[k], t);
            }
            for (r = 0; r < filas; r++) if (filaCompleta(r, bi)) {
                ctx.strokeStyle = 'rgba(250,204,21,' + (0.7 + 0.3 * Math.sin(t * 6)).toFixed(3) + ')'; ctx.lineWidth = Math.max(2, cs * 0.05);
                ctx.strokeRect(cardX, cardY + r * cs, cs * cols, cs);
            }
            var sp = Math.max(10, Math.min(h * 0.03, cs * 0.26)), msg, col = '#cbd5e1';
            if (S.aviso && t - S.aviso.t < 2.4 && t >= S.aviso.t) { msg = S.aviso.txt; col = '#fb7185'; }
            else if (S.nMarcas === 0 && bi >= 0 && !fin) msg = 'Toca en tu cartón la foto que salga';
            else msg = S.alias + ' · ' + S.nMarcas + '/' + n + (L ? '  ·  ★ Línea: ' + (L.dev === S.id ? 'tú' : String(L.por).replace('Cartón ', '')) : '');
            texto(ctx, msg, stX, stY, sp, col, 'center', false, w * 0.96);
            if (!B && bi >= N - 1 && g >= T0 + N * INT) texto(ctx, tFin, cx, cy, Math.max(14, S0 * 0.12), '#fde68a', 'center', true, S0 * 1.8);
            if (L && t >= L.t && t < L.t + PAUSA + 0.6 && !fin) cantar(ctx, w, h, t - L.t, tLinea, L.dev === S.id ? '¡Has sido tú!' : L.por, false);
            if (fin) cantar(ctx, w, h, t - B.t, tBingo, B.dev === S.id ? '¡Has sido tú!' : B.por, true);
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: [], musica: 'fiesta', pulsar: pulsar, pulsarLargo: pulsarLargo, zonas: zonas, fijo: true };
    }

    var CATALOGO = {
        'fotos-fuegos':      { nombre: 'Fotos · Fuegos artificiales',      crear: crearFuegos },
        'fotos-nave':        { nombre: 'Fotos · Nave espacial',            crear: crearNave },
        'fotos-muro':        { nombre: 'Fotos · Videowall (16 móviles)',   crear: crearMuro },
        'fotos-ola':         { nombre: 'Fotos · Ola de luz (16 móviles)',  crear: crearOla },
        'fotos-mosaico':     { nombre: 'Fotos · Mosaico del 40',           crear: crearMosaico },
        'fotos-enfoque':     { nombre: 'Fotos · Enfoque de misterio',      crear: crearEnfoque },
        'fotos-puzzle':      { nombre: 'Fotos · Rompecabezas',             crear: crearPuzzle },
        'fotos-polaroid':    { nombre: 'Fotos · Polaroids reveladas',      crear: crearPolaroid },
        'fotos-tunel':       { nombre: 'Fotos · Túnel del tiempo',         crear: crearTunel },
        'fotos-farolillos':  { nombre: 'Fotos · Farolillos al cielo',      crear: crearFarolillos },
        'fotos-lluvia':      { nombre: 'Fotos · Lluvia de recuerdos',      crear: crearLluvia },
        'fotos-tragaperras': { nombre: 'Fotos · Tragaperras de recuerdos', crear: crearTragaperras },
        'fotos-pasteleria':  { nombre: 'Fotos · Tarta de recuerdos (repostería)', crear: crearPasteleria },
        'fotos-castillo':    { nombre: 'Fotos · Teatro del castillo de cuento', crear: crearCastillo },
        'fotos-bingo':       { nombre: 'Fotos · Bingo de recuerdos (juego, un cartón por móvil)', crear: crearBingo }
    };
    /* Esquema de ajustes editables (el panel de administración lo dibuja y lo guarda en estado_juego/<caso>.ajustes) */
    var AJ_ESPECIFICOS = {
        'fotos-bingo': [
            { k: 'bCols', et: 'Columnas del cartón', tipo: 'num', min: 1, max: 5, def: 5, ayuda: 'Menos casillas = fotos más grandes. 3 columnas × 3 filas = cartón de 9 fotos.' },
            { k: 'bFilas', et: 'Filas del cartón', tipo: 'num', min: 1, max: 5, def: 3 },
            { k: 'bSeg', et: 'Segundos por foto', tipo: 'num', min: 3, max: 14, def: null, ayuda: 'Vacío = según la duración total. Si lo rellenas, manda sobre la duración.' },
            { k: 'bCuenta', et: 'Cuenta atrás inicial (s)', tipo: 'num', min: 3, max: 30, def: 6 },
            { k: 'bTitulo', et: 'Título', tipo: 'txt', max: 30, def: 'BINGO DE RECUERDOS' },
            { k: 'bPrepara', et: 'Texto de la cuenta atrás', tipo: 'txt', max: 30, def: '¡Prepara tu cartón!' },
            { k: 'bLinea', et: 'Texto al cantar línea', tipo: 'txt', max: 14, def: '¡LÍNEA!' },
            { k: 'bBingo', et: 'Texto al cantar bingo', tipo: 'txt', max: 14, def: '¡BINGO!' },
            { k: 'bFin', et: 'Texto al acabarse las fotos', tipo: 'txt', max: 30, def: '¡Se acabaron las fotos!' }
        ],
        'fotos-castillo': [
            { k: 'cFotos', et: 'Fotos por escena', tipo: 'num', min: 1, max: 3, def: 3, ayuda: 'Menos fotos por escena = fotos más grandes.' },
            { k: 'cSeg', et: 'Segundos por escena', tipo: 'num', min: 6, max: 30, def: 6, ayuda: 'Más segundos = las fotos se quedan más tiempo en pantalla.' },
            { k: 'cTitulo', et: 'Título de apertura', tipo: 'txt', max: 36, def: '40 AÑOS DE VANE' },
            { k: 'cSub', et: 'Subtítulo de apertura', tipo: 'txt', max: 40, def: 'Una función de recuerdos' },
            { k: 'cFinTit', et: 'Título final', tipo: 'txt', max: 36, def: 'Fin de la función' },
            { k: 'cFinSub', et: 'Subtítulo final', tipo: 'txt', max: 40, def: 'Gracias por tanta magia' }
        ],
        'fotos-enfoque': [
            { k: 'eBlur', et: 'Intensidad del desenfoque', tipo: 'num', min: 1, max: 10, def: 8, ayuda: '1 = foto casi reconocible, 10 = casi irreconocible.' },
            { k: 'eDescubre', et: 'Segundos que tarda en descubrirse', tipo: 'num', min: 2, max: 20, def: 5 },
            { k: 'eVista', et: 'Segundos con la foto ya nítida', tipo: 'num', min: 1, max: 15, def: 3, ayuda: 'Incluye el destello final y la salida de la foto.' },
            { k: 'eFoco', et: 'Tamaño del foco que descubre (%)', tipo: 'num', min: 0, max: 250, def: 100, ayuda: '0 = sin foco: la foto se aclara solo poco a poco.' },
            { k: 'eTam', et: 'Tamaño de la foto (%)', tipo: 'num', min: 40, max: 100, def: 100 },
            { k: 'eTexto', et: 'Texto de misterio', tipo: 'txt', max: 30, def: '¿Quién será?' }
        ],
        'fotos-tragaperras': [{ k: 'rFicha', et: 'Texto de la ficha dorada', tipo: 'txt', max: 4, def: '40' }],
        'fotos-pasteleria': [{ k: 'tTexto', et: 'Texto de la tarta', tipo: 'txt', max: 24, def: '¡Felices 40!' }]
    };
    function ajustesDe(tipo) {
        var l = [];
        if (FT_TIPOS.indexOf(tipo) >= 0) l.push({ k: 'fotoTam', et: 'Tamaño de las fotos (%)', tipo: 'num', min: 50, max: 150, def: 100, ayuda: 'Escala las polaroids del efecto: 100 = normal.' });
        (AJ_ESPECIFICOS[tipo] || []).forEach(function (a) { l.push(a); });
        if (CATALOGO[tipo]) l.push({ k: 'orden', et: 'Variante del orden', tipo: 'num', min: 0, max: 99, def: 0, ayuda: '0 = orden original. Otro número baraja las fotos de otra forma (en el bingo, reinicia el juego).' });
        return l;
    }
    var MURO = { LW: 480, LH: 1000, tipos: ['fotos-muro', 'fotos-ola'] };   // celda lógica de referencia (móvil vertical)

    // Crea el efecto. opc.duracion (s): duración total deseada; el efecto se estira o comprime a ese tiempo (velocidad = natural / deseada)
    var FT_TIPOS = ['fotos-fuegos', 'fotos-nave', 'fotos-polaroid', 'fotos-farolillos', 'fotos-lluvia', 'fotos-castillo', 'fotos-bingo'];   // efectos que dibujan polaroids con pintarFoto
    function crearEfecto(tipo, imgs, seed, opc) {
        opc = opc || {};
        var A = opc.ajustes || null, ord = ajNum(A, 'orden', 0, 0, 99);
        if (ord > 0) seed = (seed + Math.imul(ord, 0x9E3779B1)) >>> 0;
        var ft = (FT_TIPOS.indexOf(tipo) >= 0) ? ajNum(A, 'fotoTam', 100, 50, 150) / 100 : 1;
        var r = armarEfecto(tipo, imgs, seed, opc);
        if (ft !== 1) {
            var d0 = r.dibujar;
            r.dibujar = function (ctx, w, h, t) { var prev = FOTO_K; FOTO_K = ft; try { d0(ctx, w, h, t); } finally { FOTO_K = prev; } };
        }
        return r;
    }
    function armarEfecto(tipo, imgs, seed, opc) {
        var d = CATALOGO[tipo] || CATALOGO['fotos-fuegos'], base = d.crear(imgs, seed, opc), D0 = base.duracion;
        if (base.fijo) { base.natural = D0; base.velocidad = 1; return base; }
        var D = (Number(opc.duracion) >= 10) ? Math.min(Number(opc.duracion), 3600) : D0, k = D0 / D;
        if (Math.abs(k - 1) < 1e-6) { base.natural = D0; base.velocidad = 1; return base; }
        return {
            duracion: D, natural: D0, velocidad: k, muro: base.muro, musica: base.musica, zonas: base.zonas, layout: base.layout,
            dibujar: function (ctx, w, h, t) { base.dibujar(ctx, w, h, t * k); },
            sonidos: base.sonidos.map(function (e) { return { t: e.t / k, tipo: e.tipo, v: e.v }; })
        };
    }

    /* ======================================================================
       AUDIO: efectos de sonido y música de fondo, todo generado con WebAudio
       (sin archivos). La música sigue el tiempo del efecto, así que todos los
       dispositivos suenan al compás aunque entren tarde.
       ====================================================================== */
    var AU = { ctx: null, sfx: null, musica: null, eco: null, ruido: null };
    function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function audioCtx() {
        if (!AU.ctx) {
            try { var AC = global.AudioContext || global.webkitAudioContext; if (AC) AU.ctx = new AC(); } catch (e) { AU.ctx = null; }
            if (AU.ctx) cadenaAudio(AU.ctx);
        }
        if (AU.ctx && AU.ctx.state === 'suspended') { try { AU.ctx.resume(); } catch (e) { /* ignorar */ } }
        return AU.ctx && AU.ctx.state === 'running' ? AU.ctx : null;
    }
    function cadenaAudio(ac) {
        var comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
        var master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
        AU.sfx = ac.createGain(); AU.sfx.connect(master);
        AU.musica = ac.createGain(); AU.musica.gain.value = 0; AU.musica.connect(master);
        var eco = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter();
        eco.delayTime.value = 0.36; fb.gain.value = 0.34; lp.type = 'lowpass'; lp.frequency.value = 2600;
        eco.connect(lp); lp.connect(fb); fb.connect(eco); lp.connect(AU.musica);
        AU.eco = eco;
        var len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        AU.ruido = buf;
    }
    function voz(ac, dest, o) {
        var osc = ac.createOscillator(), g = ac.createGain(), at = o.ataque || 0.01, fin = o.t + o.dur;
        osc.type = o.tipo || 'sine'; osc.frequency.setValueAtTime(o.f, o.t);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, fin);
        g.gain.setValueAtTime(0.0001, o.t); g.gain.linearRampToValueAtTime(o.vol, o.t + at); g.gain.exponentialRampToValueAtTime(0.0001, fin);
        var nodo = osc;
        if (o.lp) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); nodo = f; }
        nodo.connect(g); g.connect(dest);
        if (o.eco && AU.eco) { var s = ac.createGain(); s.gain.value = o.eco; g.connect(s); s.connect(AU.eco); }
        osc.start(o.t); osc.stop(fin + 0.05);
    }
    function ruidoV(ac, dest, o) {
        var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), fin = o.t + o.dur;
        src.buffer = AU.ruido; f.type = o.filtro || 'lowpass'; f.frequency.setValueAtTime(o.f1, o.t);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, fin);
        if (o.q) f.Q.value = o.q;
        g.gain.setValueAtTime(o.vol, o.t); g.gain.exponentialRampToValueAtTime(0.0001, fin);
        src.connect(f); f.connect(g); g.connect(dest); src.start(o.t, Math.random() * 1.5); src.stop(fin + 0.05);
    }

    /* Efectos de sonido (ac, tiempo de audio, volumen) */
    var SFX = {
        lanzar: function (ac, t, v) {          // silbido del cohete al subir
            voz(ac, AU.sfx, { tipo: 'sine', f: 380, f2: 2300, t: t, dur: 1.1, vol: 0.07 * v, ataque: 0.05 });
            ruidoV(ac, AU.sfx, { t: t, dur: 1.1, vol: 0.05 * v, filtro: 'bandpass', f1: 900, f2: 3600, q: 3 });
        },
        estallar: function (ac, t, v) {        // estallido + chisporroteo
            voz(ac, AU.sfx, { tipo: 'sine', f: 150, f2: 32, t: t, dur: 0.7, vol: 0.55 * v, ataque: 0.004 });
            ruidoV(ac, AU.sfx, { t: t, dur: 0.8, vol: 0.5 * v, filtro: 'lowpass', f1: 2200, f2: 60 });
            for (var i = 0; i < 12; i++) ruidoV(ac, AU.sfx, { t: t + 0.08 + Math.random() * 1.3, dur: 0.05, vol: (0.08 + Math.random() * 0.1) * v, filtro: 'highpass', f1: 3500 + Math.random() * 3000 });
        },
        tick: function (ac, t, v) { voz(ac, AU.sfx, { tipo: 'square', f: 1500 + Math.random() * 300, t: t, dur: 0.03, vol: 0.04 * v, ataque: 0.002 }); },
        tope: function (ac, t, v) {
            voz(ac, AU.sfx, { tipo: 'sine', f: 240, f2: 70, t: t, dur: 0.16, vol: 0.4 * v, ataque: 0.003 });
            ruidoV(ac, AU.sfx, { t: t, dur: 0.05, vol: 0.18 * v, filtro: 'highpass', f1: 1800 });
        },
        premio: function (ac, t, v) {
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { voz(ac, AU.sfx, { tipo: 'triangle', f: f, t: t + i * 0.09, dur: 0.7, vol: 0.13 * v, ataque: 0.005, eco: 0.3 }); });
            for (var i = 0; i < 8; i++) ruidoV(ac, AU.sfx, { t: t + 0.1 + i * 0.07, dur: 0.06, vol: 0.07 * v, filtro: 'highpass', f1: 5000 });
        },
        obturador: function (ac, t, v) {
            ruidoV(ac, AU.sfx, { t: t, dur: 0.025, vol: 0.3 * v, filtro: 'highpass', f1: 1800 });
            ruidoV(ac, AU.sfx, { t: t + 0.075, dur: 0.03, vol: 0.24 * v, filtro: 'highpass', f1: 1200 });
        },
        impresora: function (ac, t, v) {
            voz(ac, AU.sfx, { tipo: 'sawtooth', f: 150, f2: 230, t: t, dur: 0.95, vol: 0.05 * v, ataque: 0.08, lp: 700 });
            ruidoV(ac, AU.sfx, { t: t, dur: 0.9, vol: 0.05 * v, filtro: 'bandpass', f1: 2200, q: 4 });
        },
        ding: function (ac, t, v) {
            voz(ac, AU.sfx, { tipo: 'sine', f: 1318.5, t: t, dur: 1.1, vol: 0.14 * v, ataque: 0.004, eco: 0.25 });
            voz(ac, AU.sfx, { tipo: 'sine', f: 1976, t: t, dur: 0.8, vol: 0.06 * v, ataque: 0.004 });
        },
        click: function (ac, t, v) {
            voz(ac, AU.sfx, { tipo: 'sine', f: 700, f2: 280, t: t, dur: 0.07, vol: 0.14 * v, ataque: 0.002 });
            ruidoV(ac, AU.sfx, { t: t, dur: 0.02, vol: 0.06 * v, filtro: 'highpass', f1: 3000 });
        },
        pop: function (ac, t, v) { voz(ac, AU.sfx, { tipo: 'sine', f: 900, f2: 220, t: t, dur: 0.09, vol: 0.09 * v, ataque: 0.002 }); },
        chime: function (ac, t, v) {
            [783.99, 987.77, 1174.66, 1567.98].forEach(function (f, i) { voz(ac, AU.sfx, { tipo: 'sine', f: f, t: t + i * 0.12, dur: 1.4, vol: 0.1 * v, ataque: 0.005, eco: 0.4 }); });
        },
        fanfarria: function (ac, t, v) {
            [261.63, 329.63, 392, 523.25].forEach(function (f) { voz(ac, AU.sfx, { tipo: 'sawtooth', f: f, t: t, dur: 1.8, vol: 0.07 * v, ataque: 0.18, lp: 2200, eco: 0.3 }); });
            [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { voz(ac, AU.sfx, { tipo: 'triangle', f: f, t: t + 0.25 + i * 0.1, dur: 1.2, vol: 0.07 * v, ataque: 0.004, eco: 0.35 }); });
            ruidoV(ac, AU.sfx, { t: t + 0.2, dur: 0.9, vol: 0.12 * v, filtro: 'bandpass', f1: 3000, f2: 7000, q: 1 });
        },
        whoosh: function (ac, t, v) { ruidoV(ac, AU.sfx, { t: t, dur: 0.6, vol: 0.12 * v, filtro: 'bandpass', f1: 300, f2: 2400, q: 1.5 }); },
        destello: function (ac, t, v) {
            [2093, 2637, 3136].forEach(function (f, i) { voz(ac, AU.sfx, { tipo: 'sine', f: f, t: t + i * 0.06, dur: 0.5, vol: 0.05 * v, ataque: 0.004, eco: 0.5 }); });
        },
        broma: function (ac, t, v) {           // boing + trombón triste
            voz(ac, AU.sfx, { tipo: 'sine', f: 180, f2: 620, t: t, dur: 0.16, vol: 0.12 * v, ataque: 0.005 });
            [[311.13, 0.18, 0.26], [293.66, 0.46, 0.26], [277.18, 0.74, 0.26], [261.63, 1.02, 0.9]].forEach(function (n, i) {
                voz(ac, AU.sfx, { tipo: 'sawtooth', f: n[0], f2: i === 3 ? n[0] * 0.78 : null, t: t + n[1], dur: n[2], vol: 0.11 * v, ataque: 0.03, lp: 1000 });
            });
        },
        bola: function (ac, t, v) { SFX.whoosh(ac, t, v * 0.6); SFX.ding(ac, t + 0.12, v); },
        linea: function (ac, t, v) { SFX.fanfarria(ac, t, v); SFX.premio(ac, t + 0.5, v); },
        bingo: function (ac, t, v) {
            SFX.fanfarria(ac, t, v); SFX.premio(ac, t + 0.4, v); SFX.premio(ac, t + 1.1, v); SFX.chime(ac, t + 1.8, v);
            [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach(function (f, i) { voz(ac, AU.sfx, { tipo: 'triangle', f: f, t: t + 0.2 + i * 0.07, dur: 0.8, vol: 0.1 * v, ataque: 0.005, eco: 0.3 }); });
        }
    };
    /* ======================================================================
       ARCHIVOS DE AUDIO OPCIONALES POR EFECTO (WebAudio, mismo desbloqueo que el sonido generado)
       - Musica:  assets/musica/efectos/<efecto>.mp3   (bucle; va sincronizada con el tiempo del efecto)
       - Sonidos: assets/sfx/efectos/<efecto>/<sonido>.mp3
       Si un archivo no existe, suena el original generado por codigo. <efecto> = fotos-castillo, fotos-bingo, ...
       ====================================================================== */
    var SFX_NOMBRES = ['lanzar', 'estallar', 'tick', 'tope', 'premio', 'obturador', 'impresora', 'ding', 'click', 'pop', 'chime', 'fanfarria', 'whoosh', 'destello', 'broma', 'bola', 'linea', 'bingo'];
    var BUF = {}, PRECARGADO = {};
    function ctxCrear() {
        if (!AU.ctx) {
            try { var AC = global.AudioContext || global.webkitAudioContext; if (AC) AU.ctx = new AC(); } catch (e) { AU.ctx = null; }
            if (AU.ctx) cadenaAudio(AU.ctx);
        }
        return AU.ctx;
    }
    function cargarBuf(url) {
        var b = BUF[url]; if (b) return b;
        b = BUF[url] = { estado: 'cargando', buf: null };
        var ac = ctxCrear();
        if (!ac || !global.fetch) { b.estado = 'no'; return b; }
        global.fetch(url).then(function (r) { if (!r.ok) throw new Error('404'); return r.arrayBuffer(); })
            .then(function (ab) { return new Promise(function (ok, ko) { ac.decodeAudioData(ab, ok, ko); }); })
            .then(function (buf) { b.buf = buf; b.estado = 'ok'; })
            .catch(function () { b.estado = 'no'; });
        return b;
    }
    function precargarEfecto(tipo) {
        if (PRECARGADO[tipo]) return; PRECARGADO[tipo] = true;
        cargarBuf('assets/musica/efectos/' + tipo + '.mp3');
        SFX_NOMBRES.forEach(function (n) { cargarBuf('assets/sfx/efectos/' + tipo + '/' + n + '.mp3'); });
    }
    /* Devuelve 'cargando', el AudioBuffer de la musica del efecto, o null si no hay archivo */
    function musicaArchivo(tipo) {
        var b = BUF['assets/musica/efectos/' + tipo + '.mp3'];
        return !b || b.estado === 'cargando' ? (b ? 'cargando' : null) : (b.estado === 'ok' ? b.buf : null);
    }
    function sfxArchivo(fx, nombre, vol, v) {
        var b = BUF['assets/sfx/efectos/' + fx + '/' + nombre + '.mp3'];
        if (!b || b.estado !== 'ok') return false;
        var ac = audioCtx(); if (!ac) return true;                       // sin audio activo: no suena (como el sonido generado)
        try {
            var src = ac.createBufferSource(), g = ac.createGain();
            AU.sfx.gain.value = vol; g.gain.value = clamp(v, 0, 2);
            src.buffer = b.buf; src.connect(g); g.connect(AU.sfx); src.start(ac.currentTime + 0.01);
        } catch (e) { return false; }
        return true;
    }
    /* Musica de archivo con la misma interfaz que crearMusica; el punto del bucle sale del tiempo del efecto (t mod duracion) */
    function crearMusicaArchivo(buf) {
        var src = null, ini = 0, off0 = 0, rate0 = 1, activo = false, NIVEL = 0.8;
        function parar() { if (src) { try { src.stop(); } catch (e) { /* ignorar */ } try { src.disconnect(); } catch (e2) { /* ignorar */ } src = null; } }
        function arrancar(t, rate) {
            parar(); var ac = AU.ctx; if (!ac) return;
            src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = rate; src.connect(AU.musica);
            off0 = ((t % buf.duration) + buf.duration) % buf.duration; src.start(0, off0); ini = ac.currentTime; rate0 = rate;
        }
        return {
            reiniciar: function (t) { if (src) arrancar(t, rate0); },
            detener: function () { if (activo && AU.ctx && AU.musica) { try { AU.musica.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.06); } catch (e) { /* ignorar */ } } parar(); activo = false; },
            avanzar: function (t, rate, vol) {
                var ac = audioCtx(); if (!ac) return;
                var nivel = NIVEL * clamp(vol == null ? 1 : vol, 0, 1);
                try { AU.musica.gain.setTargetAtTime(nivel, ac.currentTime, 0.05); } catch (e) { /* ignorar */ }
                if (nivel <= 0.001) { parar(); activo = false; return; }
                if (!activo || !src) { activo = true; arrancar(t, rate); return; }
                if (rate !== rate0) { off0 = (off0 + (ac.currentTime - ini) * rate0) % buf.duration; ini = ac.currentTime; rate0 = rate; src.playbackRate.value = rate; }
                var esp = (off0 + (ac.currentTime - ini) * rate0) % buf.duration, obj = ((t % buf.duration) + buf.duration) % buf.duration, d = Math.abs(esp - obj);
                d = Math.min(d, buf.duration - d);
                if (d > 0.4) arrancar(t, rate);                              // se entro tarde o hubo un salto: se vuelve a sincronizar
            }
        };
    }

    function sonar(tipo, volumen, v, fx) {
        if (fx && sfxArchivo(fx, tipo, clamp(volumen == null ? 1 : volumen, 0, 1), v == null ? 1 : v)) return;   // archivo propio del efecto
        /* Sonido propio del estilo elegido (assets/sfx/<tema>/<tipo>.mp3); si no existe, se sintetiza el original */
        if (global.VaneTemaSfx && global.VaneTemaSfx.reproducir(tipo, volumen == null ? 1 : volumen, v == null ? 1 : v)) return;
        var ac = audioCtx(); if (!ac || !SFX[tipo]) return;
        var vol = clamp(volumen == null ? 1 : volumen, 0, 1);
        if (vol <= 0.001) return;
        try { AU.sfx.gain.value = vol; SFX[tipo](ac, ac.currentTime + 0.01, v == null ? 1 : v); } catch (e) { /* ignorar */ }
    }

    /* Música generativa: cinco estilos. Cada paso depende solo del número de paso → determinista y a compás en todos los móviles */
    var ESTILOS = {
        celebracion: { bpm: 112, raiz: 60, vol: 0.5, acordes: [[0, 4, 7, 12], [9, 12, 16, 21], [5, 9, 12, 17], [7, 11, 14, 19]], patron: [0, 1, 2, 3, 2, 1, 2, 3], tipo: 'triangle', arpVol: 0.1, pad: 0.05, bajo: 0.17, lp: 3200, eco: 0.2, perc: true },
        fiesta:      { bpm: 124, raiz: 57, vol: 0.5, acordes: [[0, 4, 7, 12], [9, 12, 16, 19], [5, 9, 12, 17], [7, 11, 14, 19]], patron: [0, 2, 1, 2, 0, 3, 1, 2], tipo: 'triangle', arpVol: 0.11, pad: 0.04, bajo: 0.18, lp: 3600, eco: 0.15, perc: true },
        espacio:     { bpm: 64,  raiz: 50, vol: 0.55, acordes: [[0, 3, 7, 12], [8, 12, 15, 20], [3, 7, 10, 15], [10, 14, 17, 22]], patron: [0, -1, 2, -1, 1, -1, 3, -1], tipo: 'sine', arpVol: 0.09, pad: 0.07, bajo: 0.12, lp: 1800, eco: 0.7, perc: false, dron: true, durArp: 4 },
        nostalgia:   { bpm: 72,  raiz: 53, vol: 0.5, acordes: [[0, 4, 7, 12], [9, 12, 16, 19], [5, 9, 12, 17], [7, 11, 14, 19]], patron: [0, 2, 1, 3, 0, 2, 1, 3], tipo: 'triangle', arpVol: 0.12, pad: 0.06, bajo: 0.12, lp: 2400, eco: 0.35, perc: false, durArp: 3 },
        pasteleria:  { bpm: 104, raiz: 60, vol: 0.5, acordes: [[0, 4, 7, 11], [9, 12, 16, 19], [2, 5, 9, 12], [7, 11, 14, 17]], patron: [0, 2, 1, 3, 2, 1, 3, 1], tipo: 'triangle', arpVol: 0.11, pad: 0.04, bajo: 0.15, lp: 3600, eco: 0.25, perc: false, durArp: 1.3 },
        fantasia:    { bpm: 78, raiz: 62, vol: 0.5, acordes: [[0, 4, 7, 12], [7, 11, 14, 19], [9, 12, 16, 21], [5, 9, 12, 17]], patron: [0, 1, 2, 3, 2, 1, 3, 2], tipo: 'triangle', arpVol: 0.1, pad: 0.06, bajo: 0.11, lp: 5200, eco: 0.65, perc: false, durArp: 2.4, octava: 12, brillo: 0.045 },
        magico:      { bpm: 88,  raiz: 67, vol: 0.45, acordes: [[0, 4, 7, 12], [9, 12, 16, 19], [5, 9, 12, 17], [7, 11, 14, 19]], patron: [3, 1, 2, 0, 3, 1, 2, 1], tipo: 'sine', arpVol: 0.09, pad: 0.035, bajo: 0.1, lp: 5000, eco: 0.6, perc: false, durArp: 2.2, octava: 12 }
    };
    function hashPaso(n, s) { return hash(n + ':' + s); }
    function tocarPaso(ac, dest, E, n, t0, paso, nombre) {
        var s = n % 32, ci = Math.floor(s / 8) % 4, sb = s % 8, ac_ = E.acordes[ci], i, v = hashPaso(n, nombre);
        if (sb === 0) {
            for (i = 0; i < ac_.length; i++) voz(ac, dest, { tipo: 'triangle', f: mtof(E.raiz + ac_[i] - 12), t: t0, dur: paso * 8.2, vol: E.pad, ataque: paso * 3, lp: 1100, eco: 0.3 });
            if (E.dron && ci % 2 === 0) voz(ac, dest, { tipo: 'sawtooth', f: mtof(E.raiz - 24), t: t0, dur: paso * 16, vol: 0.05, ataque: paso * 5, lp: 260 });
        }
        if (sb === 0 || sb === 4) voz(ac, dest, { tipo: 'sine', f: mtof(E.raiz + ac_[0] - 24), t: t0, dur: paso * 3.4, vol: E.bajo, ataque: 0.012 });
        if (E.perc && (sb === 3 || sb === 7) && v % 3 === 0) voz(ac, dest, { tipo: 'sine', f: mtof(E.raiz + ac_[0] - 24), t: t0, dur: paso * 1.2, vol: E.bajo * 0.7, ataque: 0.01 });
        var idx = E.patron[sb];
        if (idx >= 0) {
            var oct = (E.octava || 0) + ((v % 7 === 0) ? 12 : 0) + (sb === 7 && v % 5 === 0 ? -12 : 0);
            voz(ac, dest, { tipo: E.tipo, f: mtof(E.raiz + ac_[idx % ac_.length] + oct), t: t0, dur: paso * (E.durArp || 1.6), vol: E.arpVol, ataque: 0.006, lp: E.lp, eco: E.eco });
        }
        if (E.brillo && v % 3 === 0) voz(ac, dest, { tipo: 'sine', f: mtof(E.raiz + ac_[(v >>> 3) % ac_.length] + 24), t: t0 + paso * 0.5, dur: paso * 2.6, vol: E.brillo, ataque: 0.004, eco: 0.6 });
        if (E.perc) {
            if (sb === 0 || sb === 4) { voz(ac, dest, { tipo: 'sine', f: 130, f2: 42, t: t0, dur: 0.16, vol: 0.28, ataque: 0.003 }); }
            if (sb % 2 === 1) ruidoV(ac, dest, { t: t0, dur: 0.045, vol: 0.05, filtro: 'highpass', f1: 7500 });
        }
    }
    function crearMusica(nombre) {
        var E = ESTILOS[nombre]; if (!E) return null;
        var paso = 60 / E.bpm / 2, sig = 0, activo = false;
        return {
            reiniciar: function (t) { sig = Math.ceil(t / paso - 1e-6); },
            detener: function () { if (activo && AU.ctx && AU.musica) { try { AU.musica.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.06); } catch (e) { /* ignorar */ } } activo = false; },
            avanzar: function (t, rate, vol) {
                var ac = audioCtx(); if (!ac) return;
                if (!activo) { activo = true; sig = Math.ceil(t / paso - 1e-6); }
                var nivel = E.vol * clamp(vol == null ? 1 : vol, 0, 1);
                try { AU.musica.gain.setTargetAtTime(nivel, ac.currentTime, 0.05); } catch (e) { /* ignorar */ }
                if (nivel <= 0.001) { sig = Math.ceil(t / paso - 1e-6); return; }      // volumen a cero: no se programan notas, pero se mantiene el compás
                if (sig * paso < t - 0.3) sig = Math.ceil(t / paso - 1e-6);
                var limite = t + 0.6 * rate;
                while (sig * paso < limite) {
                    var ct = ac.currentTime + (sig * paso - t) / rate;
                    if (ct > ac.currentTime) tocarPaso(ac, AU.musica, E, sig, ct, paso, nombre);
                    sig++;
                }
            }
        };
    }

    /* ======================================================================
       REPRODUCTOR VIRTUAL: se comporta como un <video> (sobre un <canvas>)
       ====================================================================== */
    function crearPlayer(canvas, tipo, opts) {
        opts = opts || {};
        var seed = opts.seed || 1;
        precargarEfecto(tipo); var nacio = ahoraMs(), musicaElegida = false;
        var ctx = canvas.getContext ? canvas.getContext('2d') : null;
        var efecto = null, imgs = [], base = 0, t0 = 0, jugando = false, fin = false, rate = 1, listo = false;
        var raf = 0, destruido = false, ultimoTU = 0, ultimoT = 0, wPx = 0, hPx = 0, musica = null;

        function emitir(nombre) { try { canvas.dispatchEvent(new global.Event(nombre)); } catch (e) { /* ignorar */ } }
        function tiempo() {
            if (!jugando) return base;
            var t = base + (ahoraMs() - t0) / 1000 * rate;
            return efecto ? Math.min(t, efecto.duracion) : t;
        }
        function ajustarTamano() {
            var cw = canvas.clientWidth, ch = canvas.clientHeight;
            if (!cw || !ch) return false;
            var dpr = Math.max(1, Math.min(global.devicePixelRatio || 1, 2, 1800 / Math.max(cw, ch)));
            var pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
            if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
            wPx = cw; hPx = ch;
            if (ctx) ctx.setTransform(pw / cw, 0, 0, ph / ch, 0, 0);
            return true;
        }
        function sonidos(desde, hasta) {
            if (!efecto || !efecto.sonidos.length || canvas.muted || !jugando) return;
            if (hasta - desde > 0.6 || hasta < desde) return;           // saltos: no se repiten los sonidos
            for (var i = 0; i < efecto.sonidos.length; i++) { var e = efecto.sonidos[i]; if (e.t > desde && e.t <= hasta) sonar(e.tipo, canvas.volume * canvas.volumenEfectos, e.v, tipo); }
        }
        function audioEfecto(t) {
            if (!efecto) return;
            if (jugando && !canvas.muted) {
                if (!musica && !musicaElegida) {
                    var est = musicaArchivo(tipo);                      // archivo assets/musica/efectos/<efecto>.mp3 si existe; si no, la musica generada
                    if (est === 'cargando' && ahoraMs() - nacio < 2500) return;
                    musicaElegida = true;
                    musica = (est && est !== 'cargando') ? crearMusicaArchivo(est) : (efecto.musica ? crearMusica(efecto.musica) : null);
                }
                if (musica) musica.avanzar(t, rate, canvas.volume * canvas.volumenMusica);
            } else if (musica) musica.detener();
        }
        function fmtT(x) { x = Math.max(0, Math.floor(x + 0.0001)); return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); }
        function pintarReloj(t, dur) {
            var txt = fmtT(t) + ' / ' + fmtT(dur);
            ctx.save(); ctx.font = '600 11px ui-monospace, Menlo, Consolas, monospace'; ctx.textBaseline = 'middle';
            var pw = ctx.measureText(txt).width + 14, ph = 20, x = wPx - pw - 8, y = 8;
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, pw, ph); ctx.fillStyle = 'rgba(255,236,170,0.95)'; ctx.fillText(txt, x + 7, y + ph / 2 + 0.5); ctx.restore();
        }
        function bucle() {
            if (destruido) return;
            if (!canvas.isConnected) { raf = 0; return; }
            var t = tiempo();
            if (jugando && efecto && t >= efecto.duracion) {
                base = efecto.duracion; jugando = false; fin = true; t = base;
                emitir('pause'); emitir('ended');
            }
            if (ctx && ajustarTamano()) {
                if (efecto) {
                    try {
                        var vista = (efecto.muro && opts.vista) ? opts.vista() : null;
                        if (vista) {                                    // casilla del muro: se dibuja la parte que le corresponde de la escena común
                            var LW = MURO.LW, LH = MURO.LH, ks = Math.max(wPx / LW, hPx / LH);
                            ctx.save(); ctx.translate(wPx / 2, hPx / 2); ctx.scale(ks, ks); ctx.translate(-(vista.c + 0.5) * LW, -(vista.r + 0.5) * LH);
                            efecto.dibujar(ctx, LW * vista.cols, LH * vista.rows, t); ctx.restore();
                        } else efecto.dibujar(ctx, wPx, hPx, t);
                        if (opts.reloj !== false) pintarReloj(t, efecto.duracion);
                    } catch (e) { try { ctx.restore(); } catch (e2) { /* ignorar */ } /* un fotograma fallido no debe parar el efecto */ }
                } else { ctx.fillStyle = '#04040c'; ctx.fillRect(0, 0, wPx, hPx); }
            }
            audioEfecto(t);
            sonidos(ultimoT, t); ultimoT = t;
            var ahora = ahoraMs();
            if (jugando && ahora - ultimoTU > 250) { ultimoTU = ahora; emitir('timeupdate'); }
            raf = global.requestAnimationFrame(bucle);
        }

        // Zonas pulsables: cada efecto deja en efecto.zonas las fotos visibles en el último fotograma
        function enMuro() { return !!(efecto && efecto.muro && opts.vista && opts.vista()); }
        function zonaEn(x, y) {
            var zs = efecto && efecto.zonas;
            if (!zs || enMuro()) return null;
            for (var i = zs.length - 1; i >= 0; i--) {                    // la última dibujada es la que está encima
                var z = zs[i], dx = x - z.x, dy = y - z.y;
                if (z.r != null) { if (dx * dx + dy * dy <= z.r * z.r) return z; }
                else {
                    var c = Math.cos(-z.rot), sn = Math.sin(-z.rot), lx = dx * c - dy * sn, ly = dx * sn + dy * c;
                    if (Math.abs(lx) <= z.w / 2 + 4 && Math.abs(ly) <= z.h / 2 + 4) return z;
                }
            }
            return null;
        }
        var props = {
            currentTime: { configurable: true, get: tiempo, set: function (v) {
                v = Number(v); if (!isFinite(v)) return;
                var dur = efecto ? efecto.duracion : 0;
                base = clamp(v, 0, dur || v); t0 = ahoraMs(); ultimoT = base; if (musica) musica.reiniciar(base);
                if (efecto && base >= dur) { if (jugando) { jugando = false; fin = true; emitir('pause'); emitir('ended'); } else fin = true; }
                else fin = false;
                emitir('timeupdate');
            } },
            paused: { configurable: true, get: function () { return !jugando; } },
            ended: { configurable: true, get: function () { return fin; } },
            seeking: { configurable: true, get: function () { return false; } },
            readyState: { configurable: true, get: function () { return listo ? 4 : 0; } },
            duration: { configurable: true, get: function () { return efecto ? efecto.duracion : NaN; } },
            natural: { configurable: true, get: function () { return efecto ? efecto.natural : NaN; } },
            playbackRate: { configurable: true, get: function () { return rate; }, set: function (v) { v = Number(v); if (!isFinite(v) || v <= 0) return; base = tiempo(); t0 = ahoraMs(); rate = v; } },
            buffered: { configurable: true, value: { length: 0 } },
            muted: { configurable: true, writable: true, value: true },
            volume: { configurable: true, writable: true, value: 1 },
            volumenMusica: { configurable: true, writable: true, value: 1 },
            volumenEfectos: { configurable: true, writable: true, value: 1 },
            controls: { configurable: true, writable: true, value: false },
            preload: { configurable: true, writable: true, value: 'auto' },
            esEfecto: { configurable: true, value: true },
            tieneZonas: { configurable: true, get: function () { return !!(efecto && efecto.zonas); } },
            efectoActual: { configurable: true, get: function () { return efecto; } },
            zonaEn: { configurable: true, value: function (x, y) { return zonaEn(x, y); } },
            play: { configurable: true, value: function () {
                if (!efecto) return Promise.resolve();
                if (fin) { base = 0; fin = false; ultimoT = 0; }
                if (!jugando) { base = tiempo(); t0 = ahoraMs(); jugando = true; emitir('play'); emitir('playing'); }
                return Promise.resolve();
            } },
            pause: { configurable: true, value: function () {
                if (jugando) { base = tiempo(); jugando = false; emitir('pause'); }
            } },
            load: { configurable: true, value: function () { /* sin recurso que cargar */ } },
            // Sonido de prueba para ajustar el volumen sin lanzar el efecto: dos efectos y unos segundos de la música del estilo
            probarSonido: { configurable: true, value: function () {
                sonar('ding', canvas.volume * canvas.volumenEfectos, 1, tipo);
                setTimeout(function () { sonar('chime', canvas.volume * canvas.volumenEfectos, 1, tipo); }, 380);
                var est = musicaArchivo(tipo), estilo = efecto && efecto.musica;
                var m = (est && est !== 'cargando') ? crearMusicaArchivo(est) : (estilo ? crearMusica(estilo) : null); if (!m) return;
                var tt = 0, n = 0;
                var iv = setInterval(function () { m.avanzar(tt, 1, canvas.volume * canvas.volumenMusica); tt += 0.1; if (++n > 32) { clearInterval(iv); m.detener(); } }, 100);
            } },
            establecerImagenes: { configurable: true, value: function (arr) {
                imgs = arr;
                efecto = crearEfecto(tipo, imgs, seed, { duracion: (typeof opts.duracion === 'function') ? opts.duracion() : opts.duracion, ajustes: (typeof opts.ajustes === 'function') ? opts.ajustes() : opts.ajustes });
                if (!listo) { listo = true; emitir('loadedmetadata'); emitir('canplay'); }
            } },
            destruir: { configurable: true, value: function () { destruido = true; jugando = false; if (musica) musica.detener(); if (raf) global.cancelAnimationFrame(raf); raf = 0; } }
        };
        Object.keys(props).forEach(function (k) { Object.defineProperty(canvas, k, props[k]); });
        function puntero(ev) { var r = canvas.getBoundingClientRect(); return zonaEn(ev.clientX - r.left, ev.clientY - r.top); }
        if (canvas.addEventListener) {
            if (canvas.style) canvas.style.touchAction = 'manipulation';
            var lp = null, suprimir = false;
            function cancelarLP() { if (lp) { clearTimeout(lp.id); lp = null; } }
            canvas.addEventListener('pointerdown', function (ev) {
                suprimir = false; cancelarLP();
                if (!efecto || !efecto.pulsarLargo || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
                var rb = canvas.getBoundingClientRect(), px = ev.clientX - rb.left, py = ev.clientY - rb.top;
                if (zonaEn(px, py)) return;                                   // sobre una foto suelta basta el toque normal
                lp = { x: ev.clientX, y: ev.clientY, id: setTimeout(function () {
                    lp = null;
                    if (efecto && efecto.pulsarLargo && efecto.pulsarLargo(px, py)) suprimir = true;   // el «click» que siga se ignora
                }, 480) };
            });
            canvas.addEventListener('pointermove', function (ev) { if (lp && (Math.abs(ev.clientX - lp.x) > 10 || Math.abs(ev.clientY - lp.y) > 10)) cancelarLP(); });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { canvas.addEventListener(n, cancelarLP); });
            canvas.addEventListener('contextmenu', function (ev) { if (efecto && efecto.pulsarLargo) ev.preventDefault(); });
            canvas.addEventListener('click', function (ev) {
                if (suprimir) { suprimir = false; return; }
                var z = puntero(ev);
                if (z) emitirDetalle('fotoclick', { idx: z.i, img: fotoDe(imgs, z.i) });
                else if (efecto && efecto.pulsar) { var rb = canvas.getBoundingClientRect(); efecto.pulsar(ev.clientX - rb.left, ev.clientY - rb.top); }
            });
            canvas.addEventListener('pointermove', function (ev) { if (canvas.style) canvas.style.cursor = puntero(ev) ? 'pointer' : ''; });
        }
        function emitirDetalle(nombre, detalle) { try { canvas.dispatchEvent(new global.CustomEvent(nombre, { detail: detalle })); } catch (e) { /* ignorar */ } }
        raf = global.requestAnimationFrame(bucle);
        return canvas;
    }

    /* ======================================================================
       LISTA DE FOTOS, DESCARGA A CACHÉ Y DECODIFICACIÓN
       Recurso admitido (campo «Recurso» del caso):
         · URL de una carpeta:  https://media.../caso4/      → lee  caso4/fotos.json
         · URL de un manifiesto: https://media.../lo-que-sea.json
         · Lista de URLs de fotos (una por línea)
       fotos.json: ["a.jpg","b.jpg"]  o  {"fotos":["a.jpg", ...]}  (rutas relativas a la carpeta)
       ====================================================================== */
    function abs(u, base) { try { return new URL(u, base || (global.location && global.location.href)).href; } catch (e) { return u; } }
    function errHttp(status) { var e = new Error('HTTP ' + status); e.tipo = 'http'; e.status = status; return e; }

    function analizarRecurso(recurso) {
        var partes = String(recurso || '').trim().split(/\s+/).filter(Boolean);
        if (!partes.length) return { tipo: 'vacio' };
        if (partes.length > 1) return { tipo: 'lista', urls: partes.map(function (p) { return abs(p); }) };
        var u = partes[0];
        if (/\.json(\?.*)?$/i.test(u)) return { tipo: 'manifiesto', url: abs(u) };
        if (EXT.test(u)) return { tipo: 'lista', urls: [abs(u)] };
        var b = u.replace(/[?#].*$/, ''); if (!/\/$/.test(b)) b += '/';
        return { tipo: 'manifiesto', url: abs(b) + 'fotos.json' };
    }
    function normalizarManifiesto(json, base) {
        var arr = Array.isArray(json) ? json : (json && (json.fotos || json.images || json.imagenes || json.photos)) || [];
        var out = [], vistos = {};
        arr.forEach(function (it) {
            var s = typeof it === 'string' ? it : (it && (it.url || it.src || it.archivo || it.nombre));
            if (!s || !EXT.test(String(s))) return;
            var u = abs(String(s), base);
            if (!vistos[u]) { vistos[u] = 1; out.push(u); }
        });
        return out.slice(0, MAX_FOTOS);
    }
    async function leerManifiesto(url, cache, signal, alRecibir) {
        var res = null, errRed = null;
        try { res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-cache', signal: signal }); }
        catch (e) { if (signal && signal.aborted) throw e; errRed = e; }
        if (res) {
            if (!res.ok) throw errHttp(res.status);
            if (alRecibir) alRecibir();
            var json = await res.json();
            if (cache) { try { await cache.put(url, new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } })); } catch (e) { /* ignorar */ } }
            return normalizarManifiesto(json, url);
        }
        if (cache) { var hit = await cache.match(url); if (hit) return normalizarManifiesto(await hit.json(), url); }
        throw errRed;
    }
    async function resolverLista(recurso, cache, signal, alRecibir) {
        var a = analizarRecurso(recurso);
        if (a.tipo === 'vacio') { var e0 = new Error('vacío'); e0.tipo = 'vacio'; throw e0; }
        var urls = a.tipo === 'lista' ? a.urls : await leerManifiesto(a.url, cache, signal, alRecibir);
        if (!urls.length) { var e1 = new Error('sin fotos'); e1.tipo = 'sin-fotos'; throw e1; }
        return urls;
    }
    // ¿Está ya toda la colección en caché? → { urls } o null
    async function leerSetDeCache(recurso, cache) {
        if (!cache) return null;
        var a = analizarRecurso(recurso), urls;
        if (a.tipo === 'vacio') return null;
        if (a.tipo === 'lista') urls = a.urls;
        else { var hit = await cache.match(a.url); if (!hit) return null; urls = normalizarManifiesto(await hit.json(), a.url); }
        if (!urls.length) return null;
        for (var i = 0; i < urls.length; i++) { if (!(await cache.match(urls[i]))) return null; }
        return { urls: urls };
    }
    // Descarga la colección a la caché del navegador. o: { signal, esperar(), alProgreso(n,total,bytes), alRecibir() }
    async function descargarSet(recurso, cache, o) {
        o = o || {};
        var urls = await resolverLista(recurso, cache, o.signal, o.alRecibir);
        var total = urls.length, hechas = 0, bytes = 0, sig = 0, faltan = [], fallo = null;
        if (o.alProgreso) o.alProgreso(0, total, 0);
        async function uno(u) {
            if (await cache.match(u)) { hechas++; if (o.alProgreso) o.alProgreso(hechas, total, bytes); return; }
            if (o.esperar) await o.esperar();
            var res = await fetch(u, { mode: 'cors', credentials: 'omit', signal: o.signal });
            if (!res.ok) { if (res.status === 404 || res.status === 410) { faltan.push(u); hechas++; if (o.alProgreso) o.alProgreso(hechas, total, bytes); return; } throw errHttp(res.status); }
            if (o.alRecibir) o.alRecibir();
            var blob = await res.blob();
            bytes += blob.size;
            await cache.put(u, new Response(blob, { headers: { 'Content-Type': blob.type || res.headers.get('content-type') || 'image/jpeg', 'Content-Length': String(blob.size) } }));
            hechas++; if (o.alProgreso) o.alProgreso(hechas, total, bytes);
        }
        async function trabajador() {
            while (!fallo && sig < urls.length) { var u = urls[sig++]; try { await uno(u); } catch (e) { fallo = fallo || e; } }
        }
        await Promise.all([trabajador(), trabajador()]);
        if (fallo) throw fallo;
        if (faltan.length === total) throw errHttp(404);
        return { urls: urls.filter(function (u) { return faltan.indexOf(u) < 0; }), bytes: bytes, faltan: faltan };
    }
    function decodificarBlob(blob, maxLado) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(blob), img = new global.Image();
            img.onload = function () {
                try {
                    var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxLado / Math.max(w, h));
                    var cv = global.document.createElement('canvas');
                    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
                    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                    URL.revokeObjectURL(url); resolve(cv);
                } catch (e) { URL.revokeObjectURL(url); reject(e); }
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('imagen no válida')); };
            img.src = url;
        });
    }
    // Decodifica (y reduce) las fotos en memoria. o: { destino[], maxLado, cache, red, signal, alProgreso(n,total) }
    async function decodificarSet(urls, o) {
        var destino = o.destino, maxLado = o.maxLado || 720, hechas = 0, sig = 0;
        async function trabajador() {
            while (sig < urls.length && !(o.signal && o.signal.aborted)) {
                var i = sig++;
                try {
                    var blob = null;
                    if (o.cache) { var hit = await o.cache.match(urls[i]); if (hit) blob = await hit.blob(); }
                    if (!blob && o.red !== false) {
                        var res = await fetch(urls[i], { mode: 'cors', credentials: 'omit', signal: o.signal });
                        if (res.ok) blob = await res.blob();
                    }
                    if (blob) destino[i] = await decodificarBlob(blob, maxLado);
                } catch (e) { if (o.signal && o.signal.aborted) return; }
                hechas++; if (o.alProgreso) o.alProgreso(hechas, urls.length, destino.filter(Boolean).length);
            }
        }
        await Promise.all([trabajador(), trabajador()]);
        return destino;
    }

    global.VaneEfectos = {
        AJUSTES: ajustesDe, TIPOS: Object.keys(CATALOGO), NOMBRES: Object.keys(CATALOGO).reduce(function (m, k) { m[k] = CATALOGO[k].nombre; return m; }, {}), MURO: MURO,
        crearEfecto: crearEfecto, crearPlayer: crearPlayer, hash: hash,
        analizarRecurso: analizarRecurso, resolverLista: resolverLista, leerSetDeCache: leerSetDeCache,
        descargarSet: descargarSet, decodificarSet: decodificarSet,
        MAX_FOTOS: MAX_FOTOS
    };
})(typeof window !== 'undefined' ? window : globalThis);
