# Guilda Idle: Tycoon de Heróis (Folclore Brasileiro & Equipamento Dinâmico)

Um jogo RPG de simulação e gerenciamento idle baseado na web, inspirado na mecânica e estética de *Evil Hunter Tycoon*. O jogador assume o papel de prefeito de uma cidade medieval, gerenciando a infraestrutura, suprimentos e upgrades de edifícios, enquanto heróis agem de forma autônoma caçando monstros, coletando itens e se equipando.

---

## 🎮 Como Jogar Online

O jogo está publicado no GitHub Pages e pode ser jogado diretamente no navegador pelo link:
👉 **[https://ViniciusMatoba.github.io/jogoidletycon/](https://ViniciusMatoba.github.io/jogoidletycon/)**

---

## 🌟 Funcionalidades e Diferenciais

### 1. IA de Heróis Autônoma
Os heróis operam em uma máquina de estados inteligente:
*   **Caça e Luta**: Saem da cidade para caçar monstros no bioma ativo, ganhando XP e loot.
*   **Gestão de Necessidades**: Se HP, fome, energia ou humor ficarem baixos, retornam sozinhos para a cidade.
*   **Uso de Edifícios**: Consomem suprimentos no **Hospital** (HP), **Restaurante** (Fome), **Hotel** (Energia) e **Taverna** (Humor), pagando ouro de volta para a prefeitura.
*   **Comércio interno**: Vendem materiais coletados na prefeitura para ganhar ouro e gastar na cidade.

### 2. Customização e Equipamentos Dinâmicos
*   **Heróis Únicos**: Cada herói nasce com traços físicos aleatórios (cor/estilo de cabelo, cor de pele e cor de roupa base).
*   **Visual de Equipamentos**: O visual do herói muda dinamicamente no Canvas de acordo com as armas (espadas, arcos, cajados) e armaduras que ele tem equipado.
*   **Animação no Canvas**: Animação de caminhada com pernas oscilantes e braço esticado em direção ao inimigo na hora do ataque.

### 3. Mitologia e Folclore Brasileiro
Os monstros clássicos dividem espaço com criaturas do nosso folclore em spawns mistos:
*   **Tocas Subterrâneas (Lvl 1)**: Ratos, Morcegos, **Corpo-Seco**, **Pisadeira** e o Mini-Boss **Chibamba**. Bosses: *Rato Rei* ou **Saci-Pererê**.
*   **Mata Fechada (Lvl 15)**: Goblins, Lobos, Aranhas, **Capelobo**, **Caipora** e **Quibungo**. Mini-Bosses: *Chefe Goblin* ou **Mula Sem Cabeça** (com chama animada no pescoço). Bosses: *Aranha Rainha* ou **Curupira** (com pés invertidos).
*   **Igarapés Profundos (Lvl 30)**: Sapos, Serpentes, Crocodilos, **Ipupiara**, **Teju Jagua** e **Boto Sedutor**. Mini-Bosses: *Sanguessuga* ou **Mapinguari** (com olho central e boca na barriga). Bosses: *Hidra* ou **Boitatá** (serpente flamejante articulada).
*   **Equipamentos Lendários**: Receitas extras de armas lendárias (*Cajado do Saci*, *Arco da Mula*, *Lâmina Curupira*, *Lâmina de Boitatá*, *Gibão de Mapinguari*) usando os loots raros do folclore.

---

## 🛠️ Tecnologias Utilizadas

*   **HTML5** (Estrutura do app e containers da UI)
*   **CSS3** (Estilização retro-gaming premium e layouts responsivos)
*   **JavaScript ES Modules** (Estrutura modular limpa e orientada a objetos)
*   **HTML5 Canvas 2D** (Renderização gráfica procedural estilo pixel-art)
*   **CI/CD GitHub Actions** (Deploy automatizado)

---

## 🚀 Como Executar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/ViniciusMatoba/jogoidletycon.git
   ```
2. Abra a pasta do projeto no seu terminal.
3. Inicie um servidor web estático (ex: usando `http-server` do Node):
   ```bash
   npx http-server -p 8080
   ```
4. Abra **`http://localhost:8080`** no navegador.
