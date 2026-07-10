# Como carregar no GitHub

Use esta pasta como origem limpa:

```text
C:\Users\user\Documents\SupaMnager\EduCareer-github-ready
```

## Upload via terminal

Crie um repositorio vazio no GitHub chamado `educareer`, depois execute dentro desta pasta:

```bash
git init
git add .
git commit -m "Initial EduCareer app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/educareer.git
git push -u origin main
```

Substitua `YOUR-USERNAME` pelo seu utilizador do GitHub.

## Antes de publicar

- Confirme que nao existe `.env` real no repositorio.
- Confirme que `node_modules` e `dist` nao aparecem em `git status`.
- Defina se o repositorio sera privado ou publico.
- Se for publico, escolha uma licenca antes de aceitar contribuicoes externas.
