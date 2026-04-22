# Atividade Firebase

Aplicacao web de demonstracao com `Firebase Auth` e `Firebase Realtime Database`, separando o acesso entre os cargos `admin` e `user` por meio de `Firebase Security Rules`.

Este projeto foi pensado para a atividade de sala em que o objetivo e:

- modelar o banco como arvore JSON
- autenticar usuarios com Firebase
- salvar o cargo do usuario no banco
- restringir leitura e escrita com rules
- mostrar visualmente o que cada cargo pode ou nao acessar

## Visao Geral

O projeto nao usa backend de negocio tradicional. Quase toda a logica acontece no navegador:

- o usuario cria conta ou faz login com `Firebase Auth`
- depois disso, a aplicacao grava e le dados direto no `Realtime Database`
- as permissoes sao aplicadas pelo proprio Firebase, atraves das `Security Rules`

O arquivo [server.js](./server.js) existe apenas para:

- servir os arquivos estaticos
- ler o `.env`
- expor a configuracao do Firebase para o frontend em `/firebase-config.js`

Ou seja: quem realmente controla o acesso aos dados nao e o `server.js`, e sim o conjunto `Firebase Auth + Realtime Database + Security Rules`.

## O Que o Projeto Entrega

- Estrutura do banco modelada com os nós `/users` e `/admin-data`
- Cadastro e login com `Firebase Auth`
- Salvamento do cargo do usuario em `/users/{uid}/profile/role`
- Interface com comparacao visual entre permissoes de `user` e `admin`
- Dois modos de leitura:
  - `snapshot`: para comparar rapidamente leituras permitidas e bloqueadas
  - `realtime`: para acompanhar um caminho do banco em tempo real
- Rules separando o acesso por cargo
- Documentacao detalhada de configuracao e funcionamento

## Arquitetura do Projeto

### Frontend

- [index.html](./index.html): estrutura da interface
- [styles.css](./styles.css): visual da pagina
- [app.js](./app.js): autenticacao, leitura, escrita, modo snapshot e modo realtime

### Suporte local

- [server.js](./server.js): servidor estatico e injecao da configuracao do Firebase a partir do `.env`
- [.env.example](./.env.example): exemplo das variaveis necessarias

### Firebase

- [database.rules.json](./database.rules.json): regras do Realtime Database
- [database-structure.json](./database-structure.json): modelo da arvore JSON do banco

## Como o Projeto Funciona

### 1. Inicializacao

Quando a pagina abre:

1. O navegador carrega `index.html`
2. O `server.js` disponibiliza `/firebase-config.js`
3. O [app.js](./app.js) le `window.__FIREBASE_CONFIG__`
4. O app inicializa:
   - `initializeApp(firebaseConfig)`
   - `getAuth(app)`
   - `getDatabase(app)`

Se algum campo do `.env` estiver faltando, a interface mostra um erro antes mesmo de tentar autenticar.

### 2. Criacao de conta

Ao clicar em `Criar conta`, o fluxo e:

1. A conta e criada no `Firebase Auth` com `createUserWithEmailAndPassword`
2. A aplicacao grava os dados do usuario em `/users/{uid}`
3. O cargo escolhido no cadastro e salvo em:

```json
/users/{uid}/profile/role
```

4. Se o cargo for `admin`, o projeto tambem pode criar os dados iniciais de `adminAccess` e popular `/admin-data`

### 3. Login

Ao fazer login:

1. O usuario e autenticado via `Firebase Auth`
2. O app atualiza `lastLoginAt` em `/users/{uid}/private`
3. O frontend tenta ler:
   - `/users/{uid}`
   - `/admin-data`
   - `/users`
4. O resultado dessas leituras e mostrado na interface

### 4. Controle de acesso

O frontend apenas tenta ler e escrever.

Quem decide se a operacao pode ou nao acontecer e o Firebase:

- se a rule permitir, a leitura/escrita funciona
- se a rule negar, o app recebe `PERMISSION_DENIED`

Isso e importante porque a seguranca nao depende do HTML ou do JavaScript da tela. Ela depende das rules publicadas no Realtime Database.

## Estrutura do Banco

O arquivo [database-structure.json](./database-structure.json) representa a arvore JSON usada no projeto.

### Modelo completo

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
    },
    "audit": {
      "UID_DO_ADMIN": {
        "email": "admin@exemplo.com",
        "grantedAt": 1776706200000,
        "note": "Registro gerado pela interface da atividade"
      }
    }
  }
}
```

### Explicacao dos nos

#### `/users/{uid}/profile`

Guarda os dados principais do usuario.

- `uid`: identificador gerado pelo Firebase Auth
- `email`: email da conta autenticada
- `role`: cargo do usuario, `user` ou `admin`
- `createdAt`: timestamp da criacao

#### `/users/{uid}/private`

Guarda dados privados ligados ao uso da conta.

- `lastLoginAt`: ultimo login registrado
- `welcomeMessage`: mensagem exibida para a conta

#### `/users/{uid}/adminAccess`

Existe apenas quando o usuario e `admin`.

- `grantedAt`: quando o acesso admin foi criado
- `note`: observacao sobre o perfil admin

#### `/admin-data`

No reservado ao cargo `admin`.

- `dashboard`: informacoes gerais do painel administrativo
- `audit`: trilha simples de admins e atualizacoes

## Regras de Seguranca

As regras ficam em [database.rules.json](./database.rules.json).

### Regras completas

Use o conteudo abaixo no `Realtime Database > Rules` do Firebase Console:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "users": {
      ".read": "auth != null && root.child('users/' + auth.uid + '/profile/role').val() === 'admin'",
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || root.child('users/' + auth.uid + '/profile/role').val() === 'admin')",
        "profile": {
          ".write": "auth != null && auth.uid === $uid && !data.exists()",
          "uid": {
            ".write": "auth != null && auth.uid === $uid && !data.exists()",
            ".validate": "newData.isString() && newData.val() === $uid"
          },
          "email": {
            ".write": "auth != null && auth.uid === $uid && !data.exists()",
            ".validate": "newData.isString() && auth != null && newData.val() === auth.token.email"
          },
          "role": {
            ".write": "auth != null && auth.uid === $uid && !data.exists()",
            ".validate": "newData.val() === 'admin' || newData.val() === 'user'"
          },
          "createdAt": {
            ".write": "auth != null && auth.uid === $uid && !data.exists()",
            ".validate": "newData.isNumber() || newData.val() == now"
          },
          "$other": {
            ".validate": false
          }
        },
        "private": {
          ".read": "auth != null && (auth.uid === $uid || root.child('users/' + auth.uid + '/profile/role').val() === 'admin')",
          ".write": "auth != null && auth.uid === $uid"
        },
        "adminAccess": {
          ".read": "auth != null && (auth.uid === $uid || root.child('users/' + auth.uid + '/profile/role').val() === 'admin')",
          ".write": "auth != null && auth.uid === $uid && !data.exists() && root.child('users/' + $uid + '/profile/role').val() === 'admin'"
        }
      }
    },
    "admin-data": {
      ".read": "auth != null && root.child('users/' + auth.uid + '/profile/role').val() === 'admin'",
      ".write": "auth != null && root.child('users/' + auth.uid + '/profile/role').val() === 'admin'"
    }
  }
}
```

### Regra geral

No topo, o banco inteiro comeca bloqueado:

```json
".read": false,
".write": false
```

Isso significa que nenhum caminho e liberado por padrao.

### Regras de `/users`

#### Leitura da raiz `/users`

```json
".read": "auth != null && root.child('users/' + auth.uid + '/profile/role').val() === 'admin'"
```

Efeito:

- `admin` pode ler a raiz `/users`
- `user` nao pode ler todos os usuarios

#### Leitura de `/users/{uid}`

```json
".read": "auth != null && (auth.uid === $uid || root.child('users/' + auth.uid + '/profile/role').val() === 'admin')"
```

Efeito:

- o proprio usuario pode ler seu no
- o admin pode ler qualquer usuario

### Regras de `profile`

O no `profile` pode ser criado uma vez pelo proprio usuario:

```json
".write": "auth != null && auth.uid === $uid && !data.exists()"
```

Depois disso, os campos ficam protegidos por validacao:

- `uid` deve ser igual ao `uid` autenticado
- `email` deve bater com `auth.token.email`
- `role` so pode ser `admin` ou `user`
- `createdAt` deve ser numero ou `now`
- campos extras sao bloqueados por:

```json
"$other": {
  ".validate": false
}
```

### Regras de `private`

```json
".read": "auth != null && (auth.uid === $uid || admin...)",
".write": "auth != null && auth.uid === $uid"
```

Efeito:

- o proprio usuario pode atualizar `private`
- admin pode ler, mas nao escrever no `private` de outro usuario

### Regras de `adminAccess`

`adminAccess` so pode ser criado se o usuario ja tiver `role = admin`.

### Regras de `/admin-data`

```json
".read": "auth != null && role === 'admin'",
".write": "auth != null && role === 'admin'"
```

Efeito:

- `admin` pode ler e escrever em `/admin-data`
- `user` recebe `PERMISSION_DENIED`

## Modos da Interface

### Modo Snapshot

Esse e o modo mais rapido para demonstrar a atividade.

Ele tenta ler os caminhos principais uma vez:

- `/users/{uid}`
- `/admin-data`
- `/users`

Depois mostra:

- o JSON retornado
- os erros de permissao
- um resumo textual do que foi liberado ou bloqueado

### Modo Realtime

Esse modo usa listener em tempo real com `onValue(...)`.

Voce pode:

- ouvir o proprio caminho `/users/{uid}`
- ouvir `/users`
- ouvir `/admin-data`
- digitar um caminho manualmente

O modo realtime mostra:

- status atual do listener
- caminho observado
- numero de eventos recebidos
- horario da ultima atualizacao
- payload atual
- historico dos eventos recentes

## Configuracao do Firebase

### 1. Criar o projeto

No Firebase Console:

1. Crie um novo projeto
2. Adicione um app Web
3. Copie o `firebaseConfig`

### 2. Ativar Authentication

No menu `Authentication`:

1. Clique em `Get started`
2. Entre em `Sign-in method`
3. Ative `Email/Password`

### 3. Ativar Realtime Database

No menu `Realtime Database`:

1. Clique em `Create Database`
2. Escolha a regiao
3. Crie o banco
4. Depois substitua as rules pelas rules do arquivo [database.rules.json](./database.rules.json)

### 4. Preencher o `.env`

Copie [.env.example](./.env.example) para `.env` e preencha com os dados reais do projeto:

```env
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_DATABASE_URL=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
PORT=3000
```

Importante:

- o `.env` real nao deve ser commitado
- essas chaves do app web nao substituem as rules
- quem protege os dados de verdade sao as `Security Rules`

## Como Rodar Localmente

1. Instale as dependencias:

```bash
npm install
```

2. Confirme que o `.env` esta preenchido com os dados do seu projeto Firebase

3. Inicie o servidor:

```bash
npm start
```

4. Abra:

```text
http://localhost:3000
```

## Fluxo Recomendado de Teste

### Teste com `user`

1. Crie uma conta `user`
2. Verifique no resumo que o cargo salvo e `user`
3. Mostre que:
   - `/users/{uid}` funciona
   - `/admin-data` falha
   - `/users` falha

### Teste com `admin`

1. Crie uma conta `admin`
2. Verifique no resumo que o cargo salvo e `admin`
3. Mostre que:
   - `/users/{uid}` funciona
   - `/admin-data` funciona
   - `/users` funciona
4. Clique em `Popular /admin-data`
5. Abra o modo realtime e acompanhe as mudancas

## Observacoes Importantes

### Sobre o cargo `admin`

Neste projeto, o cargo `admin` pode ser escolhido no cadastro porque isso facilita a demonstracao da atividade.

Em um sistema real, o ideal seria:

- criar admins por backend seguro
- usar `Custom Claims`
- ou promover usuarios via painel administrativo restrito

### Sobre o `.env`

O `.env` local contem a configuracao do seu app Firebase e nao deve ir para o Git.

O projeto usa o `.env` apenas para configurar o frontend localmente. O controle de acesso continua sendo responsabilidade das rules publicadas no banco.

### Sobre erros comuns

#### `auth/api-key-not-valid`

Normalmente significa:

- chave copiada errada
- servidor local ainda usando um `.env` antigo

#### `auth/configuration-not-found`

Normalmente significa:

- `Authentication` ainda nao configurado
- `Email/Password` nao habilitado

#### `PERMISSION_DENIED`

Normalmente significa:

- a rule daquele caminho bloqueou a operacao
- ou as rules do console ainda nao foram atualizadas para a versao do projeto

## Arquivos Mais Importantes

- [index.html](./index.html): estrutura da interface
- [styles.css](./styles.css): visual da aplicacao
- [app.js](./app.js): integracao com Firebase, regras na pratica, modo snapshot e modo realtime
- [server.js](./server.js): servidor estatico e exposicao da configuracao do Firebase para o frontend
- [database.rules.json](./database.rules.json): regras do Realtime Database
- [database-structure.json](./database-structure.json): modelo da arvore JSON do banco
- [.env.example](./.env.example): modelo das variaveis de ambiente
