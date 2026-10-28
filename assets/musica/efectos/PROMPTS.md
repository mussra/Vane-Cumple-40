# Música y sonidos propios de cada efecto de fotos

## Música de fondo del efecto
Archivo: `assets/musica/efectos/<efecto>.mp3` (bucle de 60 a 120 s, mp3 128 kbps).
Va **sincronizada con el tiempo del efecto** en todos los móviles (como la música actual) y se repite en bucle si el efecto dura más.
Si el archivo no existe, suena la música generada de siempre (o nada, en fuegos y tragaperras).

Receta común al final de cada prompt:
`instrumental, no vocals, seamless loop, constant dynamics, steady tempo, no fade-out, ends on the tonic so it loops`

| Archivo (efecto) | Prompt |
|---|---|
| fotos-fuegos | epic celebratory orchestral fireworks finale, soaring strings, timpani rolls, brass fanfares, triumphant, 120 bpm |
| fotos-nave | cinematic space journey ambient, evolving analog synth pads, slow pulsing arpeggio, wonder and awe, 64 bpm |
| fotos-muro | uplifting festive anthem for a giant video wall, claps, bright synths, driving drums, communal joy, 118 bpm |
| fotos-ola | euphoric light-wave dance, soft house groove, shimmering plucks, rising energy, 122 bpm |
| fotos-mosaico | warm uplifting piano and strings, gentle reveal, hopeful and emotional, 90 bpm |
| fotos-enfoque | mysterious slow-burn suspense, soft ticking, low piano notes, subtle strings tension, curious, 70 bpm |
| fotos-puzzle | playful puzzle-solving, pizzicato strings, glockenspiel, light marimba, quirky and bouncy, 108 bpm |
| fotos-polaroid | nostalgic warm indie acoustic, fingerpicked guitar, soft brushed drums, vintage tape feel, 84 bpm |
| fotos-tunel | time-travel retro synthwave, arpeggios, whooshing pads, forward motion, dreamy, 100 bpm |
| fotos-farolillos | serene lantern festival at night, soft flute, gentle plucked strings, warm pads, peaceful, 66 bpm |
| fotos-lluvia | tender piano with soft rain atmosphere, bittersweet and happy memories, 76 bpm |
| fotos-tragaperras | jazzy ragtime casino, honky-tonk piano, upright bass, playful and flashy, 126 bpm |
| fotos-pasteleria | whimsical bakery waltz, accordion, ukulele, glockenspiel, sweet and charming, 3/4, 96 bpm |
| fotos-castillo | orchestral fairy tale theatre, celesta, harp, warm strings, french horn, magical and nostalgic, gentle waltz, 90 bpm |
| fotos-bingo | lively bingo-hall party swing, handclaps, upbeat horns, retro game show energy, 124 bpm |

Consejo: no pidas melodías ni artistas concretos (bandas sonoras, himnos) para que salgan piezas originales.

## Sonidos propios del efecto
Archivo: `assets/sfx/efectos/<efecto>/<sonido>.mp3` con los mismos 18 nombres de `assets/sfx/PROMPTS.md`
(`lanzar estallar tick tope premio obturador impresora ding click pop chime fanfarria whoosh destello broma bola linea bingo`).
Prioridad de sonido: **archivo del efecto > archivo del estilo (assets/sfx/<tema>/) > sonido original generado**.
Cada sonido que falte sigue sonando como ahora. Qué sonidos usa cada efecto: castillo → destello, chime, whoosh, fanfarria, lanzar, estallar;
fuegos → lanzar, estallar; bingo → click, bola, linea, bingo, broma, pop; tragaperras → tick, tope, premio.
Prompt: `<qué es>, <sabor del efecto>, clean, dry, no background music, short`
