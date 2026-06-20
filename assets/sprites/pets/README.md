# Pet Sprites

Todos os pets desta pasta usam o mesmo formato para facilitar a implementacao no jogo.

- Tamanho da spritesheet: `256x256`
- Grade: `4 colunas x 4 linhas`
- Frame: `64x64`
- Fundo: transparente `RGBA`
- Linhas:
  - `0`: sul/frente
  - `1`: oeste/esquerda
  - `2`: leste/direita
  - `3`: norte/costas
- Colunas:
  - `0`: passo/idle base
  - `1`: passo alternado
  - `2`: passo oposto
  - `3`: passo alternado

O arquivo `pets_manifest.json` lista todos os pets disponiveis para preview e futura implementacao.

Pets atuais:

- Raposa: `fox_pet_walk_v2.png`
- Hiena: `pet_hyena_walk_v2.png`
- Capivara: `pet_capybara_walk_v2.png`
- Gamba: `pet_skunk_walk_v2.png`
- Lemure: `pet_lemur_walk_v2.png`
- Lhama: `pet_llama_walk_v2.png`
- Suricato: `pet_meerkat_walk_v2.png`
- Orix: `pet_oryx_walk_v2.png`
- Morcego de Lava: `pet_lava_bat_walk_v2.png`
- Morcego Rosa: `pet_pink_bat_walk_v2.png`

Cada pet tambem possui:

- `*_icon_v2.png` ou equivalente: icone frontal para UI.
- `*_preview_v2.gif` ou equivalente: preview rapido da animacao.
