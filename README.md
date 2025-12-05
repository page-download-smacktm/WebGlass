# WebGlass

WebGlass é um navegador minimalista com estilo "Glass" e ferramentas para desenvolvedores. Este projeto usa Electron como container de UI e inclui bibliotecas Node para automação/renderer (`puppeteer` e `playwright`).

Funcionalidades principais:
- Barra de endereço com pesquisa no Google por padrão
- Histórico e favoritos (persistidos em um arquivo JSON na pasta de dados do app)
- DevTools, Console integrado e atalho `Ctrl+U` para ver o código-fonte da página
- Atalhos: `Ctrl+L` (focar endereço), `Ctrl+U` (ver código fonte), `Ctrl+Shift+I` (DevTools)

Como executar:

1. Instale dependências:

```bash
npm install
```

2. Instale os navegadores do Playwright (o `postinstall` normalmente cuida disso):

```bash
npx playwright install --with-deps
```

3. Inicie o app:

```bash
npm start
```

Ferramentas auxiliares:
- `tools/puppeteer_playwright_helper.js` contém exemplos de como usar Puppeteer e Playwright para screenshots/automações.

Notas:
- O app usa um arquivo `webglass.json` em `app.getPath('userData')` para salvar histórico, favoritos e a última URL aberta.
- A interface de estilo chama-se "Glass" e está em `styles.css`.
