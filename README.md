# Sobe&Desce

Uma aplicação mobile-first, sem dependências, para registar a pontuação do jogo
de cartas Sobe&Desce. É uma aplicação estática, por isso pode ser aberta
diretamente no navegador ou alojada no GitHub Pages.

## Executar localmente

Abre o ficheiro `index.html` num navegador. Não é necessário instalar ou
compilar nada.

## Regras implementadas

- Todos os jogadores começam com 20 pontos.
- Não ganhar vazas acrescenta 5 pontos; caso contrário, as vazas ganhas são
  subtraídas.
- Copas duplica as alterações de pontuação.
- Paus obriga todos os jogadores a jogar, por isso não é possível passar.
- Quem passa mantém a pontuação nessa ronda.
- Um jogador só pode passar duas rondas consecutivas. Depois tem de jogar uma
  ronda; ao jogar, o limite de passes é reposto.
- As cinco vazas têm de ser atribuídas antes de atualizar a pontuação.
- A aplicação preenche os valores restantes quando só existe uma solução
  matemática possível.
- Uma pontuação que chegue ou ultrapasse o zero é fixada em zero e vence o jogo.
- A última ronda pontuada pode ser reaberta para corrigir o trunfo, as vazas ou
  os passes, mesmo depois de a ronda seguinte já ter sido iniciada.
- O nome de cada jogador abre um histórico com um gráfico da evolução da
  pontuação e o detalhe de todas as rondas.
- O jogo em curso, incluindo o histórico, é guardado automaticamente no
  navegador e recuperado depois de atualizar ou fechar a página.

## GitHub Pages

Envia estes ficheiros para um repositório GitHub. Depois, seleciona **Settings →
Pages → Deploy from a branch** e escolhe o ramo que contém o ficheiro
`index.html`.

## Teste automático

O teste de navegador sem dependências utiliza o protocolo de depuração do
Chrome. Inicia o Chrome com depuração remota na porta `9222` e executa:

```sh
node tests/browser-smoke.mjs
```
