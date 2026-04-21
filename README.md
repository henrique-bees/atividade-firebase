# Atividade Firebase

Aplicacao web de demonstracao com `Firebase Auth` e `Firebase Realtime Database`, separando acesso entre os cargos `admin` e `user` por meio de `Firebase Security Rules`.

## O que este projeto entrega

- Estrutura do banco modelada como arvore JSON com os nos `/users` e `/admin-data`
- Cadastro e login com Firebase Auth
- Salvamento do cargo do usuario em `/users/{uid}/profile/role` no momento do cadastro
- Interface visual mostrando leituras permitidas e bloqueadas para cada cargo
- Regras do Realtime Database separando acesso por cargo
- Documentacao minima para subir no GitHub e apresentar em sala

## Estrutura do banco

O arquivo [database-structure.json](./database-structure.json) representa a arvore do Realtime Database.

Resumo da estrutura:

```json
{
  "users": {
    "UID_DO_USER": {
      "profile": {
        "uid": "UID_DO_USER",
        "email": "aluno@exemplo.com",
        "role": "user",
        "createdAt": 1776706200000
      },
      "private": {
        "lastLoginAt": 1776706200000,
        "welcomeMessage": "Conta user criada para a demonstracao."
      }
    },
    "UID_DO_ADMIN": {
      "profile": {
        "uid": "UID_DO_ADMIN",
        "email": "admin@exemplo.com",
        "role": "admin",
        "createdAt": 1776706200000
      },
      "private": {
        "lastLoginAt": 1776706200000,
        "welcomeMessage": "Conta admin criada para a demonstracao."
      },
      "adminAccess": {
        "grantedAt": 1776706200000,
        "note": "Admin autorizado para a demonstracao."
      }
    }
  },
  "admin-data": {
    "dashboard": {
      "title": "Painel exclusivo do administrador",
      "lastReviewAt": 1776706200000,
      "managedBy": "admin@exemplo.com"
    }
  }
}
```

## Regras de acesso

As rules estao em [database.rules.json](./database.rules.json).

- `user` autenticado pode ler o proprio no em `/users/{uid}`
- `user` nao pode ler `/users` inteiro
- `user` nao pode ler `/admin-data`
- `admin` pode ler `/users`
- `admin` pode ler e escrever em `/admin-data`
- O cargo em `/users/{uid}/profile/role` e gravado no cadastro e fica bloqueado para alteracao posterior

## Como rodar

1. Crie um projeto no Firebase.
2. Ative `Authentication > Email/Password`.
3. Ative `Realtime Database`.
4. Copie [.env.example](./.env.example) para `.env` e preencha com as chaves do seu projeto.
5. Publique as regras do arquivo [database.rules.json](./database.rules.json) no Realtime Database.
6. Instale as dependencias:

```bash
npm install
```

7. Inicie a aplicacao:

```bash
npm start
```

8. Abra `http://localhost:3000`.

## Fluxo da demonstracao em sala

1. Crie uma conta `user`.
2. Mostre na tela que ela consegue ler apenas `/users/{uid}`.
3. Mostre o erro `PERMISSION_DENIED` ao tentar acessar `/admin-data` e `/users`.
4. Saia da conta.
5. Crie uma conta `admin`.
6. Mostre que ela consegue ler `/users`, `/admin-data` e usar o botao `Popular /admin-data`.

## Arquivos principais

- [index.html](./index.html): interface da atividade
- [app.js](./app.js): integracao com Firebase Auth e Realtime Database
- [server.js](./server.js): servidor estatico e injecao da configuracao do Firebase via `.env`
- [database.rules.json](./database.rules.json): regras do Realtime Database
- [database-structure.json](./database-structure.json): arvore JSON pedida na atividade

## Observacao para a entrega

O item de `print ou video curto` ainda precisa ser gravado manualmente por voce, porque isso depende do seu projeto Firebase configurado e dos dois logins sendo executados no navegador.
