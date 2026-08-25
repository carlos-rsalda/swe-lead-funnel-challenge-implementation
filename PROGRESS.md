# Plan de implementación

Orden **de dominio hacia afuera**: nada depende de algo que todavía no existe, y en cada paso el
proyecto compila. Las decisiones están en [MAP.md](MAP.md); aquí solo va el orden y el criterio de
terminado.

Dirección de dependencias (hexagonal): `errores → value objects → entidades → puerto → casos de uso →
adaptador → simulación`. El adaptador va después del caso de uso a propósito: implementa un puerto
que ya está cerrado, no al revés.

---

## Fase 1 — Dominio puro

### [x] 1. Errores nuevos (`src/domain/errors/`)

Cuatro archivos, misma convención que los cuatro existentes: extienden `Error`, fijan `this.name`,
sin clase base común.

- `InvalidPhoneNumberError`
- `InvalidLeadError`
- `InvalidFunnelError`
- `LeadNotFoundError`

**Por qué primero:** no dependen de nada y todo lo demás los necesita para poder rechazar.
**Terminado cuando:** compila y cada error se puede discriminar por `instanceof`.

---

### [x] 2. `PhoneNumber` (`src/domain/value-objects/PhoneNumber.ts`)

Acepta `+` + 8–15 dígitos ignorando separadores (espacios, guiones, paréntesis, puntos). Canoniza a
`+` + dígitos. Igualdad por string canónico. Rechaza con `InvalidPhoneNumberError`.

**Terminado cuando:**
- `+52 55 1234 5678`, `+52-55-1234-5678`, `+52 (55) 1234.5678` y `+525512345678` son todos iguales
- `5512345678` (sin `+`) se rechaza
- `+521 55 1234 5678` y `+52 55 1234 5678` son **distintos** — es el límite conocido, no un bug

---

### [x] 3. `Lead` (`src/domain/entities/Lead.ts`)

- `phone: PhoneNumber` (cambia de `string`), `readonly name: string`, `private _stageId` + getter.
- `name` vacío o solo espacios → `InvalidLeadError`.
- `isAt(stageId): boolean`: consulta pura, sin regla dentro.
- `moveTo(targetStageId)`: única vía de mutación; `destino === actual` → `InvalidStageTransitionError`
  con mensaje que nombre **origen y destino**.

**Terminado cuando:** `stageId` no se puede escribir desde fuera, `isAt` no lanza nunca, y `moveTo` al
mismo stage lanza.

---

### [x] 4. `Funnel` (`src/domain/entities/Funnel.ts`)

- Valida en el constructor → `InvalidFunnelError`: ≥1 etapa; ids no vacíos y únicos;
  `capacity` entera ≥ 0 si está presente.
- Comportamiento: primera etapa · buscar etapa por id · exponer el tope de una etapa.
- `Stage` sigue siendo interfaz estructural — `index.ts:16-21` la construye con literales.

**Terminado cuando:** `capacity: 0` se distingue de `undefined` en la API de la entidad, sin que
ningún consumidor pueda caer en la trampa de truthiness.

---

## Fase 2 — Puerto

### [x] 5. `LeadRepository` (`src/domain/repositories/LeadRepository.ts`)

`findByPhone(phone: PhoneNumber): Promise<Lead | null>`. `save` y `findByStage` sin cambios.

**Terminado cuando:** la firma refleja que la identidad es un VO del dominio, no un string.

---

## Fase 3 — Aplicación

### [x] 6. `AddLeadToFunnel`

```
PhoneNumber + name  →  duplicado  →  cupo en stages[0]  →  save
```

**Terminado cuando:** duplicado con primera etapa llena devuelve `DuplicateLeadError`, no el de cupo.

---

### [x] 7. `MoveLeadToStage`

```
PhoneNumber  →  etapa destino existe  →  lead existe  →  destino ≠ actual  →  cupo  →  moveTo + save
```

- `StageNotFoundError` **antes** que `LeadNotFoundError`.
- Usar `lead.isAt(targetStageId)` para fijar la precedencia del error; `moveTo()` conserva su guarda
  como invariante estructural. Un predicado, dos call sites con propósitos distintos.
- **Mutar solo después de que pasen todas las validaciones** — el repo guarda referencias vivas.

**Terminado cuando:** misma-etapa-llena devuelve `InvalidStageTransitionError` sin haber consultado
la ocupación.

---

## Fase 4 — Infraestructura

### [x] 8. `InMemoryLeadRepository`

`Map<string, Lead>` indexado por el string canónico del `PhoneNumber`. `save` es upsert.
`findByPhone` devuelve `null` cuando no hay. `findByStage` filtra por `stageId`.

**Terminado cuando:** implementa el puerto ya cerrado sin haber obligado a cambiarlo.

---

## Fase 5 — Simulación y verificación

### [x] 9. `index.ts`

Dar tope a la primera etapa para poder ejercitar la regla 3 en el alta. Cinco escenarios:
alta correcta · movimiento válido · duplicado rechazado · movimiento inválido rechazado ·
**alta rechazada por cupo**.

**Aviso — los escenarios interactúan por ocupación.** En cuanto `new` lleva tope, mover un lead fuera
de `new` **libera su hueco**, así que el escenario de "alta rechazada por cupo" depende de cuántos
movimientos hayan ocurrido antes. El orden de la simulación es parte del diseño del escenario, no un
detalle: hay que fijarlo al escribirla, no descubrirlo depurando por qué el rechazo esperado no ocurre.

**Terminado cuando:** `npm start` corre entero, imprime los cinco resultados, y el rechazo por cupo
ocurre por la ocupación que el escenario construye a propósito — no por casualidad del orden.

---

### [x] 10. Tests (`tests/`)

Por regla de negocio, más los cuatro del análisis:

- movimiento rechazado ⇒ el lead sigue en su etapa original *(aliasing)*
- `capacity: 0` ⇒ etapa cerrada, no ilimitada *(truthiness)*
- precedencia: misma-etapa-llena · duplicado-con-primera-etapa-llena · stage-inexistente-y-lead-inexistente
- identidad: mismo número en dos formatos ⇒ duplicado; sin `+` ⇒ rechazo

**Terminado cuando:** `npm test` pasa y cada test nombra la regla que protege.

---

## Fase 6 — Entregables

### [x] 11. `ANALYSIS.md`

§0 supuestos + precedencia + reparto de invariantes en dos capas + límite de normalización sin región
+ tiempo real. Q1 concurrencia (aliasing y check-then-act como evidencia). Q2 evento con `from`/`to`
sin editorializar. Q3 la colisión con "sin timestamps", dicha como límite deliberado. Q4 núcleo
permisivo como sustrato de la configurabilidad.

### [x] 12. `ai-session/`

Exportar la transcripción completa. Requisito explícito del README, no opcional.

### [x] 13. Bonus: handler HTTP simulado

Función pura JSON→JSON. El mapeo error→status sale directo de la precedencia:
validación de entrada y stage inexistente → 400 · lead no encontrado → 404 ·
duplicado y cupo → 409.

El único opcional de la lista, y por eso va al final: `ANALYSIS.md` y `ai-session/` son
entregables exigidos por el README.

---

## Puntos de control

Tres momentos donde parar y comprobar antes de seguir:

1. **Tras la fase 1** — el dominio compila y rechaza solo. Si aquí hace falta el repositorio para
   validar algo, la invariante está en la capa equivocada.
2. **Tras la fase 3** — la precedencia está implementada tal como quedó escrita, no como salió.
3. **Tras la fase 5** — el test de aliasing pasa. Si no, la mutación está ocurriendo antes de tiempo.
