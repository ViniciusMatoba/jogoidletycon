# Pipeline de assets LPC

Referencia principal: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator

O jogo usa sprites no formato Universal LPC como camadas sobre o corpo do heroi. Cada camada universal tem:

- Tamanho total: `832x1344`.
- Celula: `64x64`.
- Grade: `13` colunas por `21` linhas.
- Fundo transparente.

Linhas usadas atualmente pelo renderer:

- `0-3`: magia/cast, direcoes norte, oeste, sul e leste.
- `8-11`: caminhada/idle, direcoes norte, oeste, sul e leste.
- `12-15`: ataque slash, direcoes norte, oeste, sul e leste.
- `16-19`: ataque shoot, direcoes norte, oeste, sul e leste.

## Regra para novas armas

Cada arma final precisa ser uma camada LPC completa, nao apenas uma imagem frontal. O processo recomendado e:

1. Criar o conceito isolado da arma.
2. Definir as vistas de direcao: frente, costas, esquerda e direita.
3. Adaptar as vistas para as animacoes usadas pela classe.
4. Montar a folha `832x1344` alinhada ao corpo LPC.
5. Testar no jogo em movimento e combate.

## Armas iniciais por classe

Os assets iniciais T0 sao separados por classe para permitir identidade visual desde o nascimento do heroi:

- Guerreiro: espada simples + escudo simples.
- Mercenario: adagas curtas.
- Arqueiro: arco curto.
- Mago: cajado de aprendiz.
- Sacerdote: cetro/cajado de peregrino.

Esses arquivos podem comecar como derivacoes LPC compativeis e depois ser substituidos por arte refinada, mantendo os mesmos nomes de arquivo e chaves no renderer.
