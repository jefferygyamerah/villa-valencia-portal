# Portal Villa Valencia

Portal digital para la HOA de Villa Valencia (APROVIVA), Costa Sur, Don Bosco, Panamá.

## Descripción

Portal comunitario para 118 propietarios que brinda transparencia sobre las operaciones, finanzas y mantenimiento de la asociación. Sitio estático alojado en GitHub Pages.

## Estructura

```
index.html          Portal principal (dashboard, comunicados, PQRS, finanzas)
proveedores.html    Directorio de proveedores con búsqueda y filtros
css/styles.css      Estilos compartidos
js/config.js        Configuración (URLs de Apps Script, enlaces de Drive)
js/app.js           Lógica de la página principal
js/proveedores.js   Lógica del directorio de proveedores
apps-script/        Backend en Google Apps Script
docs/               Documentos de referencia y prototipos
```

## Configuración

Edita `js/config.js` con tus valores:

- `APPS_SCRIPT_URL` — URL del Web App de Google Apps Script desplegado
- `DRIVE_LINKS` — URLs de las carpetas de Google Drive para cada sección de documentos

## Despliegue

Alojado en GitHub Pages desde la raíz de la rama `master`. Incluye `.nojekyll` para omitir el procesamiento de Jekyll.
