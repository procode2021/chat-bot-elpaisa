# Docker

Con Docker Desktop o Docker Engine iniciado, ejecuta desde esta carpeta:

```bash
docker compose up -d --build
```

La aplicación estará disponible en `http://localhost:3080`. Antes del primer
inicio, completa las credenciales reales en `.env`.

El stack incluye MongoDB y conserva tanto sus datos como la sesión de WhatsApp
en volúmenes Docker. Para ver el QR y los registros:

```bash
docker compose logs -f chatbot
```

Para detener los contenedores sin borrar los datos:

```bash
docker compose down
```
