# Catálogo & Campañas MVP

Aplicación para gestionar un catálogo de productos y generar campañas comerciales dinámicas para su difusión en WhatsApp.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Firebase (Firestore, Auth)
- **Imágenes**: Cloudinary (unsigned upload desde el frontend)
- **Enrutamiento**: React Router DOM v7

## Requisitos

- Node.js 18+
- Proyecto de Firebase con Firestore y Authentication habilitados
- Cuenta de Cloudinary con un upload preset unsigned configurado (`naldopro_unsigned`)
- Credenciales de Firebase (apiKey, authDomain, projectId, messagingSenderId, appId)

## Variables de entorno

Copia el archivo `.env.example` a `.env.local` y completa las variables:

```env
VITE_CLOUDINARY_CLOUD_NAME="tu-cloud-name"  # Opcional, por defecto "lfv9qink"
VITE_FIREBASE_API_KEY="tu-api-key"
VITE_FIREBASE_AUTH_DOMAIN="tu-proyecto.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="tu-project-id"
VITE_FIREBASE_STORAGE_BUCKET="tu-proyecto.appspot.com"  # Opcional
VITE_FIREBASE_MESSAGING_SENDER_ID="tu-sender-id"
VITE_FIREBASE_APP_ID="tu-app-id"
```

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID` son obligatorios.
La aplicación falla al iniciar si falta alguno.
`VITE_FIREBASE_STORAGE_BUCKET` es opcional (solo necesario si se usa Firebase Storage).
`VITE_CLOUDINARY_CLOUD_NAME` es opcional; si no se define se usa `lfv9qink` por defecto.

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

## Tradeoffs de seguridad aceptados (MVP)

| Riesgo | Aceptado | Mitigación futura |
|--------|----------|-------------------|
| **Upload unsigned a Cloudinary** desde el frontend sin firma del lado servidor. Cualquiera con el `cloud_name` y `upload_preset` puede subir archivos a tu bucket de Cloudinary. | ✅ Sí, para MVP personal. El upload preset `naldopro_unsigned` debe estar restringido en la [Consola de Cloudinary](https://console.cloudinary.com) (Signed URL + lista blanca de dominios). | Migrar a upload firmado con un backend proxy que genere firmas usando `api_secret`. |

### Por qué se acepta

Este es un proyecto personal en etapa MVP. No hay usuarios externos ni datos sensibles
en las imágenes subidas. Implementar un backend solo para firmar uploads de imágenes
agrega complejidad operativa sin beneficio real en esta fase.

### Cuándo hardening

- Cuando la aplicación tenga más de un usuario activo, **o**
- Cuando se almacenen imágenes con datos sensibles (documentos, rostros), **o**
- Cuando el proyecto se abra a producción pública.

En ese momento: agregar un endpoint `POST /api/cloudinary/sign` (o similar) que use
`api_secret` para generar firmas, y cambiar el frontend a upload firmado.

## Documentación del proyecto

La documentación completa del sistema se encuentra en el directorio padre:

- [`../README.md`](../README.md) — Mapa de documentación y convención de nombres
- [`../01-prd.md`](../01-prd.md) — Requisitos y alcance del producto
- [`../02-arquitectura.md`](../02-arquitectura.md) — Decisiones técnicas y stack
- [`../03-modelo-datos.md`](../03-modelo-datos.md) — Entidades y relaciones del dominio
- [`../04-wireframes.md`](../04-wireframes.md) — Maquetas de interfaz de usuario
