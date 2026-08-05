# AGENTS.md — Momentum

## 1. Resumen del Proyecto
Momentum es una PWA de gestión personal integral estructurada en cuatro pilares: **Salud, Finanzas, Proyectos y Hábitos**. El objetivo del MVP es el registro manual estable y una interfaz clara antes de añadir integraciones externas.

## 2. Stack Tecnológico Principal
- **Frontend:** React 18, TypeScript, Vite, TanStack Query, React Router.
- **Backend/Base de Datos:** Supabase (Auth, PostgreSQL, RLS, Storage).
- **Estilos:** UI en Español, términos internos/código en Inglés.

## 3. Comandos de Desarrollo Críticos
Priorizar el uso de estos comandos para validar cambios antes de finalizar:
```bash
npm install        # Instalar dependencias
npm run dev        # Iniciar entorno local
npm run build      # Validar compilación completa
npm test           # Ejecutar suites de prueba

4. Reglas de Ingeniería y Convenciones
Simplicidad: Elegir siempre la solución más simple; evitar sobre-arquitectura
Seguridad (RLS): Toda tabla de usuario debe tener habilitado Row Level Security y filtrar por user_id
Tipado: Prohibido el uso de any. Usar interfaces y tipos generados de Supabase
Base de Datos: Cambios solo mediante migraciones. Usar UUIDs, snake_case y timestamptz en UTC
UI/UX: Diseño responsivo, limpio y consistente. La terminología de la interfaz debe ser estrictamente en español (Registrar, Guardar, Editar, Eliminar)

5. Límites y Restricciones de Codex
No realizar sin autorización explícita:
Ejecutar git push o modificar el historial de Git
Aplicar migraciones destructivas en producción
Instalar nuevas dependencias o actualizar versiones de package.json
Enviar datos del usuario a APIs externas no configuradas

6. Formato de Respuesta Esperado
Al completar una tarea, responde brevemente con:
Resumen: Qué se implementó.
Archivos: Lista de cambios.
Decisiones: Justificación técnica clave.
Validaciones: Resultado de Lint, Pruebas y Build.
Pendientes: Solo si hay bloqueos reales.