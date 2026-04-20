# Atividade MongoDB

Aplicacao web de demonstracao com frontend em HTML/CSS/JS e backend Node.js, usando MongoDB Atlas para separar acesso por cargo entre `admin` e `user`.

## O que o projeto entrega

- Cadastro e login persistidos na collection `users`
- URI do MongoDB protegida em `.env`
- Interface visual mostrando o que cada cargo consegue ou nao acessar
- API local que restringe os endpoints de acordo com o papel do usuario
- Estrutura do banco adaptada para o database `FirebaseProject`

## Estrutura do projeto

- [index.html](./index.html): interface da atividade
- [styles.css](./styles.css): visual responsivo da demonstracao
- [app.js](./app.js): autenticacao no frontend e leitura da API
- [server.js](./server.js): servidor Express e conexao com MongoDB Atlas
- [database-structure.json](./database-structure.json): modelo sugerido para a collection `users`
- [.env.example](./.env.example): exemplo de configuracao local

## Estrutura da collection `users`

O arquivo [database-structure.json](./database-structure.json) mostra o formato esperado dos documentos. Cada usuario salvo no MongoDB segue este padrao:

```json
{
  "uid": "UID_DO_USUARIO",
  "email": "aluno@exemplo.com",
  "passwordHash": "salt:hash",
  "profile": {
    "email": "aluno@exemplo.com",
    "role": "user",
    "createdAt": "2026-04-20T17:30:00.000Z"
  },
  "private": {
    "lastLoginAt": "2026-04-20T17:30:00.000Z",
    "welcomeMessage": "Conta user criada para demonstracao."
  },
  "adminAccess": null
}
```

O painel `admin-data` agora nao e uma collection separada: ele e montado dinamicamente pela API com base nos usuarios admin cadastrados.

## Como rodar

1. Confirme o `.env` com sua URI do Atlas.
2. Instale as dependencias:

```bash
npm install
```

3. Inicie a aplicacao:

```bash
npm start
```

4. Abra `http://localhost:3000`.

## Fluxo da demonstracao

1. Crie uma conta com cargo `user`.
2. Mostre que ela consegue ler apenas `/api/users/me`.
3. Mostre que `/api/users` e `/api/admin-data` retornam bloqueio.
4. Saia da conta.
5. Crie ou entre com uma conta `admin`.
6. Mostre que o admin consegue ler `/api/users/me`, `/api/users` e `/api/admin-data`.

## Observacao importante

Esta implementacao atende bem a atividade e protege a URI do banco no servidor, mas o gerenciamento de sessao e simplificado para fins didaticos. Em producao, o ideal seria usar JWT ou sessao persistente com expiracao, validacao extra e hash de senha mais completo com biblioteca dedicada.
