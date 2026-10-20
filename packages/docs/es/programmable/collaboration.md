---
title: Colaboración
description: Comparte un archivo con las personas que invites y editadlo juntos en tiempo real, con cifrado de extremo a extremo a través de Redrob Cloud.
---

# Colaboración

Comparte un archivo con las personas que invites y editadlo juntos en tiempo real. Para compartir hace falta iniciar sesión en Redrob Cloud (Ajustes, Cloud); todo lo demás en Redrob Design funciona sin cuenta.

## Compartir un archivo

1. Pulsa **Compartir** en la esquina superior derecha y luego **Compartir este archivo**.
2. Invita a personas por correo y elige qué puede hacer cada una: **Puede editar**, **Puede comentar** o **Puede ver**. Quien aún no tenga cuenta recibe el archivo la primera vez que inicie sesión con esa dirección.
3. **Copiar enlace** da un enlace que se abre para quienes tienen acceso.

Los archivos compartidos contigo aparecen en Inicio, en **Compartidos contigo**.

## Enlaces de visualización

**Crear enlace de visualización** genera un enlace con el que cualquiera puede leer el archivo, con o sin sesión. No sirve para editar ni comentar. Un enlace nuevo invalida el anterior, y **Desactivar** lo detiene al momento.

## Qué se sincroniza

- **Cambios del documento**, al momento, y el archivo queda guardado en Redrob Cloud.
- **Cursores y selecciones**, con el nombre y el color de cada persona.
- **Comentarios y versiones**, para todos los que tienen acceso.

Pulsa el avatar de un colaborador para seguir su vista; vuelve a pulsarlo para dejar de seguirla.

## Cómo funciona

Cada archivo compartido tiene su propia clave de contenido, creada en el equipo que lo compartió. Nombres, documento, cambios en directo, cursores, comentarios y versiones se cifran con ella antes de salir del equipo. Redrob Cloud solo guarda y reenvía texto cifrado.

Las sesiones en directo pasan por el relé de Redrob Cloud, un WebSocket de la API de Redrob Chat. No hay conexión P2P ni servidor de señalización público. El estado del documento es un CRDT (Yjs), así que las ediciones simultáneas se combinan sin conflictos.
