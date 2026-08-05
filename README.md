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

## Supabase local

La configuración local está preparada, pero todavía no incluye tablas, migraciones de producto, autenticación ni cliente de Supabase.

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop
```

Copiá `.env.example` a `.env.local` si necesitás reconstruir las variables de entorno. La clave anónima local se muestra con `npm run supabase:status`; `.env.local` no se versiona.

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
