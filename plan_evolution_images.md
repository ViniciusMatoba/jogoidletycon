# Plano de Evolução Visual das Construções (Status das Imagens)

Este documento registra e acompanha o status de criação das **35 imagens de evolução** (5 estágios para cada um dos 7 edifícios) da nossa cidade.

---

## 🏛️ Diretrizes Técnicas Importantes
1. **Formato**: Imagens PNG com **fundo transparente real**.
2. **Posicionamento e Rotação**: As imagens devem ser centralizadas com projeção isométrica para permitir que o recurso de rotação (inversão horizontal no canvas) e a movimentação funcionem perfeitamente.
3. **Conversão Automatizada**: Como a IA gera imagens com fundo (geralmente branco sólido), utilizaremos um script Python automatizado (`make_transparent.py`) para remover o fundo branco e salvar as imagens diretamente como PNG transparente em `assets/buildings/`.

---

## 📊 Tabela de Status de Imagens

| Edifício | Estágio 1 (Barraca) | Estágio 2 (Palha) | Estágio 3 (Madeira) | Estágio 4 (Pedra) | Estágio 5 (Nobre) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Prefeitura (Townhall)** | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente |
| **Hotel (Estalagem)** | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente |
| **Restaurante** | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente |
| **Hospital** | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente |
| **Taverna** | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente |
| **Forja** | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente |
| **Mercado (Market)** | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente | ⏳ Pendente |

*Legenda:*
* ⏳ *Pendente*: Imagem ainda não gerada.
* ✅ *Concluído*: Imagem gerada, processada para PNG transparente e salva em `assets/buildings/`.

---

## 📐 Ajuste da Área de Construção da Cidade

### Análise do Grid Atual:
* O grid atual da cidade é de **14 colunas por 12 linhas** (168 lotes unitários), definido em `src/core/town.js`.
* Os edifícios ocupam `2x2` lotes (e a Prefeitura ocupa `3x3` lotes). O espaço físico do grid é suficiente para acomodar todos os prédios, mas visualmente eles podem ficar muito juntos ou parecer pequenos caso o tamanho base de renderização seja pequeno.

### Ajuste de Escala Visual:
Para destacar a beleza das novas imagens e dar mais espaço para posicionamento:
1. **Aumentar o tamanho do grid físico**: Podemos expandir o grid para **16x14** ou **18x16** lotes. Isso distribuirá mais as construções.
2. **Aumentar a escala de renderização**: No arquivo `renderer.js`, a constante `imgBase` é baseada em `isoFootprintW * 1.5`. Podemos ajustar para `isoFootprintW * 1.8` ou `2.0` para que os prédios fiquem maiores na tela, mostrando melhor os detalhes das melhorias, e contar com o panning/zoom de câmera para navegação.

---

## 🛠️ Instruções para Geração e Remoção de Fundo
Uma vez que a cota de geração de imagens do Gemini for resetada, ou se você gerar as imagens em outra ferramenta, você pode remover o fundo branco e salvá-las no local correto usando o script Python:

```bash
python C:\Users\Usuario\.gemini\antigravity\scratch\make_transparent.py <caminho_imagem_com_fundo> C:\Users\Usuario\Documents\Codex\2026-06-18\estou-trabalhando-em-um-jogo-deixei\work\jogoidletycon\assets\buildings\<nome_predio>_<estagio>.png
```

*Exemplo:*
```bash
python C:\Users\Usuario\.gemini\antigravity\scratch\make_transparent.py C:\Users\Usuario\Desktop\townhall_1_raw.png C:\Users\Usuario\Documents\Codex\2026-06-18\estou-trabalhando-em-um-jogo-deixei\work\jogoidletycon\assets\buildings\townhall_1.png
```

---

## 🛠️ Próximos Passos
1. [x] Criar o script Python `make_transparent.py` para automatizar a remoção de fundo.
2. [x] Atualizar o código-fonte em `renderer.js` e `town.js` para suportar as 5 imagens de evolução e o grid de 16x14.
3. [Pendente - Aguardando Quota de Imagens] Gerar as 35 imagens dos edifícios no estilo 16-bit isometric pixel art.
