# Catálogo & Campañas MVP

Aplicación para gestionar un catálogo de productos y generar campañas comerciales dinámicas para su difusión en WhatsApp.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Enrutamiento**: React Router DOM v7

## Requisitos

- Node.js 18+
- Proyecto de Firebase con Firestore, Authentication y Storage habilitados
- Credenciales de Firebase (apiKey, authDomain, projectId, storageBucket, etc.)

## Variables de entorno

Copia el archivo `.env.example` a `.env.local` y completa las variables:

```env
VITE_FIREBASE_API_KEY="tu-api-key"
VITE_FIREBASE_AUTH_DOMAIN="tu-proyecto.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="tu-project-id"
VITE_FIREBASE_STORAGE_BUCKET="tu-proyecto.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="tu-sender-id"
VITE_FIREBASE_APP_ID="tu-app-id"
```

Todas las variables `VITE_FIREBASE_*` son requeridas. La aplicación falla al iniciar si falta alguna.

## Instalación y ejecución

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Ejecutar tests
npm run test
```

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo Vite |
| `npm run build` | Compila TypeScript y empaqueta con Vite |
| `npm run preview` | Vista previa de la compilación de producción |
| `npm run test` | Ejecuta los tests con Vitest |

## Documentación del proyecto

La documentación completa del sistema se encuentra en el directorio padre:

- [`../README.md`](../README.md) — Mapa de documentación y convención de nombres
- [`../01-prd.md`](../01-prd.md) — Requisitos y alcance del producto
- [`../02-arquitectura.md`](../02-arquitectura.md) — Decisiones técnicas y stack
- [`../03-modelo-datos.md`](../03-modelo-datos.md) — Entidades y relaciones del dominio
- [`../04-wireframes.md`](../04-wireframes.md) — Maquetas de interfaz de usuario
