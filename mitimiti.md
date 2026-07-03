# MitiMiti - Documentación de Flujo y Funcionalidad

## 1. ¿Qué es MitiMiti?
**MitiMiti** es una nueva funcionalidad conceptual propuesta para la aplicación de DeUna. Su objetivo principal es facilitar la recolección y división de pagos entre grupos de amigos (pagar la cuenta del restaurante, el regalo de un amigo, la cancha de fútbol, etc.) de una manera extremadamente rápida, social y sin fricciones, utilizando la misma mecánica a la que los usuarios ecuatorianos ya están acostumbrados: **el escaneo de códigos QR**.

## 2. Experiencia de Usuario (UI/UX)
El diseño de MitiMiti se ha integrado directamente en la UI de la **App para Usuario (Consumer App)** de DeUna, siguiendo sus patrones de diseño nativos:
* **Clean UI:** Se utilizan botones limpios y sutiles (fondo claro `#EEEDFE`, texto morado `#4C1D80`), listas minimalistas e íconos estilizados.
* **Sin distracciones:** Se eliminaron botones invasivos (como "Descargar PDF") de la pantalla de sala para mantener la vista enfocada en compartir e invitar.
* **App-like feel:** La aplicación se renderiza a pantalla completa (Fullscreen) en dispositivos móviles, eliminando la barra de direcciones del navegador.

## 3. Flujos de Uso

### A. Flujo de Creación de Sala (El Host)
1. **Punto de Entrada:** El usuario abre su aplicación y presiona el ícono de **"MitiMiti"** en la grilla del Dashboard.
2. **Setup de Sala:** 
   * Se le pide al anfitrión (Host) el motivo o nombre de la recolección (ej. *"Merienda"* o *"Regalo de Juan"*).
   * Ingresa el monto total de la cuenta a dividir (ej. *$20.00*).
3. **Sala de Espera (Waiting Room):** 
   * Se crea la sala y se muestra un gran **Código QR** en pantalla completa.
   * El código QR mantiene el branding de DeUna (esquinas moradas gruesas y el logo `d!` verde agua en el centro con un nivel de corrección de error alto - Nivel H - para asegurar lectura rápida).
   * **Invitar a otros:**
     * Presencialmente: Los amigos escanean la pantalla del Host con sus propios celulares usando la app DeUna.
     * A distancia: El Host puede enviar un enlace directo mediante la opción *"Genera un link y compártelo"* debajo del QR.
     * Manual: En la pestaña "Participantes", el Host tiene la opción *"Añadir desde contactos"*.

### B. Flujo de Unión (El Invitado)
1. **Punto de Entrada:**
   * El invitado abre su app de DeUna, presiona el gran botón de **"Escanear QR"** y apunta a la pantalla del Host. (La pantalla de cámara cubre el 100% de la interfaz para una inmersión total).
   * *Alternativamente:* El invitado hace clic en el link de WhatsApp enviado por el Host.
2. **Reconocimiento del QR:** La app identifica que es un "QR de Sala MitiMiti" (en lugar de un pago directo P2P) e inscribe instantáneamente al invitado en la sala del Host.
3. **Confirmación:** El invitado ve el detalle de la cuenta, y su cuota correspondiente (dividida en partes iguales automáticamente).
4. **Swipe to Pay:** El invitado confirma su participación realizando el gesto de *"Swipe to Pay"*.

### C. Bloqueo de Sala y Cobro
1. **Bloqueo (Lock):** Una vez que todos los invitados están en la lista de la sala, el Host presiona **"Bloquear sala y continuar"**. Esto evita que más personas entren y congela el monto exacto de división para cada participante.
2. **Confirmación del Host:** El Host revisa el resumen final y presiona *"Cobrar $X"*.
3. **Transacción en Tiempo Real:** El backend debita el dinero de todos los participantes confirmados y lo acredita en la cuenta del Host.
4. **Resumen Exitoso:** Se muestra una pantalla de éxito celebrando que *"¡Todos pagaron MitiMiti!"*.

## 4. Arquitectura Técnica
* **Frontend:** React + Vite + Tailwind CSS. Manejo de estado de navegación local (`Screen`) para la UI de Consumer, combinado con navegación por `hash` (`window.location.hash`) para los enlaces profundos (Deep Links) de MitiMiti.
* **Escáner QR:** Utiliza `html5-qrcode` ajustado para utilizar el 100% de la pantalla (`object-fit: cover`) eliminando bordes predeterminados.
* **Sincronización Backend:** Toda la interactividad de la sala está impulsada por el motor de **Supabase Realtime (PostgreSQL)**, lo que permite que el Host vea mágicamente cómo aparecen los nombres de sus amigos en la pantalla en el instante en que estos escanean el QR.