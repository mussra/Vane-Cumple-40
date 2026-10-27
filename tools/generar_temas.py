#!/usr/bin/env python3
"""Genera assets/css/temas.css a partir de las clases Tailwind usadas en index.html y assets/js/efectos.js.
Uso (desde la raiz del repo):  python tools/generar_temas.py
Si anades clases de color nuevas (slate/stone/amber...), vuelve a ejecutarlo.
El tema 'luxury' es el estilo original: no lleva sobrescrituras (solo las variables por defecto de :root)."""
import re, pathlib
RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = [RAIZ/'index.html', RAIZ/'assets/js/efectos.js']
OUT = RAIZ/'assets/css/temas.css'

# ---------- Paletas (tripletas RGB) ----------
N = ['100','200','300','400','500','600','700','800','900','950']
A = ['100','300','400','500','600','900','950']
def pal(n, a, on, strong, pg, pg2, pg3, g, ring, track, thumb, mode, color):
    return dict(n=dict(zip(N, n)), a=dict(zip(A, a)), on=on, strong=strong, pg=pg, pg2=pg2, pg3=pg3, g=g, ring=ring, track=track, thumb=thumb, mode=mode, color=color)
T = {}
T['luxury'] = pal(
 ['241 245 249','226 232 240','203 213 225','148 163 184','100 116 139','71 85 105','51 65 85','30 41 59','15 23 42','2 6 23'],
 ['254 243 199','252 211 77','251 191 36','245 158 11','217 119 6','120 53 15','69 26 3'],
 '2 6 23','255 255 255','11 15 25','17 24 39','13 18 32',('#FFF099','#D4AF37','#AA7C11'),'#fbbf24','#0b0f19','#1f2937','dark','#0b0f19')
T['dark'] = pal(
 ['244 244 245','228 228 231','212 212 216','161 161 170','113 113 122','82 82 91','63 63 70','39 39 42','24 24 27','9 9 11'],
 ['224 231 255','165 180 252','129 140 248','99 102 241','79 70 229','49 46 129','30 27 75'],
 '255 255 255','255 255 255','9 9 11','24 24 27','14 14 17',('#c7d2fe','#818cf8','#4f46e5'),'#818cf8','#09090b','#3f3f46','dark','#09090b')
T['cloud'] = pal(
 ['15 23 42','30 41 59','51 65 85','71 85 105','100 116 139','160 184 216','203 219 240','241 247 254','255 255 255','224 236 250'],
 ['12 74 110','3 105 161','2 132 199','14 165 233','2 132 199','186 230 253','224 242 254'],
 '255 255 255','15 23 42','238 246 255','224 238 252','232 242 254',('#0284c7','#0ea5e9','#6366f1'),'#0ea5e9','#e0eefc','#9cc0e8','light','#eef6ff')
T['green'] = pal(
 ['236 248 241','215 235 224','190 215 200','148 180 162','100 135 115','52 90 70','30 65 48','16 44 32','8 28 20','4 15 10'],
 ['209 250 229','110 231 183','52 211 153','16 185 129','5 150 105','6 78 59','2 44 34'],
 '4 15 10','255 255 255','3 18 12','6 32 22','4 24 16',('#d1fae5','#34d399','#059669'),'#34d399','#03120c','#1e4a36','dark','#03120c')
T['betis'] = pal(
 ['255 255 255','232 246 238','205 235 218','168 218 190','120 190 150','30 135 80','10 110 62','0 84 46','0 62 34','0 40 22'],
 ['255 255 255','187 247 208','134 239 172','255 255 255','220 245 230','0 70 38','0 48 26'],
 '0 84 46','255 255 255','0 44 24','0 66 36','0 52 28',('#ffffff','#b7f7cf','#4ade80'),'#ffffff','#002c18','#0a6e3e','dark','#002c18')
T['sevilla'] = pal(
 ['255 250 250','242 226 228','228 200 204','205 160 166','170 110 118','120 36 48','82 22 32','48 14 20','28 8 12','12 4 6'],
 ['255 225 228','255 140 150','248 80 96','220 20 40','190 10 30','110 10 24','70 6 16'],
 '255 255 255','255 255 255','14 4 6','34 8 14','20 6 10',('#ffffff','#fecaca','#ef4444'),'#ff6b7a','#0e0406','#52161f','dark','#0e0406')
T['cookie'] = pal(
 ['46 26 14','67 40 24','87 58 40','110 80 58','140 105 80','190 155 120','226 200 170','247 233 215','255 251 244','250 234 214'],
 ['80 20 50','157 23 77','190 24 93','219 39 119','190 24 93','252 207 232','253 232 243'],
 '255 255 255','46 26 14','254 247 237','253 236 214','255 244 230',('#be185d','#db2777','#92400e'),'#db2777','#fdf0dc','#e0b98f','light','#fef7ed')
T['kids'] = pal(
 ['46 16 101','59 30 120','76 45 140','91 70 150','109 90 160','167 139 250','196 181 253','237 233 254','255 255 255','224 242 254'],
 ['88 28 135','126 34 206','194 65 12','249 115 22','234 88 12','254 215 170','255 237 213'],
 '59 7 100','46 16 101','255 247 214','255 236 179','255 241 200',('#ec4899','#f97316','#8b5cf6'),'#8b5cf6','#ffefc2','#c4b5fd','light','#fff7d6')
LIGHT = [k for k, v in T.items() if v['mode'] == 'light']

# ---------- Colores semanticos en temas claros (Tailwind 100..900) ----------
SEM = {
 'rose':    {'100':'255 228 230','200':'254 205 211','500':'244 63 94','600':'225 29 72','700':'190 18 60','800':'159 18 57','900':'136 19 55'},
 'emerald': {'100':'209 250 229','200':'167 243 208','500':'16 185 129','600':'5 150 105','700':'4 120 87','800':'6 95 70','900':'6 78 59'},
 'sky':     {'100':'224 242 254','200':'186 230 253','500':'14 165 233','600':'2 132 199','700':'3 105 161','800':'7 89 133','900':'12 74 110'},
 'indigo':  {'100':'224 231 255','200':'199 210 254','500':'99 102 241','600':'79 70 229','700':'67 56 202','800':'55 48 163','900':'49 46 129'},
}
def sem_light(prop, fam, shade, variant):
    s = int(shade)
    if prop == 'text': return '700' if s in (300, 400) else ('800' if s <= 200 else ('600' if s in (500,600) else None))
    if prop == 'bg' and s >= 850: return '200' if variant == 'hover' else '100'
    return None

# ---------- Descubrimiento de clases ----------
TOK = re.compile(r'(?<![\w\[-])((?:(?:hover|focus|active|disabled|placeholder|selection):)?)(bg|text|border|from|via|to|ring|accent|placeholder|shadow)-(slate|stone|gray|amber|rose|emerald|sky|indigo)-(\d{2,3})(?:/(\d{1,3}))?(?![\w])')
ARB = re.compile(r'(?<![\w\[-])((?:(?:hover|focus):)?)(bg|from|via|to)-\[#([0-9a-fA-F]{6})\](?:/(\d{1,3}))?')
WHITE = re.compile(r'(?<![\w\[-])((?:hover:)?)text-white(?![\w/-])')
usados, arb, blancos = set(), set(), set()
for f in SRC:
    t = f.read_text(encoding='utf-8')
    for m in TOK.finditer(t): usados.add(m.groups())
    for m in ARB.finditer(t): arb.add(m.groups())
    for m in WHITE.finditer(t): blancos.add(m.group(1))

def esc(c): return re.sub(r'([^A-Za-z0-9_-])', r'\\\1', c)
def rgb(var_or_triplet, alpha, literal=False):
    base = var_or_triplet if literal else f'var(--{var_or_triplet})'
    return f'rgb({base} / {int(alpha)/100:g})' if alpha else f'rgb({base})'
PROP = {'bg':'background-color','text':'color','border':'border-color','accent':'accent-color'}

def regla(sel_cls, variant, prop, color):
    """Devuelve (selectores, declaraciones) para una utilidad de Tailwind."""
    cls = '.' + esc(sel_cls)
    selectors = [cls]
    if variant == 'hover': selectors = [cls + ':hover']
    elif variant == 'focus': selectors = [cls + ':focus']
    elif variant == 'active': selectors = [cls + ':active']
    elif variant == 'disabled': selectors = [cls + ':disabled']
    elif variant == 'placeholder': selectors = [cls + '::placeholder']
    elif variant == 'selection': selectors = [cls + '::selection', cls + ' *::selection']
    if prop in PROP: decl = f'{PROP[prop]}:{color}'
    elif prop == 'ring': decl = f'--tw-ring-color:{color}'
    elif prop == 'placeholder': decl = f'color:{color}'
    elif prop == 'shadow': decl = f'--tw-shadow-color:{color};--tw-shadow:var(--tw-shadow-colored)'
    elif prop == 'from': decl = f'--tw-gradient-from:{color} var(--tw-gradient-from-position)'
    elif prop == 'to': decl = f'--tw-gradient-to:{color} var(--tw-gradient-to-position)'
    elif prop == 'via': decl = f'--tw-gradient-stops:var(--tw-gradient-from),{color} var(--tw-gradient-via-position),var(--tw-gradient-to)'
    return selectors, decl

P_ALL = 'html[data-theme]:not([data-theme="luxury"])'
P_LIGHT = 'html:is(' + ','.join(f'[data-theme="{k}"]' for k in LIGHT) + ')'
def emitir(prefix, selectors, decl): return ',\n'.join(f'{prefix} {s}' for s in selectors) + f'{{{decl}}}\n'

css = []
css.append('/* GENERADO por tools/generar_temas.py - no editar a mano (vuelve a ejecutar el script) */\n')
# variables por tema
def vars_block(t):
    v = [f'--n{k}:{x}' for k, x in t['n'].items()] + [f'--a{k}:{x}' for k, x in t['a'].items()]
    v += [f"--on-ac:{t['on']}", f"--tx-strong:{t['strong']}", f"--pg:{t['pg']}", f"--pg2:{t['pg2']}", f"--pg3:{t['pg3']}",
          f"--g1:{t['g'][0]}", f"--g2:{t['g'][1]}", f"--g3:{t['g'][2]}", f"--ring:{t['ring']}", f"--track:{t['track']}", f"--thumb:{t['thumb']}"]
    return ';'.join(v)
css.append(':root{' + vars_block(T['luxury']) + '}\n')
for k, t in T.items():
    if k == 'luxury': continue
    css.append(f'html[data-theme="{k}"]{{{vars_block(t)};color-scheme:{t["mode"]}}}\n')

# utilidades neutras / ambar (todos los temas excepto luxury)
def canal(fam, shade):
    if fam in ('slate', 'stone', 'gray'): return f'n{shade}' if shade in N else None
    if fam == 'amber': return f'a{shade}' if shade in A else None
    return None
faltan = []
for variant, prop, fam, shade, alpha in sorted(usados, key=str):
    v = variant[:-1] if variant else ''
    c = canal(fam, shade)
    nombre = f'{variant}{prop}-{fam}-{shade}' + (f'/{alpha}' if alpha else '')
    if c:
        if prop == 'text' and shade == '950' and fam in ('slate', 'stone') and v == 'selection':
            sel, d = regla(nombre, v, prop, rgb('on-ac', alpha)); css.append(emitir(P_ALL, sel, d)); continue
        if prop == 'text' and shade == '950' and fam in ('slate', 'stone'):
            # solo sobre botones con fondo ambar; en el resto se mantiene el texto oscuro original
            base = '.' + esc(nombre)
            css.append(f'{P_ALL} {base}[class*="bg-amber-"],{P_ALL} {base}[class*="from-amber-"]{{color:{rgb("on-ac", alpha)}}}\n')
            continue
        sel, d = regla(nombre, v, prop, rgb(c, alpha))
        css.append(emitir(P_ALL, sel, d))
    elif fam in SEM:
        # semanticos: solo cambian en temas claros
        ns = sem_light(prop, fam, shade, v)
        if ns and ns in SEM[fam]:
            sel, d = regla(nombre, v, prop, rgb(SEM[fam][ns], alpha, literal=True))
            css.append(emitir(P_LIGHT, sel, d))
    else:
        faltan.append((variant, prop, fam, shade))
# colores arbitrarios
MAP_ARB = {'0b0f19':'pg','111827':'pg2','0d1220':'pg3','1f2937':'n800'}
for variant, prop, hexv, alpha in sorted(arb):
    c = MAP_ARB.get(hexv.lower())
    if not c: faltan.append((variant, prop, 'arb', hexv)); continue
    cls = f'{variant}{prop}-[#{hexv}]' + (f'/{alpha}' if alpha else '')
    sel, d = regla(cls, variant[:-1] if variant else '', prop, rgb(c, alpha))
    css.append(emitir(P_ALL, sel, d))
# text-white (titulos) -> texto fuerte; excepcion: boton sobre el video
for variant in sorted(blancos):
    v = variant[:-1] if variant else ''
    sel, d = regla(f'{variant}text-white', v, 'text', rgb('tx-strong', 0))
    css.append(',\n'.join(f'{P_ALL} {s}:not(.bg-white\\/15)' if not s.endswith('::selection') else f'{P_ALL} {s}' for s in sel) + f'{{{d}}}\n')

extras = (RAIZ/'tools/temas_extra.css').read_text(encoding='utf-8')
css.append(extras)
OUT.write_text(''.join(css), encoding='utf-8')
print('OK ->', OUT, f'({OUT.stat().st_size/1024:.1f} KB)')
if faltan: print('Sin mapear:', faltan)
