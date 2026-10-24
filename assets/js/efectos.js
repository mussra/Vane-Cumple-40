/* ============================================================================
   EFECTOS DE FOTOS PARA "EL JUEGO DE SU MEMORIA"
   - Fuegos artificiales de fotos  (tipo 'fotos-fuegos')
   - Nave espacial entre meteoritos y fotos (tipo 'fotos-nave')

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
    function ahoraMs() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

    /* Foto de la lista; si aún no se ha decodificado, se usa otra ya disponible (arranque parcial) */
    function fotoDe(imgs, idx) {
        var im = imgs[idx];
        if (im) return im;
        for (var i = 0; i < imgs.length; i++) { var o = imgs[(idx + i) % imgs.length]; if (o) return o; }
        return null;
    }

    /* Marco tipo polaroid con halo de color. La foto se muestra COMPLETA (sin recortar). */
    function pintarFoto(ctx, img, x, y, S, rot, alpha, hue, brillo) {
        if (alpha <= 0.003) return;
        var iw = img ? img.width : 4, ih = img ? img.height : 3;
        var k = Math.min(S / iw, S / ih), dw = iw * k, dh = ih * k;
        var b = S * 0.05, base = S * 0.07;
        var fw = dw + 2 * b, fh = dh + 2 * b + base;
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
                    if (af < 0 || af > VIDA) continue;
                    var vu = salidaCubica(af / VUELA);
                    var px2 = c.x + Math.cos(f.ang) * rho * f.rad * vu + Math.sin(af * 0.9 + f.ph) * S * 0.025;
                    var py2 = c.y + Math.sin(f.ang) * rho * f.rad * vu + Math.cos(af * 0.7 + f.ph) * S * 0.03;
                    var esc = (0.35 + 0.65 * vu) * (1 + 0.022 * Math.sin(af * 2.1 + f.ph));
                    var al = Math.min(1, af / 0.22), rot = f.rot + (1 - vu) * 0.9 * (j % 2 ? 1 : -1) + Math.sin(af * 0.8 + f.ph) * 0.035;
                    if (af > HOLD) {
                        var o = (af - HOLD) / (VIDA - HOLD);
                        al *= 1 - o; py2 += o * o * S * 0.35; esc *= 1 + o * 0.08;
                    }
                    pintarFoto(ctx, fotoDe(imgs, f.idx), px2, py2, S * esc, rot, al, f.hue, 0.22);
                }
            }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: sonidos, musica: null };
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

        function dibujar(ctx, w, h, t) {
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
                    pintarFoto(ctx, fotoDe(imgs, ff.idx), fx, fy, Sf, ff.rot + Math.sin(t * 0.5 + ff.ph) * 0.05, alf, ff.hue, 0.24);
                }
            }
            if (!navePintada) pintarNaveEspacial(ctx, nx, shipY + Math.sin(t * 2.3) * D * 0.006, sNave, roll, t);
            // Final: fundido a negro
            var fin = clamp(1 - (duracion - t) / 1.6, 0, 1);
            if (fin > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fin.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        var ev = []; met.forEach(function (m) { ev.push({ t: m.T, tipo: 'whoosh', v: 0.4 }); });
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'espacio' };
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
            var fo = clamp(1 - (duracion - t) / 1.2, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
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
            var fo = clamp(1 - (duracion - t) / 1.2, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
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
        function dibujar(ctx, w, h, t) {
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
                if (u >= 1 && brillo >= 0) {                                   // barrido dorado al final
                    var dx = ((tx - ox) / tamTotalW + (ty - oy) / tamTotalH) * 0.5, a = Math.max(0, 1 - Math.abs(dx - ((brillo * 1.6) % 1.4 - 0.2)) * 7);
                    if (a > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,220,120,' + (a * 0.65).toFixed(3) + ')'; ctx.fillRect(-s / 2, -s / 2, s, s); }
                }
                ctx.restore();
            }
            var rr = rngDe(seed + 5); if (llegadas > 0.5) chispas(ctx, w, h, t, 90, rr);
            var fo = clamp(1 - (duracion - t) / 1.2, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'magico' };
    }

    /* ======================================================================
       EFECTO 6: ENFOQUE DE MISTERIO — cada foto aparece borrosa y se va descubriendo
       ====================================================================== */
    function crearEnfoque(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), TF = 8.6, duracion = 1 + N * TF + 1;
        var niveles = [6, 10, 16, 26, 42, 70, 120, 220, 9999];
        var fases = []; for (var i = 0; i < N; i++) fases.push({ a: rnd() * TAU, b: rnd() * TAU, f1: 0.6 + rnd() * 0.5, f2: 0.8 + rnd() * 0.5 });
        function dibujar(ctx, w, h, t) {
            fondoNoche(ctx, w, h, '#07050f', '#130a22');
            var k = Math.floor((t - 1) / TF); if (k < 0 || k >= N) { var rr = rngDe(seed + 1); chispas(ctx, w, h, t, 60, rr); return; }
            var l = t - 1 - k * TF, img = fotoDe(imgs, orden[k % N]), fz = fases[k];
            var caja = cajaFoto(img, w * 0.9, h * 0.78), x = w / 2, y = h * 0.5, fw = caja.w, fh = caja.h;
            var alfa = Math.min(clamp(l / 0.6, 0, 1), clamp((TF - l) / 0.5, 0, 1));
            var prog = clamp((l - 0.6) / 5.0, 0, 1), nivel = prog * (niveles.length - 2), n0 = Math.floor(nivel), fr = nivel - n0;
            ctx.save(); ctx.globalAlpha = alfa; ctx.translate(x, y);
            var b = Math.min(fw, fh) * 0.035; ctx.fillStyle = '#f7f7f7'; ctx.shadowColor = 'rgba(255,230,160,0.55)'; ctx.shadowBlur = Math.min(w, h) * 0.05;
            ctx.fillRect(-fw / 2 - b, -fh / 2 - b, fw + 2 * b, fh + 2 * b); ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.rect(-fw / 2, -fh / 2, fw, fh); ctx.clip();
            ctx.imageSmoothingEnabled = true;
            var A = copiaEscalada(img, niveles[n0]), B = copiaEscalada(img, niveles[n0 + 1]);
            ctx.drawImage(A, -fw / 2, -fh / 2, fw, fh); ctx.globalAlpha = alfa * fr; ctx.drawImage(B, -fw / 2, -fh / 2, fw, fh); ctx.globalAlpha = alfa;
            if (prog < 1) {                                                    // foco que recorre la foto y la deja nítida
                var rad = Math.min(fw, fh) * (0.2 + 0.14 * prog), lx = Math.sin(t * fz.f1 + fz.a) * fw * 0.32, ly = Math.cos(t * fz.f2 + fz.b) * fh * 0.32;
                ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, rad, 0, TAU); ctx.clip(); ctx.drawImage(img, -fw / 2, -fh / 2, fw, fh); ctx.restore();
                ctx.strokeStyle = 'rgba(255,240,190,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly, rad, 0, TAU); ctx.stroke();
            } else ctx.drawImage(img || A, -fw / 2, -fh / 2, fw, fh);
            var ff = (l - 5.6) / 0.7; if (ff > 0 && ff < 1) { ctx.fillStyle = 'rgba(255,255,255,' + ((1 - ff) * 0.8).toFixed(3) + ')'; ctx.fillRect(-fw / 2, -fh / 2, fw, fh); }
            ctx.restore();
            if (prog < 1) { ctx.save(); ctx.globalAlpha = alfa * (1 - prog); ctx.font = 'bold ' + Math.round(Math.min(w * 0.08, 34)) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde9a8'; ctx.fillText('¿Quién será?', w / 2, h * 0.07); ctx.restore(); }
            var fo = clamp(1 - (duracion - t) / 1.0, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) { ev.push({ t: 1 + q0 * TF + 0.1, tipo: 'whoosh', v: 0.4 }, { t: 1 + q0 * TF + 5.6, tipo: 'ding', v: 1 }); }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'nostalgia' };
    }

    /* ======================================================================
       EFECTO 7: ROMPECABEZAS — las piezas vuelan y la foto se recompone
       ====================================================================== */
    function crearPuzzle(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), CX = 4, CY = 3, TF = 9, duracion = 1 + N * TF + 1;
        var piezas = []; for (var i = 0; i < CX * CY; i++) piezas.push({ ang: rnd() * TAU, dist: 0.8 + rnd() * 0.5, rot: (rnd() - 0.5) * 5, d: rnd() * 0.9 });
        function dibujar(ctx, w, h, t) {
            fondoNoche(ctx, w, h, '#0a0a18', '#1a1030');
            var k = Math.floor((t - 1) / TF), rr = rngDe(seed + 2); chispas(ctx, w, h, t, 40, rr);
            if (k < 0 || k >= N) return;
            var l = t - 1 - k * TF, img = fotoDe(imgs, orden[k % N]), cb = cajaFoto(img, w * 0.9, h * 0.74), fw = cb.w, fh = cb.h;
            var x0 = (w - fw) / 2, y0 = (h - fh) / 2, pw = fw / CX, ph = fh / CY, sw = img.width / CX, sh = img.height / CY;
            for (var p = 0; p < piezas.length; p++) {
                var pi = piezas[p], cx = p % CX, cy = Math.floor(p / CX);
                var entra = clamp((l - 0.3 - pi.d) / 1.2, 0, 1), sale = clamp((l - 7.3 - pi.d * 0.5) / 1.1, 0, 1);
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
            if (l > 4.0 && l < 7.4) {                                          // foto completa: marco y destello
                var a = Math.min(clamp((l - 4.0) / 0.5, 0, 1), clamp((7.4 - l) / 0.5, 0, 1));
                ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fde9a8'; ctx.lineWidth = Math.max(3, w * 0.01); ctx.shadowColor = '#f5b82e'; ctx.shadowBlur = w * 0.04; ctx.strokeRect(x0, y0, fw, fh); ctx.restore();
            }
            var fo = clamp(1 - (duracion - t) / 1.0, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) { var b0 = 1 + q0 * TF; piezas.forEach(function (pz) { ev.push({ t: b0 + 0.3 + pz.d + 1.2, tipo: 'click', v: 0.6 }); }); ev.push({ t: b0 + 4.0, tipo: 'chime', v: 0.9 }, { t: b0 + 7.3, tipo: 'whoosh', v: 0.5 }); }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'magico' };
    }

    /* ======================================================================
       EFECTO 8: POLAROIDS REVELADAS — salen en blanco, se revelan y forman un collage
       ====================================================================== */
    function crearPolaroid(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), INT = 5.2, duracion = 1 + (N - 1) * INT + 6.8 + 3;
        var casillas = barajar(N + 10, rnd), items = [];
        for (var j = 0; j < N; j++) items.push({ idx: orden[j], cas: casillas[j], rot: (rnd() - 0.5) * 0.5, ph: rnd() * TAU, jx: rnd() - 0.5, jy: rnd() - 0.5 });
        function dibujar(ctx, w, h, t) {
            var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2b1b12'); g.addColorStop(1, '#171009'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            var cols = w < h ? 4 : 7, filas = Math.ceil((N + 10) / cols), S = Math.min(w, h) * 0.78, Sp = Math.min(w / cols * 1.15, h / filas * 1.15) * 0.92, j;
            for (j = 0; j < N; j++) {
                var it = items[j], tj = 1 + j * INT, l = t - tj; if (l < 6.0) continue;
                var cx0 = it.cas % cols, cy0 = Math.floor(it.cas / cols), px = (cx0 + 0.5 + it.jx * 0.3) / cols * w, py = (cy0 + 0.5 + it.jy * 0.3) / filas * h;
                var e = suave((l - 6.0) / 0.8);
                var fx = lerp(w / 2, px, e), fy = lerp(h * 0.5, py, e), esc = lerp(1, Sp / S, e);
                pintarFoto(ctx, fotoDe(imgs, it.idx), fx, fy, S * esc, lerp(0, it.rot, e), 0.97, 40, 0.06);
            }
            var k = Math.floor((t - 1) / INT); if (k >= 0 && k < N) {
                var l2 = t - 1 - k * INT; if (l2 < 6.8) {
                    var itc = items[k], dentro = salidaCubica(l2 / 1.0), caeA = l2 > 6.0 ? suave((l2 - 6.0) / 0.8) : 0, img = fotoDe(imgs, itc.idx);
                    if (caeA === 0) {
                        var yc = lerp(h * 1.0 + S * 0.5, h * 0.5, dentro), cb = cajaFoto(img, S, S), b = S * 0.05, base = S * 0.07, fw = cb.w + 2 * b, fh = cb.h + 2 * b + base;
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
                        pintarFoto(ctx, img, lerp(w / 2, ppx, caeA), lerp(h * 0.5, ppy, caeA), lerp(S, Sp, caeA), lerp(0, c2.rot, caeA), 0.97, 40, 0.06);
                    }
                }
            }
            var fo = clamp(1 - (duracion - t) / 1.4, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        var ev = []; for (var q0 = 0; q0 < N; q0++) { var tj = 1 + q0 * INT; ev.push({ t: tj + 0.05, tipo: 'obturador', v: 1 }, { t: tj + 0.2, tipo: 'impresora', v: 0.8 }, { t: tj + 4.9, tipo: 'ding', v: 0.8 }); }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'nostalgia' };
    }

    /* ======================================================================
       EFECTO 9: TÚNEL DEL TIEMPO — viaje por un túnel con las fotos en las paredes
       ====================================================================== */
    function crearTunel(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), V = 1.25, GAP = 3.4, Z0 = 9, duracion = (Z0 + (N - 1) * GAP + 3.5) / V;
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
            var F = w * 0.5, vx = w / 2, vy = h / 2, Y0 = h / w * X0, cam = V * t, k;
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
            var fo = clamp(1 - (duracion - t) / 1.4, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        var ev = []; paneles.forEach(function (pn) { ev.push({ t: (pn.z - 2.4) / V, tipo: 'whoosh', v: 0.5 }); });
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: 'espacio' };
    }

    /* ======================================================================
       EFECTO 10: FAROLILLOS AL CIELO — fotos que suben flotando en la noche
       ====================================================================== */
    function crearFarolillos(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), INT = 2.4, VIDA = 15, duracion = 1 + (N - 1) * INT + VIDA + 1, j;
        var fa = [], estrellas = crearEstrellas(rnd, 110), orbes = [];
        for (j = 0; j < N; j++) fa.push({ T: 1 + j * INT, x: 0.14 + rnd() * 0.72, prof: 0.8 + rnd() * 0.45, ph: rnd() * TAU, amp: 0.02 + rnd() * 0.035, idx: orden[j] });
        for (j = 0; j < Math.floor(duracion / 0.8); j++) orbes.push({ T: rnd() * duracion, x: rnd(), v: 0.06 + rnd() * 0.06, r: 2 + rnd() * 4, ph: rnd() * TAU });
        function dibujar(ctx, w, h, t) {
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
                var f = fa[j], l = t - f.T; if (l < 0 || l > VIDA) continue;
                var u = l / VIDA, py = lerp(h + Sb * 0.8, -Sb * 0.9, u), px = (f.x + Math.sin(l * 0.55 + f.ph) * f.amp) * w, sz = Sb * f.prof;
                var al = Math.min(clamp(l / 1.2, 0, 1), clamp((VIDA - l) / 1.8, 0, 1)), fl = 0.88 + 0.12 * Math.sin(l * 9 + f.ph);
                var gr = ctx.createRadialGradient(px, py, 0, px, py, sz * 1.15); gr.addColorStop(0, 'rgba(255,170,60,' + (0.55 * al * fl).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)');
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(px - sz * 1.2, py - sz * 1.2, sz * 2.4, sz * 2.4); ctx.restore();
                pintarFoto(ctx, fotoDe(imgs, f.idx), px, py, sz, Math.sin(l * 0.8 + f.ph) * 0.07, al, 30, 0.2);
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * fl;
                var fg = ctx.createRadialGradient(px, py + sz * 0.62, 0, px, py + sz * 0.62, sz * 0.2); fg.addColorStop(0, 'rgba(255,240,170,0.95)'); fg.addColorStop(1, 'rgba(255,140,40,0)');
                ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(px, py + sz * 0.62, sz * 0.07, sz * 0.14, 0, 0, TAU); ctx.fill(); ctx.restore();
            }
            var fo = clamp(1 - (duracion - t) / 1.2, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: [], musica: 'magico' };
    }

    /* ======================================================================
       EFECTO 11: LLUVIA DE RECUERDOS — fotos que caen girando entre confeti
       ====================================================================== */
    function crearLluvia(imgs, seed) {
        var N = Math.max(1, imgs.length), rnd = rngDe(seed), orden = barajar(N, rnd), INT = 1.35, j, conf = [];
        var fo = [], maxVida = 0;
        for (j = 0; j < N; j++) { var vida = 8.5 + rnd() * 3; maxVida = Math.max(maxVida, vida); fo.push({ T: 1 + j * INT, x: 0.12 + rnd() * 0.76, vida: vida, prof: 0.75 + rnd() * 0.5, ph: rnd() * TAU, fr: 0.7 + rnd() * 0.8, rot: (rnd() - 0.5) * 1.2, idx: orden[j], hue: Math.floor(rnd() * 360) }); }
        var duracion = 1 + (N - 1) * INT + 12.5;
        for (j = 0; j < 90; j++) conf.push({ x: rnd(), v: 0.08 + rnd() * 0.12, ph: rnd(), w: 3 + rnd() * 6, hue: Math.floor(rnd() * 360), sp: 1 + rnd() * 3 });
        function dibujar(ctx, w, h, t) {
            fondoNoche(ctx, w, h, '#0a0620', '#1c0e3a');
            var s;
            for (s = 0; s < conf.length; s++) {
                var c = conf[s], y = (((c.ph + t * c.v) % 1) * (h + 40)) - 20, x = (c.x + Math.sin(t * 0.8 + c.ph * 9) * 0.03) * w, e = Math.abs(Math.cos(t * c.sp + c.ph * 7));
                ctx.fillStyle = 'hsla(' + c.hue + ',90%,62%,0.8)'; ctx.save(); ctx.translate(x, y); ctx.rotate(t * c.sp); ctx.fillRect(-c.w / 2, -c.w * e / 2, c.w, Math.max(1, c.w * e)); ctx.restore();
            }
            var Sb = Math.min(w * 0.34, h * 0.19);
            for (j = 0; j < N; j++) {
                var f = fo[j], l = t - f.T; if (l < 0 || l > f.vida) continue;
                var u = l / f.vida, sz = Sb * f.prof, py = lerp(-sz * 0.9, h + sz * 0.9, u), px = (f.x + Math.sin(l * f.fr + f.ph) * 0.07) * w;
                var al = Math.min(clamp(l / 0.6, 0, 1), clamp((f.vida - l) / 0.6, 0, 1));
                var giro = Math.cos(l * f.fr * 1.3 + f.ph), esc = 0.55 + 0.45 * Math.abs(giro);       // aleteo: la foto "gira" al caer
                ctx.save(); ctx.translate(px, py); ctx.scale(esc, 1); ctx.translate(-px, -py);
                pintarFoto(ctx, fotoDe(imgs, f.idx), px, py, sz, f.rot + Math.sin(l * f.fr + f.ph) * 0.25, al, f.hue, 0.16);
                ctx.restore();
            }
            var ff = clamp(1 - (duracion - t) / 1.2, 0, 1); if (ff > 0) { ctx.fillStyle = 'rgba(0,0,0,' + ff.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: [], musica: 'fiesta' };
    }

    /* ======================================================================
       EFECTO 12: TRAGAPERRAS DE RECUERDOS — tres rodillos giran y se paran en tres fotos
       ====================================================================== */
    function crearTragaperras(imgs, seed) {
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
            ctx.fillStyle = '#5a3406'; ctx.font = 'bold ' + Math.round(s * 0.42) + 'px Lora, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('40', x, y + 2);
        }
        function dibujar(ctx, w, h, t) {
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
            var fo = clamp(1 - (duracion - t) / 1.2, 0, 1); if (fo > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fo.toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
        }
        return { duracion: duracion, dibujar: dibujar, sonidos: ev, musica: null };
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
        'fotos-tragaperras': { nombre: 'Fotos · Tragaperras de recuerdos', crear: crearTragaperras }
    };
    var MURO = { LW: 480, LH: 1000, tipos: ['fotos-muro', 'fotos-ola'] };   // celda lógica de referencia (móvil vertical)

    // Crea el efecto. opc.duracion (s): duración total deseada; el efecto se estira o comprime a ese tiempo (velocidad = natural / deseada)
    function crearEfecto(tipo, imgs, seed, opc) {
        opc = opc || {};
        var d = CATALOGO[tipo] || CATALOGO['fotos-fuegos'], base = d.crear(imgs, seed), D0 = base.duracion;
        var D = (Number(opc.duracion) >= 10) ? Math.min(Number(opc.duracion), 3600) : D0, k = D0 / D;
        if (Math.abs(k - 1) < 1e-6) { base.natural = D0; base.velocidad = 1; return base; }
        return {
            duracion: D, natural: D0, velocidad: k, muro: base.muro, musica: base.musica,
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
        whoosh: function (ac, t, v) { ruidoV(ac, AU.sfx, { t: t, dur: 0.6, vol: 0.12 * v, filtro: 'bandpass', f1: 300, f2: 2400, q: 1.5 }); }
    };
    function sonar(tipo, volumen, v) {
        var ac = audioCtx(); if (!ac || !SFX[tipo]) return;
        try { AU.sfx.gain.value = clamp(volumen == null ? 1 : volumen, 0, 1); SFX[tipo](ac, ac.currentTime + 0.01, v == null ? 1 : v); } catch (e) { /* ignorar */ }
    }

    /* Música generativa: cinco estilos. Cada paso depende solo del número de paso → determinista y a compás en todos los móviles */
    var ESTILOS = {
        celebracion: { bpm: 112, raiz: 60, vol: 0.5, acordes: [[0, 4, 7, 12], [9, 12, 16, 21], [5, 9, 12, 17], [7, 11, 14, 19]], patron: [0, 1, 2, 3, 2, 1, 2, 3], tipo: 'triangle', arpVol: 0.1, pad: 0.05, bajo: 0.17, lp: 3200, eco: 0.2, perc: true },
        fiesta:      { bpm: 124, raiz: 57, vol: 0.5, acordes: [[0, 4, 7, 12], [9, 12, 16, 19], [5, 9, 12, 17], [7, 11, 14, 19]], patron: [0, 2, 1, 2, 0, 3, 1, 2], tipo: 'triangle', arpVol: 0.11, pad: 0.04, bajo: 0.18, lp: 3600, eco: 0.15, perc: true },
        espacio:     { bpm: 64,  raiz: 50, vol: 0.55, acordes: [[0, 3, 7, 12], [8, 12, 15, 20], [3, 7, 10, 15], [10, 14, 17, 22]], patron: [0, -1, 2, -1, 1, -1, 3, -1], tipo: 'sine', arpVol: 0.09, pad: 0.07, bajo: 0.12, lp: 1800, eco: 0.7, perc: false, dron: true, durArp: 4 },
        nostalgia:   { bpm: 72,  raiz: 53, vol: 0.5, acordes: [[0, 4, 7, 12], [9, 12, 16, 19], [5, 9, 12, 17], [7, 11, 14, 19]], patron: [0, 2, 1, 3, 0, 2, 1, 3], tipo: 'triangle', arpVol: 0.12, pad: 0.06, bajo: 0.12, lp: 2400, eco: 0.35, perc: false, durArp: 3 },
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
                try { AU.musica.gain.setTargetAtTime(E.vol * clamp(vol == null ? 1 : vol, 0, 1), ac.currentTime, 0.05); } catch (e) { /* ignorar */ }
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
            for (var i = 0; i < efecto.sonidos.length; i++) { var e = efecto.sonidos[i]; if (e.t > desde && e.t <= hasta) sonar(e.tipo, canvas.volume, e.v); }
        }
        function audioEfecto(t) {
            if (!efecto || !efecto.musica) return;
            if (jugando && !canvas.muted) { if (!musica) musica = crearMusica(efecto.musica); if (musica) musica.avanzar(t, rate, canvas.volume); }
            else if (musica) musica.detener();
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
            controls: { configurable: true, writable: true, value: false },
            preload: { configurable: true, writable: true, value: 'auto' },
            esEfecto: { configurable: true, value: true },
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
            establecerImagenes: { configurable: true, value: function (arr) {
                imgs = arr;
                efecto = crearEfecto(tipo, imgs, seed, { duracion: (typeof opts.duracion === 'function') ? opts.duracion() : opts.duracion });
                if (!listo) { listo = true; emitir('loadedmetadata'); emitir('canplay'); }
            } },
            destruir: { configurable: true, value: function () { destruido = true; jugando = false; if (musica) musica.detener(); if (raf) global.cancelAnimationFrame(raf); raf = 0; } }
        };
        Object.keys(props).forEach(function (k) { Object.defineProperty(canvas, k, props[k]); });
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
        TIPOS: Object.keys(CATALOGO), NOMBRES: Object.keys(CATALOGO).reduce(function (m, k) { m[k] = CATALOGO[k].nombre; return m; }, {}), MURO: MURO,
        crearEfecto: crearEfecto, crearPlayer: crearPlayer, hash: hash,
        analizarRecurso: analizarRecurso, resolverLista: resolverLista, leerSetDeCache: leerSetDeCache,
        descargarSet: descargarSet, decodificarSet: decodificarSet,
        MAX_FOTOS: MAX_FOTOS
    };
})(typeof window !== 'undefined' ? window : globalThis);
