# Workflow de sprites para pets

Este documento registra o processo usado para criar, limpar, organizar e testar sprites de pets em pixel art para o jogo.

O objetivo e manter um padrao repetivel para criar novos pets no futuro sem perder qualidade visual, direcao de movimento ou transparencia.

## Padrao atual

Cada pet aprovado deve ter:

- `idle`: 6 frames parado
- `walk`: 8 frames laterais
- `back_walk`: 8 frames de costas
- `front_walk`: 8 frames frontais
- tamanho de frame: `65x65`
- fundo transparente final
- imagem fonte com chroma key salva em `ai_refs`
- contact sheet para avaliacao visual
- preview individual em `game-sim.html`
- entrada no preview geral `all-pets-walk-sim.html`

O `walk` deve preferencialmente olhar para a direita, mas isso precisa ser validado. Alguns sprites podem vir olhando para a esquerda e exigem metadado `baseFacing`.

## Estrutura de pastas

Cada pet fica em:

```text
assets/sprites/pets/<slug>_engine_prototype/
```

Exemplo:

```text
assets/sprites/pets/fox_engine_prototype/
```

Arquivos esperados:

```text
<slug>_engine_idle_strip.png
<slug>_engine_walk_strip.png
<slug>_engine_back_walk_strip.png
<slug>_engine_front_walk_strip.png
<slug>_engine_idle.gif
<slug>_engine_walk.gif
<slug>_engine_back_walk.gif
<slug>_engine_front_walk.gif
<slug>_engine_icon.png
<slug>_engine_contact_sheet.png
<slug>_engine_manifest.json
game-sim.html
```

Imagens brutas geradas por IA devem ser preservadas em:

```text
assets/sprites/pets/ai_refs/
```

Exemplos:

```text
assets/sprites/pets/ai_refs/fox_engine_ai_full_01.png
assets/sprites/pets/ai_refs/fox_engine_ai_front_walk_01.png
```

Arquivos auxiliares:

```text
assets/sprites/pets/build_pet_engine_assets.py
assets/sprites/pets/engine-gallery.html
assets/sprites/pets/all-pets-walk-sim.html
assets/sprites/pets/PET_SPRITE_WORKFLOW.md
```

## Padrao visual

Os pets devem seguir o estilo aprovado nos prototipos:

- pixel art 2D
- formato fofo e legivel em tamanho pequeno
- silhueta clara
- contorno escuro
- poucas cores bem separadas
- sem efeitos grandes no sprite base
- sem sombra desenhada na imagem fonte
- sem grid desenhada na imagem fonte
- sem texto, label ou marca d'agua

A prioridade e a leitura em jogo. Se o pet fica bonito ampliado, mas confuso no mapa, ele precisa ser simplificado.

## Prompt para sprite completo

Use quando quiser criar `idle`, `walk` lateral e `back_walk` em uma unica imagem.

```text
Use case: stylized-concept
Asset type: pixel art game pet sprite sheet
Primary request: Create a complete pixel art sprite sheet for a cute <PET> pet, game-ready, matching the same quality and scale as the approved pet sprites. The animal must be clearly recognizable: <MAIN ANIMAL FEATURES>.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background, no shadows, no ground, no texture.
Style/medium: high quality 2D pixel art, cute RPG pet sprite, crisp chunky pixels, dark outline, polished game-ready sprite.
Composition/framing: exactly 3 horizontal rows. Row 1: exactly 6 idle frames in side 3/4 view. Row 2: exactly 8 side-walk frames, animal walking to the right. Row 3: exactly 8 back-walk frames, animal walking away from camera/upward, showing back, ears, tail and rear legs, not walking backward. Each frame is intended for a 65x65 cell with generous padding, consistent scale, no grid lines.
Color palette: <PALETTE>. Do not use #ff00ff anywhere in the animal.
Constraints: no text, no labels, no watermark; no extra animals; no duplicated partial bodies between frames; one animal per frame; background must be uniform #ff00ff only.
```

## Prompt para direcao frontal

Use quando faltar `front_walk`.

```text
Use case: stylized-concept
Asset type: pixel art game pet sprite sheet direction variant
Primary request: Create a pixel art sprite sheet of the same cute <PET> pet style as the existing approved sheet: <MAIN ANIMAL FEATURES>. This sheet must show the animal walking TOWARD the camera / front view / downward direction, not side view and not backward. The face, chest, front paws, ears and tail behind the body should be visible; it must clearly read as a <PET> from the front.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background, no shadows, no ground, no texture.
Style/medium: high quality 2D pixel art, cute RPG pet sprite, crisp chunky pixels, dark outline, polished game-ready sprite matching the existing pet style.
Composition/framing: one horizontal row of exactly 8 separate animation frames, each frame intended for a 65x65 cell, generous padding around each frame, consistent scale across frames. The animal should face downward/front toward viewer in all frames, with alternating front/rear leg motion to imply walking forward toward the camera.
Color palette: <PALETTE>. Do not use #ff00ff anywhere in the animal.
Constraints: exactly 8 frames in one row; same animal and same size across frames; no text, no labels, no watermark; no extra animals; no duplicated partial bodies between frames; no frame grid lines; background must be one uniform #ff00ff color only.
```

## Chroma key

Padrao principal:

```text
#ff00ff
```

Use magenta quando o pet nao tiver rosa, roxo ou vermelho dominante.

Para pets rosa, roxos ou vermelhos, use verde:

```text
#00ff00
```

Exemplo: o Morcego Rosa usa verde para evitar que partes do corpo sejam apagadas junto com o fundo.

## Conversao

Script principal:

```text
assets/sprites/pets/build_pet_engine_assets.py
```

Exemplo com magenta:

```bash
python assets/sprites/pets/build_pet_engine_assets.py --source C:\caminho\imagem_gerada.png --slug fox --display-name Raposa
```

Exemplo com verde:

```bash
python assets/sprites/pets/build_pet_engine_assets.py --source C:\caminho\imagem_gerada.png --slug pink_bat --display-name "Morcego Rosa" --key green
```

O script:

- copia a imagem fonte para `ai_refs`
- remove o chroma key
- detecta componentes conectados
- separa os frames por linhas
- redimensiona cada frame para `65x65`
- remove componentes soltos
- gera strips PNG
- gera GIFs
- gera icone
- gera contact sheet
- gera manifest
- gera `game-sim.html`

## Limpeza de artefatos

Problema comum: a IA deixa pedacos de frames vizinhos perto do animal. Isso aparece como riscos, linhas pretas ou pequenos fragmentos no jogo.

Correcao usada:

- analisar cada frame individualmente
- detectar todos os componentes com alpha
- manter somente o maior componente
- apagar todo o resto

Isso remove:

- riscos pretos laterais
- pedacos de patas de outro frame
- residuos de cauda de outro frame
- pixels soltos de chroma key

Atencao: isso funciona melhor quando o pet e um unico corpo conectado. Para asas, caudas destacadas, magia ou efeitos soltos, revisar visualmente antes de apagar tudo.

## Direcoes de movimento

O pet deve apontar para a direcao em que esta andando.

Padrao ideal:

```text
direita => walk
esquerda => walk espelhado
cima => back_walk, se o design aceitar mostrar costas
baixo => front_walk
parado => idle
```

Sem `front_walk`, o pet pode parecer que anda de costas ao descer. Pets definitivos devem ter as quatro direcoes.

## Orientacao base do walk

Nao assumir que todo `walk_strip` olha para a direita.

O recomendado e gerar `walk` olhando para a direita, mas alguns sprites aprovados vieram olhando para a esquerda. Isso aconteceu com:

- Capivara
- Gamba

Quando isso acontecer, registrar no renderizador:

```text
baseFacing: "right" ou "left"
```

Regra:

```text
se baseFacing = right:
  dx > 0 => walk normal
  dx < 0 => walk espelhado

se baseFacing = left:
  dx < 0 => walk normal
  dx > 0 => walk espelhado
```

Sem isso, o pet pode parecer que anda de re ao ir para esquerda ou direita.

## Uso correto do back_walk

`back_walk` existe para mostrar o animal de costas, andando para cima no mapa.

Nao use `back_walk` como movimento de retorno generico em testes visuais. Se o objetivo da avaliacao for garantir que o animal nunca pareca andar de costas, o preview deve usar:

```text
direita => walk
esquerda => walk espelhado
baixo/frente => front_walk
retorno/recuo => walk lateral, nao back_walk
```

Isso foi importante para Capivara e Gamba: os sprites estavam corretos, mas o preview geral forcava `back_walk` e dava a impressao de movimento errado.

## Gravidade e sombra

Pets terrestres devem ficar ancorados no chao:

- patas encostadas ou quase encostadas na sombra
- sombra diretamente abaixo do corpo
- sem flutuacao vertical perceptivel
- no maximo 1 a 3 px de variacao se houver salto leve

Pets voadores podem ficar acima da sombra:

- Coruja
- Morcego de Lava
- Morcego Rosa

Para voadores, usar altura e leve oscilacao vertical.

No preview/renderizador, registrar:

```text
locomotion: "ground" ou "flying"
```

`ground` ancora o sprite na sombra. `flying` separa o sprite da sombra.

## Escala em relacao aos herois

O frame tecnico dos pets deve continuar em `65x65`, mas isso nao significa que o pet deve ser renderizado com 65 px no mapa.

No render atual, o heroi ocupa aproximadamente um quadro visual de 70 px. Portanto, pets comuns devem ser exibidos entre 32 e 40 px, ficando perto de metade do porte do heroi:

```text
pet pequeno: 32-34 px
pet medio:   36-38 px
pet grande:  40 px
voadores:    34-36 px, com separacao da sombra
```

Regra recomendada:

```text
altura visual do pet = 0.50x a 0.60x da altura visual do heroi
pet grande excepcional = ate 0.65x
```

Nao redimensionar o PNG fonte para isso. Reduzir apenas no renderizador/preview usando `renderSize` ou `scale`, mantendo o sprite original com boa margem e qualidade.

## Previews

Preview individual:

```text
http://localhost:8091/assets/sprites/pets/<slug>_engine_prototype/game-sim.html
```

Galeria de contact sheets:

```text
http://localhost:8091/assets/sprites/pets/engine-gallery.html
```

Preview geral com todos andando:

```text
http://localhost:8091/assets/sprites/pets/all-pets-walk-sim.html
```

O preview serve para avaliar:

- tamanho no mapa
- leitura da silhueta
- transparencia
- artefatos nos frames
- direcao da cabeca
- orientacao lateral correta
- se o pet parece andar de re
- se terrestre esta colado na sombra
- se voador esta separado da sombra
- fluidez da caminhada

## Checklist de qualidade

Antes de aprovar um pet:

- O animal e reconhecivel em tamanho pequeno?
- Nao parece cachorro quando deveria ser outro animal?
- A silhueta e diferente dos outros pets?
- Nao existem linhas pretas ou restos de outros frames?
- O fundo esta transparente?
- Nao sobrou magenta ou verde nas bordas?
- A escala esta proxima dos pets aprovados?
- A caminhada lateral esta suave?
- O `baseFacing` do `walk_strip` foi identificado corretamente?
- Ao andar para esquerda, o pet olha para a esquerda?
- Ao andar para direita, o pet olha para a direita?
- A caminhada frontal mostra o animal vindo para frente?
- A caminhada de costas mostra o animal de costas somente quando isso e desejado?
- Terrestres estao colados na sombra?
- Somente voadores estao flutuando?
- O preview geral nao esta forcando `back_walk` como retorno generico?
- O contact sheet esta limpo?
- O preview no navegador esta correto?

## Status dos pets

Criados no novo padrao:

- Raposa
- Cervo
- Lobo
- Coelho
- Javali
- Gato Mistico
- Hiena
- Lemure
- Lhama
- Suricato
- Orix
- Coruja
- Morcego de Lava
- Morcego Rosa
- Capivara
- Gamba

Com `front_walk` completo:

- Raposa
- Hiena
- Capivara
- Gamba

Ainda precisam receber `front_walk` para ficarem perfeitos em quatro direcoes:

- Cervo
- Lobo
- Coelho
- Javali
- Gato Mistico
- Lemure
- Lhama
- Suricato
- Orix
- Coruja
- Morcego de Lava
- Morcego Rosa

Com `walk_strip` base olhando para a esquerda:

- Capivara
- Gamba

## Manifest recomendado

Quando integrar no jogo real, o manifest deve informar animacoes, orientacao base e tipo de locomocao.

```json
{
  "slug": "fox",
  "displayName": "Raposa",
  "frameSize": 65,
  "baseFacing": "right",
  "locomotion": "ground",
  "animations": {
    "idle": { "file": "fox_engine_idle_strip.png", "frames": 6 },
    "walk": { "file": "fox_engine_walk_strip.png", "frames": 8 },
    "backWalk": { "file": "fox_engine_back_walk_strip.png", "frames": 8 },
    "frontWalk": { "file": "fox_engine_front_walk_strip.png", "frames": 8 }
  }
}
```

## Regra recomendada de render

Render normal com quatro direcoes:

```text
sem movimento => idle
movimento horizontal dominante => walk, respeitando baseFacing
movimento vertical dominante e dy > 0 => frontWalk
movimento vertical dominante e dy < 0 => backWalk, se o design aceitar mostrar costas
```

Render de teste quando nao queremos ver o animal andando de costas:

```text
sem movimento => idle
dy > 0 => frontWalk
dy < 0 => walk lateral, nao backWalk
dx != 0 => walk lateral, respeitando baseFacing
```

## Limitacoes

Este metodo gera prototipos muito bons, mas ainda exige revisao humana.

Pontos de atencao:

- IA pode gerar 5 frames de idle em vez de 6
- IA pode colocar pedacos de outro frame perto do animal
- IA pode alterar tamanho/proporcao entre frames
- IA pode criar uma direcao quase lateral quando pedimos frente ou costas
- IA pode gerar `walk` olhando para a esquerda mesmo quando pedimos direita
- branco, rosa ou verde podem ser removidos errado se conflitarem com o chroma key
- sprites com efeitos soltos podem ser apagados pela limpeza de maior componente
- previews podem enganar se a sombra estiver longe das patas
- previews podem enganar se usarem `back_walk` como retorno generico

Por isso, sempre validar em:

```text
contact sheet
game-sim.html
all-pets-walk-sim.html
```
