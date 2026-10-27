# Sonidos de efectos por estilo

Carpeta por estilo: `assets/sfx/<tema>/<sonido>.mp3` con tema = `dark cloud green betis sevilla cookie kids magic`
(`luxury` conserva siempre los sonidos originales). Solo hace falta crear los que quieras: **cada sonido que falte
sigue sonando como ahora** (el original generado por código). Cortos, mp3, sin música de fondo, volumen normalizado.

## Los 18 sonidos (nombre de archivo = nombre del sonido)
| Archivo | Qué es | Duración |
|---|---|---|
| lanzar | silbido del cohete al subir | 1 s |
| estallar | explosión de fuegos artificiales con chisporroteo | 1,5 s |
| tick | tic seco y pequeño | 0,05 s |
| tope | golpe sordo suave (rebote) | 0,2 s |
| premio | arpegio ascendente de 5 notas con destellos | 1 s |
| obturador | clic de cámara de fotos | 0,2 s |
| impresora | foto instantánea saliendo de la impresora | 1 s |
| ding | campanita brillante única | 1 s |
| click | clic de interfaz | 0,1 s |
| pop | burbuja que explota | 0,1 s |
| chime | carillón de 4 notas | 1,5 s |
| fanfarria | fanfarria corta de triunfo | 2 s |
| whoosh | barrido de aire | 0,6 s |
| destello | brillo / centelleo | 0,5 s |
| broma | «boing» cómico + trombón triste | 1,5 s |
| bola | barrido y campanita (sale una bola del bingo) | 0,8 s |
| linea | jingle de «línea» en el bingo | 2 s |
| bingo | gran celebración de «¡Bingo!» | 3-4 s |

## Prompt (ElevenLabs Sound Effects, Stable Audio, etc.)
`<qué es> , <sabor del estilo> , clean, dry, no background music, short`

Ejemplo: `firework explosion with crackle, stadium celebration with brass blasts and crowd cheer, clean, dry, no background music, short`

## Sabor por estilo (pégalo en <sabor del estilo>)
- **dark:** deep cinematic synthetic sounds, subtle low-end, sleek
- **cloud:** soft airy glassy chimes, gentle and dreamy
- **green:** organic natural sounds, bamboo, wood blocks, soft marimba, leaves
- **betis:** stadium celebration, brass band blasts, handclaps, flamenco guitar stabs, cheering crowd
- **sevilla:** fierce stadium energy, epic trumpets, drum hits, roaring crowd
- **cookie:** bakery kitchen sounds, bells, whisk, oven ding, sugar sparkles, cute pops
- **kids:** cartoon sounds, boing, squeaky toys, kazoo, silly and playful
- **magic:** fairy tale sparkle, harp glissando, celesta, magic wand twinkle

## Nota
La música sincronizada que llevan los propios efectos (generada por código, a compás en todos los móviles) no cambia:
sigue siendo la original. Los archivos de `assets/musica/` son la música ambiente del resto de la página.
