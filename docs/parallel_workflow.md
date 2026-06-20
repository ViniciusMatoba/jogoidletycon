# Trabalho paralelo

Este projeto pode ter frentes paralelas de asset:

- Codex: cidade, equipamentos, efeitos, UI e integracao visual LPC.
- Claude Code: monstros, sprites de inimigos, drops e comportamento relacionado.

Para evitar conflito:

1. Nao misturar arquivos de monstros com commits de equipamentos.
2. Antes de push/deploy, rodar `git status --short` e revisar se ha arquivos de outra frente.
3. Assets de monstros devem ficar em commits separados dos assets de armas/armaduras.
4. Quando uma frente terminar, integrar via pull/merge antes de continuar editando os mesmos arquivos de dados.

Arquivos que exigem cuidado por serem compartilhados:

- `src/data/constants.js`
- `src/ui/renderer.js`
- `src/core/monster.js`
- `assets/sprites/monster_*`
