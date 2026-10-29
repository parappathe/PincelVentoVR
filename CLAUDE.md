# Pincel do Vento

Jogo de ritmo em VR para o Meta Quest 3 (roda no navegador do óculos, WebXR), também joga no PC
com o mouse. Estética de pintura sumi-ê: um pátio de madeira de templo no alto da montanha, sobre
um mar de nuvens, céu de papel de arroz, montanhas em aguada de tinta, sol carmim e pétalas de
cerejeira. Um **pincel de caligrafia** em cada mão (tinta preta na esquerda, carmim na direita).
Dois tipos de nota vêm flutuando da frente: **gotas de tinta**, para pincelar através no sentido
do traço, e **faixas de vento** (notas longas), em que a ponta do pincel tem que acompanhar um anel
pelo caminho. 3 músicas compostas pelo próprio jogo (pentatônica japonesa), cada uma em
Fácil / Normal / Difícil.

Faz parte dos 5 jogos de ritmo com lâminas (ForroFrutasVR, FogoGeloVR, PincelVentoVR, CinturaoVR,
RedemoinhoVR). Começou como cópia do núcleo do RedemoinhoVR; não há dependência entre as pastas.

## Como rodar / jogar

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8796`. O mouse move o pincel
vermelho, que no PC vale pelas duas cores. Esc pausa, F mostra FPS.

**No Quest:** abrir **https://parappathe.github.io/PincelVentoVR/** no navegador do óculos e
apertar "Entrar em VR". Gatilho aponta nos menus, B ou Y pausa. Para atualizar o site: commitar e
rodar `python publicar.py PincelVentoVR` em `C:\claude code`.
Alternativa sem publicar: `jogar-no-quest.bat` (HTTPS na rede de casa; ver o PingPongVR).

### Regras

- **Gota:** vale se o pincel da cor dela passa através dela rápido o bastante (1 m/s), no sentido
  do traço desenhado na gota (tolerância de ~65°). Gota com círculo (ensō): qualquer sentido.
  Até 100 pontos (velocidade, sentido e o quanto o traço passou no meio).
- **Faixa de vento:** um caminho de tinta clara vem chegando (arco, onda, S, espiral pequena,
  subida/descida ou reta). Quando o início chega, um anel (raio 12 cm) corre pelo caminho no ritmo
  da música. A ponta do pincel da cor certa tem que ficar dentro do anel até o fim: ganha pontos a
  cada meia batida dentro. Fora por mais de 0,25 s seguidos quebra a sequência (conta um erro, uma
  vez só). Completa sem quebrar = acerto (60 a 100 pontos, pelo tempo dentro). O traço feito fica
  pintado no ar e se desfaz em 3 s.
- Durante a faixa o pincel daquela mão não corta gotas, e o mapa nunca põe gota nessa mão.
  No Normal/Difícil a outra mão pode ter gotas; no Fácil não há gotas durante faixas.
- Multiplicador x2/x3/x4 com 8/16/32 em sequência; errar zera. Barra de tinta (vida): erro gasta,
  acerto recupera. Zerou, perdeu (opção "Sem derrota").
- Recordes e opções ficam no navegador (localStorage `pincelventovr.v1`).

## Como testar

- `node tests/run.js` (ou `npm test`): composição (sempre igual, duração, flauta com notas
  longas), mapas de todas as músicas e dificuldades (ordem, intervalo por mão, posições, faixas de
  1 a 4 batidas, formas permitidas, caminho entre 0,7 e 1,6 m de altura e |x| ≤ 0,6 m, do lado da
  mão, anel não rápido demais, mão livre durante a faixa, duplas só no Difícil e espelhadas), o
  **robô joga cada música inteira com a mesma lógica do navegador e tem que acertar 100%** (todas
  as gotas e faixas), traço no sentido oposto / cor errada / devagar / atrasado não valem, sair do
  anel 0,4 s quebra (uma vez), escapada de 0,15 s não quebra, pincel da cor errada não conta na
  faixa (no PC conta), mapa do PC sem sobreposição; placar. Tem que terminar com "Tudo certo".
  Sem som.
- No navegador (console): `jogo.dev.autoplay = true; jogo.startSong(0, 2); jogo.dev.advance(120)`
  joga a música inteira na hora com o robô e devolve acertos e faixas completas.
  `jogo.dev.freeze = true` congela a cena para tirar foto. Nenhum desses destrava o som.
- **Só dá para testar no óculos:** ângulo do pincel na mão (opção de -30° a +30°), se o plano a
  0,7 m fica confortável para o braço, sensação de seguir o anel, dificuldade real, FPS (meta 72).

## Estrutura

| Arquivo | O que tem |
|---|---|
| `js/music.js` | Compositor: partitura → eventos em batidas (percussão por padrões, baixo, acordes, arpejo, melodia e a frase longa da flauta). Sem navegador |
| `js/songs.js` | As 3 músicas: andamento, tom, escala, acordes, seções (energia, partes), timbres e tambores |
| `js/chart.js` | Gerador do mapa: faixas nas notas longas da flauta, gotas na percussão e no koto (dificuldades em `DIFFS`); `soloChart` faz o mapa do PC. Sem navegador |
| `js/mode.js` | Regra própria: notas vêm da frente até o plano a 0,7 m (`HIT_DIST`), formas e caminhos das faixas, posição do anel. Sem navegador |
| `js/judge.js` | Colisão pincel × gota (área varrida entre quadros), sentido/força, anel da faixa (`HoldTracker`), placar e vida, poses do robô. Sem navegador |
| `js/play.js` | Uma partida sem navegador (`Round`): decide a cada quadro o que os pincéis acertaram. Usado pelo jogo e pelos testes; `robotPose` é o robô dos dois |
| `js/synth.js` | Sintetizador Web Audio: taiko, shime, kane, hyoshi, gongo, koto, shakuhachi (com sopro e vibrato atrasado), efeitos sonoros |
| `js/scene.js` | Cenário sumi-ê, gotas, pincéis, rastro, faixa de vento, anel, traço pintado no ar, respingos |
| `js/ui.js` | Painel de menu 3D em pergaminho e cores do tema (`C`) |
| `js/main.js` | Liga tudo: VR, controles, mouse, menus, laço do jogo, placar (pergaminho pendurado à direita), robô do PC, `window.jogo` |
| `js/save.js` | Recordes e opções |
| `tests/run.js` | Testes automáticos |
| `serve.py`, `jogar-no-quest.bat` | Servidor local sem cache (porta 8796; `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas: metros, jogador no centro (0, 0, 0) virado para -Z; as notas chegam no plano a
0,7 m à frente, gotas entre 0,9 e 1,46 m de altura, faixas entre 0,72 e 1,58 m (+ ajuste de
altura). O pincel pinta do cabo (5 cm à frente da mão) até a ponta (45 cm). No VR o `rig` é
recentralizado ao entrar e pelo menu de pausa.

## Regras e convenções do projeto

- `music.js`, `chart.js`, `judge.js`, `mode.js`, `play.js` e `songs.js` não usam navegador nem
  Three.js (rodam nos testes do Node).
- Regra de acerto nova: mexer no `play.js`/`judge.js`, nunca só no `main.js`, para o teste e o
  jogo continuarem iguais.
- Música nova: só dados em `songs.js` (a parte `flute` é que gera as faixas). Rodar os testes.
- Ajuste de dificuldade: `DIFFS` em `chart.js` (`keep` = densidade de gotas, `speed` = velocidade
  das notas, `hold` = quantas notas longas viram faixa, `holdMax` = batidas no máximo,
  `ringSpeed` = velocidade do anel, que define o tamanho do desenho, `shapes` = formas permitidas).
- Testes nunca tocam som (o áudio só é liberado por clique de verdade).

## Decisões

- Música composta pelo jogo (sintetizador) em vez de arquivos: sem direito autoral (site
  público), sincronia exata (o mapa sai da mesma partitura), nada para baixar.
- Visual e regras próprios: gotas de tinta com traço de pincel, faixas com anel; sem copiar
  Beat Saber nem o Redemoinho.
- Faixas saem só das notas longas da flauta (shakuhachi); gotas, da percussão e do koto.
- Fácil: faixas curtas (até 2 batidas), só reta e arco, sem gotas durante faixas. Difícil: às
  vezes faixas nas duas mãos ao mesmo tempo, espelhadas.
- O ponto "no meio" da gota é medido pela linha do traço (não pelo primeiro contato), para quem
  passa bem no centro tirar 100.
- No PC um pincel só, que vale pelas duas cores, com um mapa sem faixas sobrepostas e sem gotas
  durante faixas (o mouse não daria conta). O recorde é o mesmo do VR.

## Pendências / problemas conhecidos

- Nada testado no Quest ainda: ângulo do pincel na mão (espaço "grip" do WebXR, pincel para -Z),
  conforto do plano a 0,7 m, sincronia do som no óculos (usa `outputLatency`), FPS.
  (use `python serve.py --port <outra>`).
