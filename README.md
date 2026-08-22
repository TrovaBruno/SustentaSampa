# FloodGuard Alert

Você é um desenvolvedor Full Stack Sênior especialista em aplicações geográficas (GIS), acessibilidade e Node.js. 

Sua tarefa é criar o MVP (Produto Mínimo Viável) completo e funcional de um aplicativo de alerta e mapeamento de alagamentos urbanos chamado "FloodGuard".

---

### REQUISITOS DE DESIGN E FUNCIONALIDADES (UX/UI)

1. **Onboarding & Tela Inicial (O Quadro do App):**

   - Design focado em Alto Contraste (Fundo escuro `#121212`, cards contrastantes, textos em destaque `#FFD700` ou `#FFFFFF` e botões grandes com áreas de toque de no mínimo 56px).

   - Card fixo no topo da tela com o "Status do Entorno", exibindo dinamicamente o nível de risco baseado na localização (Baixo, Médio, Alto, Crítico).

   - Botão para alternar visualmente para "Modo Emergência / Chuva Forte".

2. **Mapa Interativo e Mapa de Calor (Core Feature):**

   - Renderização de mapa usando Leaflet.js e a biblioteca Leaflet.heat para exibir um mapa de calor em tempo real.

   - Esquema de cores do calor: Amarelo (Atenção/Meio-fio) ao Vermelho Escuro (Intransitável).

   - Botão Flutuante (FAB) de "Reportar Alagamento".

   - Modal de Reporte Rápido em 3 passos simples (cliques diretos sem digitação):

     - Passo 1 (Transitabilidade): [Transitável] | [Apenas Veículos Altos] | [Intransitável]

     - Passo 2 (Nível da Água): [Canela] | [Joelho] | [Acima do Capô]

     - Passo 3: Botão de Enviar Reporte.

3. **Gamificação e Reputação ("Guardião da Cidade"):**

   - Atribuição automática de +10 pontos no perfil do usuário a cada reporte enviado.

---

### ESTRUTURA DO CÓDIGO (ARQUITETURA MALEÁVEL)

Gere uma aplicação completa em Node.js com Express para o backend e uma interface Web interativa no frontend. O código deve ser totalmente contido nos dois arquivos abaixo:

#### 1. Arquivo `server.js` (Backend API)

- Servidor Express rodando na porta 3000.

- Servir arquivos estáticos da pasta `public`.

- Estrutura de dados em memória maleável (pronta para substituição por banco de dados relacional ou NoSQL).

- Rota GET `/api/risk-status?lat={lat}&lng={lng}`: Calcula distância geográfica (Fórmula de Haversine) e retorna o status de risco do raio de 1km.

- Rota GET `/api/heatmap-data`: Retorna a lista de coordenadas e pesos `[lat, lng, weight]` para o mapa de calor.

- Rota POST `/api/reports`: Recebe o reporte, atualiza a lista de pontos do mapa e adiciona pontuação ao usuário.

#### 2. Arquivo `public/index.html` (Frontend com Leaflet.js)

- HTML5 completo com CSS embutido em estilo Dark/High-Contrast.

- Integração via CDN das bibliotecas: Leaflet.js (`leaflet.css` e `leaflet.js`) e Leaflet.heat (`leaflet-heat.js`).

- Scripts em JS Vanilla para carregar o mapa, buscar status do entorno via API, renderizar o mapa de calor e enviar o formulário do modal em 3 toques.

---

### INSTRUÇÕES DE SAÍDA

Por favor, forneça o código completo e executável para os dois arquivos (`server.js` e `public/index.html`), sem omitir trechos de lógica, prontos para execução com o comando `node server.js`.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://urban-flood-alert.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d0f7f3eb-374d-4b2f-9211-ec394b8c705c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
