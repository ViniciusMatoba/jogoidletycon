# Pipeline de Criação e Integração de Monstros (Guia Definitivo)

Este documento serve como o guia técnico, artístico e operacional definitivo para a criação, animação e integração de novos monstros no jogo.

A principal diferença arquitetural entre pets e monstros é que os monstros exigem **comportamento de combate ativo (caminhada, ataque com movimento de arma/mão, dano sofrido e morte)** mapeados no formato **Universal LPC (832x1344)**.

---

## 🎨 1. Diretrizes Artísticas e de Design

### Expressão e Visual (Inimigos)
* **Expressões Ferozes:** Os monstros são adversários dos heróis. Eles devem ter expressões de bravos, zangados ou ferozes (olhos brilhantes, dentes à mostra, sobrancelhas franzidas) e posturas agressivas.
* **Estilo Visual:** Pixel art 16-bit com contornos nítidos e paleta de cores vibrantes e harmoniosas. Evitar gradientes excessivamente suaves de IA nas bordas (remova halos).

### Escala e Tamanhos de Célula (Visual Base)
* **Monstros Comuns:** Tamanho base do sprite de `40px` a `48px` (ex: Ratos, Slimes, Goblins Comuns).
* **Variantes Raras:** Tamanho de `52px` a `54px` (ex: Goblin Raro).
* **Variantes Elites / Mini-Bosses:** Tamanho de `58px` a `70px` (ex: Goblin Elite, ET Verde, Capitão Orc).
* **Chefes (Bosses):** Tamanho de `96px` a `112px` (ex: Homem do Saco, Saci, Curupira).

---

## 📐 2. Estrutura Técnica do Spritesheet Universal LPC

Para compatibilidade com o renderizador isométrico (`src/ui/renderer.js`), todo monstro deve ter seu spritesheet final no formato Universal LPC:
* **Tamanho total:** `832x1344` pixels.
* **Células:** `64x64` pixels por frame (Grade: `13` colunas x `21` linhas).
* **Fundo:** Transparente `RGBA`.
* **Mapeamento de Linhas e Colunas Usadas:**
  * **Linhas 8-11 (Caminhada):** Direções Norte (`8`), Oeste (`9`), Sul (`10`) e Leste (`11`). (Animação de 9 frames, colunas 0 a 8).
  * **Linhas 12-15 (Ataque Melee):** Direções Norte (`12`), Oeste (`13`), Sul (`14`) e Leste (`15`). (Animação de 6 frames, colunas 0 a 5).
  * **Linha 20 (Reação a Dano e Morte):**
    * **Frames 0-2 (Hurt):** Animação de dano sofrido.
    * **Frames 3-5 (Death):** Queda física e fade-out.

---

## 🧼 3. Regras de Pós-Processamento e Remoção de Fundo

1. **Alinhamento Centralizador Fixo (Evitar Tremor):**
   * O centro de gravidade visual de cada frame deve estar **rigorosamente centralizado na horizontal** (coordenada X = 32 na célula de 64px) e **ancorado na base vertical** (geralmente com 4px de folga na borda inferior da célula).
   * **Problema:** Qualquer deslocamento de 1 pixel entre frames vizinhos fará com que o monstro trema na tela durante o walk-cycle.
2. **Remoção de Halo (Antialiasing Sujo):**
   * Sempre passe a imagem gerada por IA pelo script `make_transparent.py`:
     ```bash
     python C:\Users\Usuario\.gemini\antigravity\scratch\make_transparent.py <caminho_imagem_com_fundo> <caminho_saida>
     ```
   * O script remove o fundo branco e aplica algoritmos de limpeza de bordas para eliminar pixels semitransparentes cinza/esbranquiçados nas bordas do sprite pixel art.

---

## 🛠️ 4. Fluxos de Compilação de Sprites (Os Dois Pipelines)

Como desenhar 21 linhas de animação LPC frame a frame é complexo, geramos imagens base em formato simplificado **4x4 (256x256 ou 1024x1024)** contendo 4 colunas (frames de animação) e 4 linhas (direções: Sul/0, Oeste/1, Leste/2, Norte/3). 

Dependendo da anatomia do monstro, usamos um dos dois fluxos de compilação abaixo:

### 🟢 Fluxo A: Deformação Matemática Procedural (Slimes e Quadrupedes)
Usado para monstros sem braços/armas (ex: Slimes) ou quadrúpedes simples (ex: Ratazana).
* **Entrada:** Um único arquivo 4x4 contendo o ciclo de caminhada (`monster_slime_green.png` ou `monster_ratazana.png`).
* **Processo:** O script `generate_quad_monster_lpc.mjs` gera as animações de combate programaticamente via Sharp:
  * **Caminhada:** Aplica efeitos de bounce (squash/stretch vertical) para slimes, ou percorre a sequência de patas para quadrúpedes.
  * **Ataque:** Aplica um deslocamento de avanço (lunge) e uma rotação controlada de canvas no corpo inteiro para simular a cabeçada/investida.
  * **Dano/Morte:** Deforma o frame na horizontal (achatando) com tint vermelho para o dano, e rotaciona o corpo 90 graus no chão para a morte.

### 🔴 Fluxo B: Multi-Spritesheet Composto (Bípedes / Goblins)
Usado para monstros bípedes que empunham armas (clavas, espadas, adagas) e precisam de movimentos detalhados de braço e mão para golpear, **sem deformar ou rotacionar o corpo inteiro programaticamente**.
* **Entradas:** 
  1. `monster_goblin.png` (4x4 de caminhada base).
  2. `monster_goblin_attack.png` (4x4 de ataque físico gerado por IA, onde o braço e a arma se movem de verdade em 4 direções).
* **Processo:** O script `compile_goblin_lpc.mjs` monta o layout LPC combinando ambas as fontes:
  * **Caminhada (linhas 8-11):** Mapeia os quadros da folha de caminhada com balanço de waddle/bobbing leve.
  * **Ataque (linhas 12-15):** Mapeia os quadros da folha de ataque frame a frame. O ciclo de 6 quadros do LPC é montado usando o mapeamento:
    * LPC Frame 0 $\rightarrow$ Attack Frame 0 (Prep)
    * LPC Frame 1 $\rightarrow$ Attack Frame 1 (Windup)
    * LPC Frame 2 $\rightarrow$ Attack Frame 2 (Strike down / Flash de impacto)
    * LPC Frame 3 $\rightarrow$ Attack Frame 3 (Impact / Follow-through)
    * LPC Frame 4 $\rightarrow$ Attack Frame 3 (Hold)
    * LPC Frame 5 $\rightarrow$ Walk Frame 0 (Recovery / Retorno para idle)
  * **Dano/Morte (linha 20):** Mapeia o frame 0 de caminhada aplicando tint vermelho/achatamento (dano) e rotação de queda com redução de opacidade (morte).

---

## ⚡ 5. Gestão de Rariedades (Normal, Raro, Elite)

Para evitar ter que gerar 3 imagens diferentes por monstro, o pipeline de compilação aplica modificações dinâmicas sobre os assets bases:
1. **Escalonamento de Tamanho:** Aumentar o `baseImgSize` nas variantes raras e elites para dar imponência ao inimigo (ex: Comum 48px $\rightarrow$ Raro 53px $\rightarrow$ Elite 58px).
2. **Modificação de Hue (Modulate):** Aplicar deslocamento de matriz de cor (hue shift) no Sharp para mudar a cor da pele e equipamentos:
   * **Normal:** Sem alteração de matiz.
   * **Raro:** Deslocamento leve para uma cor complementar (ex: hue shift de `+20` para tom verde-limão/amarelado).
   * **Elite:** Deslocamento forte para tons ameaçadores (ex: hue shift de `+315` para tom verde-azulado/ciano escuro).

---

## 🔄 6. Integração no Jogo e Cache-Busting

Depois de gerar as planilhas `monster_*_universal.png` e salvá-las em `assets/sprites/`, siga os seguintes passos para integrá-las:
1. **Registro no Renderer:** Declare o mapeamento da imagem em `src/ui/renderer.js` no dicionário `this.images` do construtor:
   ```javascript
   'monster_goblin': 'assets/sprites/monster_goblin_universal.png?v=custom-goblin-4',
   'monster_goblin_raro': 'assets/sprites/monster_goblin_raro_universal.png?v=custom-goblin-4',
   'monster_goblin_elite': 'assets/sprites/monster_goblin_elite_universal.png?v=custom-goblin-4',
   ```
   * **Importante:** Sempre incremente o sufixo `?v=X` (cache-busting) quando recompilar ou atualizar um spritesheet, forçando o navegador a descartar caches locais antigos.
2. **Registro no Renderer Draw Cycle:** O renderer detecta se a imagem carregada tem 832px de largura (`isSpritesheetLPC`) ou 256px (`isSpritesheet4x4`) e aplica o recorte correto. O Goblin e a Ratazana compilados rodam no fluxo LPC.
