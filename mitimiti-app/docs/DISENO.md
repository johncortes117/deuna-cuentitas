# MitiMiti · Diseño y escritura

## Personalidad

**El amigo ordenado de la mesa**: claro con los números, cálido con las personas, nunca
cobrador. La interfaz se siente como un recibo bien hecho: limpia, con los montos grandes y
nada que sobre.

## Marca

- **Nombre:** MitiMiti, "mitad y mitad". Fácil de decir en la mesa ("pásalo por MitiMiti").
- **Logo:** un círculo partido en dos mitades, tinta y coral (`public/favicon.svg`).
- **Frase:** *Cuentas claras, amistades largas.*

## Color

Los tokens viven en [`src/index.css`](../src/index.css) (claro y oscuro) y se usan como clases
de Tailwind (`bg-surface`, `text-muted`, `text-positive`…).

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `bg` | `#FBF8F3` | `#131218` | fondo (papel cálido) |
| `surface` / `surface-2` | `#FFFFFF` / `#F3EEE6` | `#1C1B23` / `#24222C` | tarjetas / chips y fondos suaves |
| `ink` | `#17151F` | claro | texto principal y **botón principal** |
| `muted` / `subtle` | `#6B6574` / `#76707D` | `#A7A1AF` / `#8F8998` | texto secundario / terciario |
| `brand` | `#FF5A3C` (coral) | — | acentos, logo, puntos de estado |
| `brand-ink` | `#C93A1F` | — | enlaces y texto coral (legible) |
| `positive` | `#0E7A45` | verde claro | "te deben", pagado |
| `warning` | `#9A5200` | ámbar claro | "por confirmar", falta algo |
| `danger` | `#B4232B` | rojo claro | cancelar, errores |

Reglas:
- **Todo texto cumple WCAG AA (4,5:1)**, incluido el terciario. Blanco sobre coral no lo cumple,
  por eso el botón principal es tinta y el coral queda para acentos.
- **Verde solo cuando hay dinero a tu favor.** Un $0,00 se ve apagado, no verde.
- **Avatares:** 12 tonos bien distintos, todos con texto blanco legible. En una misma mesa (o
  lista) nadie repite color; quien no tiene la app va con borde punteado.

## Tipografía

- **Inter Variable** con eje óptico (`opsz`), solo el subconjunto latino precargado.
- **Números tabulares** en todos los montos (`tabular`) para que no "bailen" al cambiar.
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
- **Nunca tono de cobro.** Mensajes que se comparten: "¡Hola Luis! 👋 Te recuerdo los $12 de
  «Cena». Aquí ves cómo pagarme en un minuto". Cada uno lleva el link de vuelta a la app.
- **Medios de pago en frase:** "pagaste por transferencia", "en efectivo", "por Deuna".

## Accesibilidad

- Contraste AA en claro y oscuro; áreas táctiles de al menos 44 px.
- Roles correctos: `radiogroup`/`radio` en selectores, `checkbox` al marcar productos y
  personas, `dialog` con foco atrapado en las hojas, `status`/`aria-live` en montos y avisos.
- `prefers-reduced-motion`: sin confeti ni animaciones.
- Funciona desde 320 px de ancho; en computador, la app se muestra como una columna de
  teléfono centrada.
