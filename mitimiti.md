# MitiMiti - Documentación de Producto y Arquitectura

## 1. Visión General
**MitiMiti** es una funcionalidad integrada orgánicamente dentro de la aplicación Consumer de DeUna. Permite a los usuarios dividir cuentas y realizar pagos grupales de manera rápida, transparente y sin fricciones. 

Pensada para situaciones cotidianas (como dividir la cuenta de un restaurante, comprar un regalo grupal o hacer colectas), MitiMiti elimina la incomodidad de cobrar dinero uno por uno y automatiza la distribución y el seguimiento de los pagos en tiempo real.

---

## 2. Flujo de Usuario (Versión Actual V1)

La V1 sirve como un prototipo robusto y completamente funcional del lado del cliente y manejo de estado en la nube, diseñado para sorprender a los stakeholders y validar el flujo UX.

### 2.1. Creación de la Sala (El Anfitrión)
1. **Descubrimiento:** El anfitrión escanea el código QR de cobro de un comercio usando el escáner nativo a pantalla completa de la app.
2. **Intercepción inteligente:** Tras el escaneo, un modal interactivo intercepta la acción para preguntar: *"¿Deseas pagar solo o hacer MitiMiti?"*
3. **Configuración inicial:** Al seleccionar MitiMiti, el anfitrión ingresa el monto total de la cuenta.
4. **Sala de Espera (Waiting Room):** 
   - Se crea una "sala de pago" protegida en tiempo real.
   - El anfitrión cuenta con una interfaz limpia para invitar a amigos mediante:
     - Mostrar el **Código QR de la sala** presencialmente (con diseño integrado DeUna: esquinas moradas, centro `d!`).
     - Presionar **"Genera un link y compártelo"** para enviar la invitación por WhatsApp u otras redes.
     - Presionar **"Añadir desde contactos"** (visual).

### 2.2. Unión a la Sala (Los Invitados)
1. **Acceso Sin Fricción:** Los amigos escanean el QR de la sala o hacen clic en el link de invitación (Deep Linking).
2. **Sincronización Mágica:** Ingresan de inmediato a la misma sala sin perder contexto. Ven quién es el anfitrión y quiénes ya están adentro.
3. **División Dinámica:** A medida que ingresan más personas, el motor de MitiMiti divide el monto total equitativamente y en tiempo real en las pantallas de todos.

### 2.3. Ejecución y Liquidación
1. **Bloqueo (Lock):** Cuando todos están dentro, el anfitrión presiona "Bloquear sala y cobrar". Esto congela los montos y evita el ingreso de nuevos curiosos.
2. **Confirmación de Pago:** Las pantallas de los invitados cambian instantáneamente al estado de cobro, mostrando exactamente cuánto deben aportar. Presionan "Pagar mi parte".
3. **Actualización en Vivo:** Al ir pagando, los avatares de los participantes muestran un *check* verde. Todos ven quién ya pagó y a quién se está esperando.
4. **Finalización:** Cuando el 100% de los participantes ha aportado su parte, la sala lanza un estado de éxito, y el pago se consolida y envía al comercio original.

---

## 3. Arquitectura Técnica

- **Frontend:** `React` + `TypeScript` + `Vite` (Single Page Application).
- **Diseño UI/UX:** `TailwindCSS`. Se ha replicado milimétricamente la guía de estilos *Consumer* de DeUna (Minimalismo, componentes de lista nativos iOS/Android, colores institucionales `#4C1D80` y `#2FD9A9`, experiencia sin bordes "App-like" con `100dvh` y `manifest` PWA).
- **Estado Global & Tiempo Real:** `Supabase` (PostgreSQL + Realtime).
  - Tabla `mitimiti_rooms`: Administra la metadatos de la sala (token, monto, estado `waiting | locked | completed`).
  - Tabla `mitimiti_participants`: Lleva el control de concurrencia de quién está conectado y su estado de confirmación (`pending | confirmed`).
  - **Suscripciones Websocket:** El frontend utiliza canales de Supabase para reflejar cambios en milisegundos en todos los dispositivos conectados simultáneamente, brindando un factor "Wow".

---

## 4. Próximos Pasos y Roadmap (V2)

La V2 transformará este prototipo validado en una característica lista para producción, interconectando la lógica de UI con los servicios Core de Banco Pichincha / DeUna.

### 4.1. División Personalizada (Split Asimétrico)
- No todas las cuentas se dividen en partes iguales. La V2 permitirá que el anfitrión, o cada usuario individual, asigne su monto exacto a pagar de la factura (ideal para restaurantes donde alguien consumió más).

### 4.2. Integración Nativa de Contactos y Notificaciones Push
- Conectar MitiMiti con los amigos de DeUna.


### 4.4. Pagos Asíncronos ("Te pago luego")
- Opción para que el anfitrión asuma el 100% del pago en el comercio para no hacer esperar al cajero, y que MitiMiti envíe automáticamente "solicitudes de cobro pendientes" recurrentes a los amigos hasta que liquiden su deuda en la app.

### 4.5. Historial, Split Bills Fijos y Exportación
- **Descarga de Recibos:** Generación del comprobante con el detalle de la cuenta dividida.
- **Salas Recurrentes:** Capacidad de crear un grupo de MitiMiti fijo para personas que viven juntas y dividen gastos (renta, servicios) todos los meses.