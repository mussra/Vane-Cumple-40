#!/usr/bin/env python3
"""
Prepara una carpeta de fotos para los efectos «Fuegos artificiales» y «Nave espacial».

  python tools/preparar_fotos.py MI_CARPETA            -> crea MI_CARPETA/web/ con las fotos reducidas + fotos.json
  python tools/preparar_fotos.py MI_CARPETA --lado 1400 --calidad 80

Después sube TODO el contenido de MI_CARPETA/web/ a una carpeta de tu bucket (p. ej. caso4/) y en el panel de
administración pon como recurso la URL de esa carpeta acabada en «/»:  https://media.vanecumple40.com/caso4/

Las fotos se reducen (1600 px por defecto, JPG) para que 16 móviles las descarguen rápido y gastar poco ancho de banda.
Necesita Pillow para reducir (pip install pillow); sin él solo genera el fotos.json con los archivos tal cual.
"""
import argparse, json, shutil, sys
from pathlib import Path

EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('carpeta')
    ap.add_argument('--lado', type=int, default=1600, help='lado mayor máximo en píxeles (1600)')
    ap.add_argument('--calidad', type=int, default=82, help='calidad JPG (82)')
    a = ap.parse_args()
    origen = Path(a.carpeta)
    if not origen.is_dir():
        sys.exit(f'No existe la carpeta: {origen}')
    destino = origen / 'web'
    destino.mkdir(exist_ok=True)
    try:
        from PIL import Image, ImageOps
    except ImportError:
        Image = None
        print('Aviso: sin Pillow las fotos NO se reducen (pip install pillow).')
    nombres = []
    for f in sorted(p for p in origen.iterdir() if p.is_file() and p.suffix.lower() in EXT):
        if Image is None:
            shutil.copy2(f, destino / f.name); nombres.append(f.name); continue
        try:
            im = ImageOps.exif_transpose(Image.open(f))
            im.thumbnail((a.lado, a.lado))
            out = f.stem.replace(' ', '_') + '.jpg'
            im.convert('RGB').save(destino / out, 'JPEG', quality=a.calidad, optimize=True, progressive=True)
            nombres.append(out)
        except Exception as e:                      # p. ej. HEIC sin soporte
            print(f'  ! {f.name}: {e}')
    if not nombres:
        sys.exit('No se encontró ninguna foto válida.')
    (destino / 'fotos.json').write_text(json.dumps(nombres, ensure_ascii=False, indent=2), encoding='utf-8')
    mb = sum(p.stat().st_size for p in destino.iterdir() if p.is_file()) / 1048576
    print(f'{len(nombres)} fotos preparadas en {destino}  ({mb:.1f} MB en total)')
    print('Sube el contenido de esa carpeta (incluido fotos.json) a tu bucket.')

if __name__ == '__main__':
    main()
