# Plataforma Familiar de Mensajería Segura (E2EE)

Plataforma de comunicaciones privadas diseñada específicamente para familias, con **cifrado de extremo a extremo (E2EE)** de grado militar, **sin necesidad de número de teléfono**, y con **gobernanza de seguridad y privacidad adaptativa por edades**.

---

## 🌟 Características Principales

1. **Cero Teléfonos (Identidad Criptográfica Pura):**
   - No requiere número telefónico ni expone datos personales.
   - Cada usuario genera su propio par de claves criptográficas (`RSA-OAEP 2048` + `AES-256-GCM`) directamente en el navegador mediante **WebCrypto API**.

2. **Cero Conocimiento (Blind Relay):**
   - El servidor de transporte **nunca** tiene acceso al contenido de los textos, fotos o notas de voz. Solo retransmite paquetes binarios cifrados.

3. **Gobernanza y Protección para Menores:**
   - **Modo Fantasma (Zero-Discovery):** Las cuentas de menores son invisibles en las búsquedas. Ningún desconocido puede enviarles mensajes ni solicitudes.
   - **Conexión Exclusiva por Invitación:** Solo pueden conectarse con familiares autorizados mediante códigos efímeros firmados por el guardián.
   - **Inmutabilidad de Mensajes:** Los menores no pueden borrar mensajes sin el PIN o autorización del guardián.

4. **Privacidad Progresiva por Edad:**
   - **Niños (< 10 años):** Cifrado multicapa con **Vista Espejo**. El padre/tutor recibe una copia descifrada en tiempo real en su panel de auditoría.
   - **Adolescentes (10 - 17 años):** **Cifrado 1-a-1 estricto**. No hay vista espejo (respetando su intimidad y confianza), pero se mantiene la muralla contra desconocidos y el candado de borrado.
   - **Adultos / Guardianes:** Panel completo de administración, generador de invitaciones para familiares (abuelos, tíos) y consola de auditoría para los más pequeños.

5. **Triple Interfaz Adaptativa (Adaptive UI):**
   - **Kids Mode:** Botones grandes, colores cálidos y amigables, enfoque táctil para notas de voz y fotos.
   - **Teens Mode:** Estética contemporánea oscura/cyberpunk, soporte para notas de voz rápidas y confirmación de canal cifrado.
   - **Adults Mode:** Minimalismo sofisticado tipo Apple/Linear, con pestaña de auditoría y gestión de familiares.

---

## 🚀 Inicio Rápido (Cómo Ejecutar)

Abre una terminal (PowerShell o CMD) en la carpeta del proyecto y ejecuta:

```bash
cd C:\Users\huttm\Desktop\family-chat
npm run dev
```

Esto iniciará simultáneamente:
* **Servidor Relay & Almacenamiento Cifrado:** `http://localhost:3001` (WebSocket en `ws://localhost:3001`)
* **Cliente Web / PWA:** `http://localhost:5173`

---

## 🧪 Cómo Probar los 3 Perfiles en tu Navegador

Puedes abrir dos o tres pestañas (o ventanas de incógnito) para simular la conversación familiar:

1. **Pestaña 1 (Papá / Guardián):**
   * Elige *"Crear Cuenta"*, usuario `papa`, rol *Adulto / Papá*.
   * Entrarás al **Panel Guardián**.

2. **Pestaña 2 (Hija < 10 años):**
   * Elige *"Crear Cuenta"*, usuario `sofia`, rol *Niño (<10)*, edad `7`, y pon `papa` como guardián.
   * Notarás que la interfaz cambia automáticamente al **Modo Kids** con botones gigantes y colores suaves.
   * Conéctate con `papa` y mándale una nota de voz o foto.
   * En la **Pestaña 1 (Papá)**, revisa la pestaña *"Modo Espejo (<10)"* y verás cómo el padre puede auditar el mensaje descifrado en tiempo real.

3. **Pestaña 3 (Abuelita o Familiar):**
   * Desde la cuenta de `papa`, haz clic en *"Invitar a la Abuelita o Familiar"*, selecciona que conectará con `sofia` y copia el código generado.
   * En una nueva pestaña, crea la cuenta de `abuelita`.
   * Pega el código de invitación en *"Tengo un Código"*.
   * ¡Listo! El canal entre `sofia` y `abuelita` queda establecido sin que nadie más pueda intervenir.

---

## 🔒 Estructura Técnica

```
family-chat/
├── package.json           # Workspace raíz con script concurrente
├── server/                # Backend Node.js / TypeScript
│   ├── src/
│   │   ├── index.ts       # API Express + Servidor WebSocket Blind Relay
│   │   ├── db.ts          # Base de datos persistente JSON (Zero-native headaches)
│   │   └── types.ts       # Esquemas de tipos y mensajes cifrados
│   └── data/              # Directorio de blobs cifrados y estado
└── client/                # Frontend React 18 + Vite + Tailwind CSS
    └── src/
        ├── crypto/        # Motor criptográfico WebCrypto nativo (AES-GCM + RSA)
        ├── components/
        │   ├── KidsView.tsx         # UX lúdica y táctil para <10 años
        │   ├── TeensView.tsx        # UX oscura/cyber para 10-17 años
        │   ├── AdultsView.tsx       # UX refinada + Modo Espejo para Padres
        │   ├── AudioRecorder.tsx    # Grabador y reproductor de notas de voz
        │   ├── PhotoSender.tsx      # Compresión y envío de imágenes cifradas
        │   ├── InviteModal.tsx      # Generador/validador de códigos de invitación
        │   └── ParentPinModal.tsx   # Candado de PIN de guardián (PIN: 1234)
        └── App.tsx                  # Enrutador inteligente de experiencias por edad
```
