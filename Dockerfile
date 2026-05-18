FROM node:20

# Cria e define o diretório de trabalho
WORKDIR /usr/src/app

# Copia os arquivos de dependência primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instala as dependências de produção
RUN npm install --only=production

# Copia o restante do código da aplicação
COPY . .

# Expõe a porta que o servidor Node escuta
EXPOSE 3001

# O Dockerfile usa o script de inicialização para subir o servidor
CMD ["npm", "start"]
