# Momentum

Momentum es una PWA de gestión personal organizada en cuatro pilares: Salud, Finanzas, Proyectos y Hábitos.

## Primera fase

Esta primera base incluye navegación entre módulos, un dashboard sin datos de ejemplo, diseño responsive y soporte PWA instalable. No incluye autenticación, base de datos, formularios funcionales, gráficas, integraciones ni backend.

## Tecnologías

- React 18 + TypeScript + Vite
- React Router
- vite-plugin-pwa
- lucide-react
- CSS propio responsive

## Desarrollo

```bash
npm install
npm run dev
```

Para validar el proyecto:

```bash
npm run lint
npm run build
```

## Rutas

- `/inicio`
- `/salud`
- `/finanzas`
- `/proyectos`
- `/habitos`
- `/configuracion`

La raíz (`/`) redirige a `/inicio`. Las rutas no encontradas muestran una página 404.
