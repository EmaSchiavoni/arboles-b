# Árboles B · Playground

Aplicación web estática para experimentar con la estructura de datos Árbol B. Incluye dos playgrounds: uno automático que genera y mantiene el árbol al insertar, eliminar y buscar claves; y un editor manual para construir el árbol a mano y validar si cumple las reglas.

Demo en línea: https://arbolesb.schiavoni.dev/ (despliegue automático a GitHub Pages con Actions en cada push a `main`).

## Definición de orden

En este proyecto, el orden `p` es la cantidad máxima de punteros de árbol por nodo. Cada nodo contiene como máximo `p - 1` claves. Los nodos que no son raíz contienen como mínimo `ceil(p/2) - 1` claves (es decir, `ceil(p/2)` punteros si no son hojas). La raíz contiene entre 1 y `p - 1` claves si es el único nodo, o entre 2 y `p` punteros si tiene hijos. Cada nodo tiene 0 hijos (hoja, con todos sus punteros nulos) o exactamente `|claves| + 1` hijos. Todas las hojas se encuentran a la misma profundidad. Las claves están ordenadas de forma ascendente y no hay duplicados. Cada hijo `i` contiene claves dentro del rango `(claves[i-1], claves[i])`.

## Playground automático

Permite configurar el orden `p`, insertar, eliminar y buscar claves numéricas de a una o en lista (con separador autodetectado: `,`, `.`, `-` o espacio, siempre el mismo), generar claves aleatorias, vaciar el árbol y consultar el historial de operaciones. Cada nodo se muestra como una tabla completa de `2p - 1` columnas (punteros delgados y claves), con las celdas vacías siempre visibles. El camino de búsqueda se resalta en el canvas. Al insertar, se marca en verde la clave nueva y con borde los nodos creados o modificados por la inserción (divisiones incluidas). El panel superior muestra el máximo y mínimo de claves por nodo, la altura, la cantidad de nodos y la cantidad total de claves. Al cambiar el orden, el árbol se reconstruye reinsertando las claves existentes. El estado se conserva en `localStorage`, junto con un historial de las últimas operaciones donde cada entrada despliega sus pasos (desbordamientos, divisiones, medianas, préstamos, fusiones).

## Editor manual

Editor libre para construir el árbol a mano: crear y eliminar nodos, editar claves, arrastrar nodos por el canvas, marcar la raíz y conectar punteros por slots (`|claves| + 1` por nodo). Cada nodo es una tabla completa de `2p - 1` columnas siempre visible, con las celdas de clave vacías listas para escribir directo en ellas (sin input de alta: el botón `+` del nodo lleva el foco a la primera celda vacía y se oculta cuando el nodo está lleno; vaciar una celda con clave la elimina). En escritorio, el botón `+` aparece al pasar el cursor sobre un slot; en móvil está siempre visible. Al iniciar una conexión se resaltan los destinos posibles; la conexión se cancela con `Esc` o tocando el fondo del canvas. El botón Validar verifica todas las reglas del orden `p` configurado y muestra el resultado en una lámina inferior (bottom sheet), resaltando los nodos afectados. Hay deshacer hasta 6 pasos y rehacer (botones o `Ctrl+Z` / `Ctrl+Shift+Z`; cualquier acción nueva vacía el rehacer). El borrador se conserva en `localStorage`.

## Validación

El validador comprueba: claves ordenadas y sin duplicados (dentro de cada nodo y en todo el árbol), cantidad de claves según `p`, cantidad de hijos igual a 0 o a `|claves| + 1` con todos los slots conectados, raíz única y alcanzable, ausencia de ciclos y nodos sueltos, rango de claves válido en cada subárbol y hojas a igual profundidad.

## Interfaz

Componentes estilo shadcn con Tailwind, paleta monocromática (zinc) y radios completamente redondeados. Soporta tema claro y oscuro con persistencia. Diseño mobile-first sin barra superior: el cambio de modo y el tema van en botones flotantes arriba a la derecha. El diagrama ocupa toda la pantalla, sin bordes; se navega arrastrando el fondo y con zoom (pellizco en móvil, `Ctrl` + rueda o `Ctrl` + `+`/`-` en PC, con indicador de % editable abajo a la derecha —en móvil el indicador aparece unos segundos debajo de los botones superiores al cambiar el zoom—); los mensajes y el historial o resultado de la validación aparecen como paneles flotantes sobre él. Las barras de herramientas son flotantes, están fijadas abajo, centradas y con ancho mínimo.

## Uso

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # compilación a dist/
npm run preview  # vista previa de la compilación
```

Sin backend ni base de datos: toda la persistencia (tema, orden de cada playground, último árbol automático, borrador manual y vista con paneo/zoom de cada modo) reside en `localStorage`.

## Estructura del código

- `src/lib/btree.ts`: inserción con división, eliminación con préstamo y fusión, búsqueda.
- `src/lib/validate.ts`: validación de árboles manuales.
- `src/lib/layout.ts`: cálculo de posiciones por niveles.
- `src/lib/storage.ts`: acceso a `localStorage`.
- `src/routes/PlayAuto.tsx`: playground automático.
- `src/routes/PlayManual.tsx`: editor manual.
- `src/components/TreeCanvas.tsx`: canvas compartido.
- `src/components/BottomToolbar.tsx`: barra flotante inferior.
