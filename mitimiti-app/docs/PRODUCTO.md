# MitiMiti · Producto y estrategia

> **De "¿cuánto es cada uno?" a "¡Cuentas claras!" en minutos, en el chat donde ya están tus amigos.**

## 1. El problema

Escena de todos los fines de semana en Quito o Guayaquil: llega la cuenta de $86,40 a una
mesa de cinco. Alguien saca la calculadora del celular, otro dice "yo solo pedí un jugo",
nadie sabe cómo repartir el 10 % de servicio y el IVA, y uno termina pagando todo con su
tarjeta "y luego me transfieren". Después:

- **Quien pagó persigue a los demás** durante días, y le da vergüenza recordar.
- **Los datos para pagar se piden por chat** una y otra vez ("pásame tu cuenta", "¿es de
  ahorros?", "¿tu cédula?"), con errores al copiar.
- **Nadie sabe quién ya pagó**: capturas de transferencias perdidas en el grupo.
- **Lo chiquito se olvida**: el taxi de $5, las entradas que pagó un amigo.

Las herramientas que existen no encajan en ese momento: la calculadora no hace seguimiento,
las apps de los bancos dividen solo entre clientes del mismo banco o billetera, y las apps
de gastos compartidos están pensadas para grupos y viajes de largo plazo, piden que todos
instalen y creen cuenta, y en su versión gratis ponen cada vez más límites y publicidad.

## 2. Para quién

- **La persona que suele pagar** ("el que pone la tarjeta"): 20–35 años, sale con amigos o
  compañeros de trabajo, paga con tarjeta o transferencia y cobra por WhatsApp. Es quien
  crea la cuenta y quien más gana: cobra más rápido y sin incomodidad.
- **Los invitados**: no buscaron la app; les llega un link. Para ellos MitiMiti tiene que
  funcionar en 20 segundos, sin instalar nada, solo con su nombre.
- **Quien no tiene celular a mano** (la abuela, el amigo sin batería): entra igual, a mano,
  y su parte se le puede mandar después.

## 3. Principios (lo que no negociamos)

1. **El invitado no instala nada.** Link, QR o código de 6 letras → su nombre → listo.
2. **Un solo dato para empezar: el nombre.** Sin contraseña ni correo. El respaldo con correo
   se ofrece cuando ya hay algo que proteger.
3. **No movemos dinero.** Decimos cuánto y a quién; cada uno paga como ya paga (transferencia,
   Deuna, Payphone, efectivo). Sin licencias de pagos, sin comisiones, sin desconfianza.
4. **Centavos exactos y justos.** La suma siempre cuadra; los centavos que sobran los pone
   quien pagó, nadie paga de más por redondear; el servicio se reparte según lo que consumió
   cada uno.
5. **Cerrar el ciclo.** No basta con dividir: "Ya le pagué" → "Recibido" → "¡Cuentas claras!".
   Esa confirmación es lo que genera confianza y lo que nos diferencia.
6. **Cero vergüenza.** Recordatorios amables, con límite (uno cada 20 horas), escritos como
   los escribiría un amigo.
7. **Cada mensaje es una invitación.** Cada link de cuenta, préstamo o recordatorio que se
   comparte trae a alguien nuevo a MitiMiti: el crecimiento viene del uso, no de anuncios.

## 4. Qué tiene el MVP

| Momento | Lo que hace MitiMiti |
|---|---|
| En la mesa | Crear la cuenta con el total (con IVA y servicio) y compartir link/QR/código. Los demás entran en vivo. |
| Dividir | Partes iguales · montos diferentes (se reacomoda solo) · por productos (lo compartido se divide, el servicio en proporción). Personas sin celular. Propina. |
| Pagar | Cada uno ve su monto y los datos de quien pagó, con copiar. "Ya le pagué" con el medio. |
| Cobrar | Quién te debe, quién dice que pagó ("Recibido" / "No me llegó"), "Ya me pagó" en efectivo, recordar por WhatsApp, perdonar. |
| Después | Saldos netos por persona (entre varias cuentas y préstamos), historial, actividad, avisos en vivo. |
| Entre cuentas | Préstamos con link ("te presté $5"), confirmados por el otro. Link de cobro público. |
| Tu cuenta | Respaldo y recuperación con código al correo, modo oscuro, PWA instalable. |

**Fuera del MVP, a propósito:** grupos y viajes de varios días, varias monedas en pantalla
(la base ya guarda la moneda), escaneo de recibos, pagos dentro de la app, notificaciones
push del sistema. Todo eso está en la hoja de ruta, pero ninguno es necesario para resolver
la escena de la mesa.

## 5. Por qué nosotros, por qué ahora

- Las **transferencias inmediatas y las billeteras** (Deuna, Payphone, apps de bancos) ya son
  normales en Ecuador: el "¿cómo te pago?" está resuelto; falta el "¿cuánto y a quién?" y el
  seguimiento.
- **WhatsApp es universal**: es el canal de distribución y de recordatorio, sin costo.
- La **cámara del celular lee QR** de fábrica: entrar a una cuenta desde la mesa es un gesto
  que la gente ya conoce por los menús.
- **Datos de transferencia locales**: banco, tipo de cuenta, número, titular y cédula/RUC,
  con validación de cédula ecuatoriana. Es un detalle que las apps globales no cuidan.

## 6. Cómo nos comparamos

| | Calculadora + WhatsApp | Apps de bancos | Apps de gastos compartidos | Divisores de recibos con IA | **MitiMiti** |
|---|---|---|---|---|---|
| Invitados sin instalar | ✔︎ | ✘ (mismo banco) | ✘ | a veces | **✔︎** |
| Por productos + servicio proporcional | ✘ | ✘ | parcial | ✔︎ | **✔︎** |
| Datos para pagar listos | ✘ | ✔︎ (solo su banco) | ✘ | ✘ | **✔︎ (cualquier medio)** |
| Seguimiento "pagó / confirmó" | ✘ | parcial | ✔︎ | ✘ | **✔︎** |
| Netos entre cuentas y préstamos | ✘ | ✘ | ✔︎ | ✘ | **✔︎** |
| Gratis lo esencial | ✔︎ | ✔︎ | cada vez menos | variable | **✔︎** |

## 7. Métricas

- **North Star: cuentas saldadas por semana** (llegan a "¡Cuentas claras!"). Junta las dos
  cosas que importan: que se use en la mesa y que el ciclo de pago se cierre.
- **Entradas (las que movemos):**
  - % de cuentas divididas que se saldan en 7 días, y horas medianas hasta saldarse.
  - % de invitados que entran sin cuenta previa (alcance del link) y % de ellos que después
    crean su propia cuenta o préstamo (**el ciclo viral**).
  - % de avisos "Ya le pagué" confirmados (confianza) y % "No me llegó" (fricción).
  - Préstamos: aceptados vs. "no reconozco".
  - % de cuentas respaldadas con correo (riesgo de perder usuarios al cambiar de celular).
- **Salud:** errores `mm:*` por pantalla, tiempo de carga del link en 4G, desinstalaciones de
  la PWA.

Las consultas están en [`supabase/metrics.sql`](../supabase/metrics.sql) y los eventos de
pantalla en Vercel Analytics (rutas agrupadas, sin códigos ni montos).

## 8. Modelo de negocio (hipótesis, en orden)

1. **Gratis para las personas en lo esencial, siempre.** Dividir, cobrar y prestar no se
   cobran: es lo que trae a la gente y lo que la hace volver.
2. **MitiMiti para restaurantes (B2B).** QR en la mesa con la cuenta ya cargada desde el
   sistema del local (productos y precios reales): la mesa se divide sola y cada uno paga al
   local con su medio. El restaurante cobra más rápido, rota mesas antes y evita el "dividan
   en 5 tarjetas". Suscripción por local y/o por mesa activa.
3. **Pagos integrados con socios.** Links de pago con el monto exacto (Payphone, Deuna u otros
   proveedores con API): el invitado paga en un toque y el aviso se confirma solo. Comisión o
   acuerdo de referidos con el proveedor; MitiMiti sigue sin custodiar dinero.
4. **MitiMiti Plus (opcional, barato).** Grupos recurrentes y viajes, recordatorios
   automáticos, exportar historial, temas. Solo cuando el uso gratuito esté probado.

## 9. Hoja de ruta

**Próximos 3 meses — tracción en la mesa**
- Escanear la cuenta con la cámara (foto → productos y precios, con IA), para "por productos"
  en 10 segundos.
- Notificaciones push del sistema (Web Push) para "te pagaron" y recordatorios.
- Grupos recurrentes ("Los del fútbol") con saldos del grupo.
- Lanzamiento en universidades y oficinas de Quito y Guayaquil: el "pagador habitual" como
  embajador; stickers de QR en bares aliados.

**3–9 meses — retención y dinero**
- Viajes y gastos de varios días, varias monedas.
- Piloto B2B con 5–10 restaurantes (integración con su sistema de caja).
- Primer socio de pagos con links de monto exacto.

**Después**
- Otros países de la región con dólar o transferencias inmediatas (datos de cobro por país).
- App nativa solo si la PWA se queda corta (notificaciones en iOS, cámara).

## 10. Riesgos y cómo los cuidamos

| Riesgo | Cómo lo cuidamos |
|---|---|
| Desconfianza ("¿esto me cobra?") | No movemos dinero, lo decimos en la app; los datos de cobro solo los ve quien te debe. |
| Perder la cuenta al cambiar de celular | Respaldo con código al correo, ofrecido en el perfil y después de cobrar. |
| Adopción del invitado | Cero instalación, un dato, 20 segundos. Medimos el tiempo del link a "Entrar". |
| Abuso de recordatorios o links | Límite de un recordatorio cada 20 h; links de deuda atados a la primera persona; "No me debes nada" a un toque. |
| Correo de Supabase limitado | SMTP propio en producción (README). |
| Dependencia de Supabase | Todo el backend es SQL estándar de Postgres en un archivo; se puede mover. |

## 11. Cómo salimos al mercado

1. **El pagador habitual** es nuestro usuario cero: le resolvemos el cobro y él trae a cinco
   personas por cuenta.
2. **WhatsApp es el canal**: cada mensaje lleva el link y una frase que invita ("Entra con un
   toque, sin descargar nada").
3. **Lugares con mesas grandes**: universidades, oficinas, ligas de fútbol, bares de
   after-office. QR impreso en la mesa con alianzas.
4. **Contenido corto** sobre la escena de la cuenta ("el que nunca tiene suelto",
   "el que pidió agua") en TikTok/Instagram: el problema es universal y gracioso.
