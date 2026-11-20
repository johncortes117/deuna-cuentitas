# MitiMiti · Diseño y escritura

## Personalidad

**El amigo ordenado de la mesa**: claro con los números, cálido con las personas, nunca
cobrador. La interfaz se siente como un recibo bien hecho: limpia, con los montos grandes y
nada que sobre.

## Marca

- **Nombre:** MitiMiti, "mitad y mitad". Fácil de decir en la mesa ("pásalo por MitiMiti").
- **Dirección visual:** *Limpio con pulso*. Lienzo muy limpio, números nítidos, botones en negro
  carbón y el **Verde Menta** como color firma.
- **Logo:** un círculo partido en dos mitades, tinta y menta (`public/favicon.svg`).
- **Lema:** *Divide cuentas, no amistades.* El título "¡Cuentas claras!" se usa solo para
  celebrar el cierre de una mesa.

## Color

Los tokens viven en [`src/index.css`](../src/index.css) (claro y oscuro) y se usan como clases
de Tailwind (`bg-surface`, `text-muted`, `text-owed`…).

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` / `surface` | `#F9F9F7` / `#FFFFFF` | `#0D100F` / `#161B19` | fondo hueso / tarjetas y hojas |
| `ink` / `muted` | `#121514` / `#646E6A` | `#F4F7F5` / `#94A09B` | texto principal / secundario |
| `cta` / `on-cta` | `#121514` / blanco | `#2EE5A8` / `#0D100F` | botón principal |
| `brand` | `#22D39A` | `#2EE5A8` | menta pulso: logo, botón `+`, puntos, acentos |
| `brand-soft` | `#E8FBF4` | `#112B22` | menta hielo: fondos positivos |
| `owed` | `#0B8F65` | `#2EE5A8` | "Te deben" en montos grandes |
| `positive` | `#087A56` | `#2EE5A8` | a favor / pagado, texto pequeño |
| `warning` / `pending` | `#9A5800` / `#E59A2B` | `#E59A2B` | pendiente: texto / punto decorativo |
| `forgiven` / `forgiven-strong` | `#5F50D6` / `#7C6FF7` | `#9B90FF` | perdonado: texto / sello |
| `danger` / `danger-strong` | `#C8323F` / `#E04F5F` | `#F07480` / `#E04F5F` | solo errores técnicos o descuadres |

Reglas:
- **Todo texto cumple WCAG AA (4,5:1)**, en claro y oscuro. Los tonos del manual que no llegan
  como texto pequeño (`#0B8F65`, `#E59A2B`, `#7C6FF7`, `#E04F5F`) van en montos grandes, sellos,
  fondos e íconos; para texto pequeño se usa la variante más oscura del mismo tono.
- **"Debes" nunca va en rojo:** usa el neutro fuerte (`ink`).
- **Verde solo cuando hay dinero a tu favor.** Un $0,00 se ve apagado, no verde.
- **Sobre la menta, íconos oscuros** (`on-brand`): blanco sobre menta no se lee.
- **Avatares:** 12 tonos bien distintos, todos con texto blanco legible. En una misma mesa (o
  lista) nadie repite color; quien no tiene la app va con borde punteado.

## Tipografía

- **Inter Variable** con eje óptico (`opsz`), solo el subconjunto latino precargado.
- **Números tabulares** (`tabular-nums`) en toda la app, así los montos no "bailan" al cambiar.
- Montos grandes en extra-bold con tracking negativo (`$48,30`); títulos de sección en
  versalitas pequeñas (`EN LA MESA · 4`).

## Componentes base (`src/ui`)

| Componente | Cuándo |
|---|---|
| `Button` (primary/secondary/soft/ghost/danger) | Una sola acción principal por pantalla; la secundaria, más quieta. |
| `BottomBar` | La acción principal fija abajo, al alcance del pulgar, con fondo sólido. |
| `Sheet` | Decisiones y formularios cortos desde abajo (no modales al centro). Se cierran con Esc, tocando fuera o deslizando; no se cierran mientras guardan. |
| `Keypad` + `AmountInput` | Montos: teclas grandes siempre en el mismo lugar (también acepta el teclado físico). |
| `Toast` | Respuesta a cada acción y avisos en vivo; como mucho dos a la vez. |
| `StatusPill` | Estados de pago: Pendiente · Dice que te pagó · Pagó ✓ · Perdonado. |
| `Segmented` | Elegir entre 2–3 opciones (cómo dividir, tipo de cuenta, tema). |
| `CopyButton` | Copiar datos de pago con confirmación visible ("Copiado"). |

## Patrones de interacción

- **Lo normal en un toque:** "Crear cuenta" solo pide el total (el nombre ya viene sugerido
  por la hora); "Dividir entre 3 · $15,03 c/u" dice exactamente qué va a pasar.
- **Optimista y en vivo:** marcar un producto se ve al instante y se corrige si falla; los
  cambios de los demás llegan solos.
- **Nada bloquea el ritmo:** al anotar productos, el siguiente se escribe mientras el anterior
  se guarda.
- **Confirmar lo que no se deshace** (cancelar una cuenta, perdonar, marcar pagado) con una
  hoja que dice la consecuencia.
- **Errores que dicen qué hacer**, nunca códigos: "Alguien cambió algo justo ahora. Revisa y
  vuelve a intentar."
- **Sin conexión:** aviso arriba y reintentos automáticos al volver.
- **Pantallas bajitas:** en teléfonos de 568–720 px de alto el teclado y el botón siempre
  caben sin scroll (variantes `short:` y `tiny:` en `index.css`).

## Escritura

- Español con **tuteo**, frases cortas, verbos concretos.
- **Dinero:** `$12,50` (coma decimal), nunca "12.5 USD". Comparaciones en palabras.
- **Sin jerga financiera.** En vez de *deudor, acreedor, liquidar, saldo pendiente*:
  *te debe, le debes, ya te pagó, están a mano*.
- **Los botones dicen lo que pasa:** "Sí, avisarle a Ana", "Anotar y enviar por WhatsApp",
  "Sí, ya me pagó".
- **Amigo cómplice, nunca cobrador.** Directo, cálido y con humor ligero: "Hola Luis, soy
  MitiMiti 👀 Paso a recordarte los $12,00 de «Cena» que cubrió Ana…". Cada mensaje lleva el
  link de vuelta a la app. Las plantillas viven en `src/lib/templates.ts`.
- **Medios de pago en frase:** "pagaste por transferencia", "en efectivo", "por Deuna".

## Accesibilidad

- Contraste AA en claro y oscuro; áreas táctiles de al menos 44 px.
- Roles correctos: `radiogroup`/`radio` en selectores, `checkbox` al marcar productos y
  personas, `dialog` con foco atrapado en las hojas, `status`/`aria-live` en montos y avisos.
- `prefers-reduced-motion`: sin confeti ni animaciones.
- Funciona desde 320 px de ancho; en computador, la app se muestra como una columna de
  teléfono centrada.
