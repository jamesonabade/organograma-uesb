# Organograma - Árvore de Unidades

Aplicação web para visualização interativa da hierarquia organizacional (Organograma), com renderização baseada em D3.js. Ela pode se conectar diretamente ao banco de dados ou via API externa e possui funcionalidades avançadas como zoom, busca, diferentes modos de layout, exportação em PDF vetorizado de alta definição e logs sistêmicos.

---

## 🛠 Pré-requisitos (Produção)

A arquitetura foi modernizada para utilizar contêineres Docker, eliminando a necessidade de instalar Node.js ou dependências locais no servidor de produção.

- [Docker](https://docs.docker.com/get-docker/) instalado
- [Docker Compose](https://docs.docker.com/compose/install/) instalado

---

## 🚀 Como Rodar em Produção (Docker)

O processo de deploy agora é inteiramente empacotado num contêiner unificado, onde o Backend não apenas fornece a API, mas também serve os arquivos estáticos do Frontend em uma mesma porta.

### Passo 1: Escolher a Origem dos Dados (Variáveis de Ambiente)
O organograma precisa saber de onde puxar as informações dos setores. O sistema exige que você crie um arquivo chamado `.env` (use o `.env.example` como modelo) para definir isso. 

Existem duas formas de conexão (`DATA_SOURCE`):

- **Conexão via Banco de Dados (`DATA_SOURCE=db`):** O sistema lê os dados conectando-se diretamente ao banco de dados interno. É a forma tradicional. Requer que você informe usuário, senha e endereço do banco.
- **Conexão via API Externa (`DATA_SOURCE=api`):** O sistema consome os dados através da API. É uma forma mais moderna e segura, sem contato direto com o banco. Requer as chaves de acesso (Client ID, Secret e API Key).

*(Opcional)* Você pode configurar um "Cache" (`CACHE_TTL_MINUTES=60`). Isso faz o sistema memorizar os dados por X minutos, tornando o organograma muito mais rápido pois não precisará consultar a origem toda vez que alguém acessar.

> **Atenção:** Se você esquecer de preencher alguma informação obrigatória no `.env`, o sistema avisa o que está faltando e não inicia, para evitar falhas durante o uso.

### Passo 2: Construir e Iniciar a Aplicação

Caso opte por baixar a imagem de produção já pré-compilada da UESB, você pode iniciar o contêiner de duas formas:

**Opção A (Usando arquivo .env - Recomendado):**
```bash
docker run -p 3001:3001 --env-file .env registry.uesb.br/sig/organograma:1.0-SNAPSHOT
```

**Opção B (Conexão via Banco de Dados direto no terminal):**
```bash
docker run -p 3001:3001 -e DATA_SOURCE=db -e DB_USER=usuario -e DB_HOST=endereco -e DB_DATABASE=nome_banco -e DB_PASSWORD=senha -e DB_PORT=5432 registry.uesb.br/sig/organograma:1.0-SNAPSHOT
```

**Opção C (Conexão via API direto no terminal):**
```bash
docker run -p 3001:3001 -e DATA_SOURCE=api -e API_CLIENT_ID=seu_id -e API_CLIENT_SECRET=seu_secret -e API_KEY=sua_chave -e AUTH_URL=url_auth -e API_URL=url_api registry.uesb.br/sig/organograma:1.0-SNAPSHOT
```

Se precisar construir a imagem localmente (Desenvolvimento/Testes), utilize:

```bash
docker compose up --build
```

O argumento `--build` forçará a recriação da imagem caso haja modificações. O `-d` irá rodar o contêiner em modo *detached* (background).

### Passo 3: Acessar a Aplicação

O sistema estará rodando na porta `3001`!
- **Interface Visual (Frontend):** `http://localhost:3001/`
- **Endpoints (Backend):** `http://localhost:3001/api/...`

---

## 💻 Ambiente de Desenvolvimento Local (Modo Clássico)

Se precisar rodar ou testar localmente sem Docker, você ainda pode utilizar os comandos NPM.

1. Certifique-se de que possui o **Node.js (v18+)** e **NPM** instalados.
2. Na raiz do projeto, instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis no seu `.env` e inicialize o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

A aplicação subirá o backend, lerá o `.env` e já começará a servir o frontend na URL mapeada.

---

## 📋 Funcionalidades e Benefícios

- **Prevenção de Erros de Configuração:** O sistema verifica se todas as configurações obrigatórias foram fornecidas antes de iniciar. Se algo faltar, ele avisa claramente qual é o problema em vez de travar misteriosamente.
- **Histórico de Atividades:** Registra de forma silenciosa e organizada eventuais erros do sistema, ajudando a equipe técnica a resolver problemas rapidamente se eles surgirem.
- **Organização Inteligente de Setores sem "Pai":** Caso um setor seja cadastrado apontando para um setor superior que não existe mais (foi apagado, por exemplo), o organograma não quebra. Ele automaticamente agrupa essas unidades "órfãs" dentro de uma pasta visual chamada *"Unidade Pai Não Informada"*.
- **Exportação de PDF em Alta Definição:** Permite gerar um arquivo PDF de todo o desenho do organograma sem cortar informações ou achatar a imagem. Você pode dar zoom infinito no PDF que as letras continuarão nítidas!
