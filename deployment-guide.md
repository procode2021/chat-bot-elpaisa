# Guía de Despliegue en Linux (Ubuntu/Debian)

Esta guía detalla los pasos para poner en producción el chatbot usando PM2, Nginx y MongoDB.

## 1. Requisitos Previos

Asegúrate de tener instalados:
- Node.js (v18+)
- MongoDB
- Git

## 2. Instalación de Dependencias de Puppeteer (CRÍTICO)

Para que el código QR y WhatsApp funcionen en Linux, Chromium necesita varias librerías de sistema. Ejecuta:

```bash
sudo apt-get update
sudo apt-get install -y libgbm-dev gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

## 3. Preparación del Proyecto

1. **Clonar y compilar:**
   ```bash
   git clone <tu-repositorio>
   cd chatbot-ddd
   npm install
   npm run build
   ```

2. **Configurar variables de entorno:**
   Copia el archivo `.env.example` a `.env` y ajusta los valores (MONGO_URI, API_KEY, etc.).
   ```bash
   cp .env.example .env
   nano .env
   ```

## 4. Despliegue con PM2

1. **Instalar PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Iniciar la aplicación:**
   ```bash
   pm2 start dist/main.js --name "chatbot"
   ```

3. **Configurar reinicio automático:**
   ```bash
   pm2 startup
   pm2 save
   ```

## 5. Configurar Nginx (Proxy Inverso)

1. **Instalar Nginx:**
   ```bash
   sudo apt install nginx
   ```

2. **Configurar el sitio:**
   Crea un archivo en `/etc/nginx/sites-available/chatbot`:
   ```nginx
   server {
       listen 80;
       server_name tu_dominio.com; # O tu IP

       location / {
           proxy_pass http://localhost:3000; # Puerto de tu NestJS
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Habilitar el sitio y reiniciar Nginx:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 6. Verificación del QR

Una vez desplegado, accede a `http://tu_dominio.com/admin` y verás el código QR en la sección **WhatsApp QR**. Escanéalo y el bot estará listo.
