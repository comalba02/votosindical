# 🗳️ VotoSindical - Sistema de Elecciones Electrónicas

**VotoSindical** es una solución profesional, segura y moderna diseñada para la gestión integral de procesos electorales en organizaciones y sindicatos. El sistema garantiza la transparencia, el anonimato del voto y la eficiencia en la entrega de resultados en tiempo real.

<img width="1075" height="596" alt="Image" src="https://github.com/user-attachments/assets/ebf0d2e6-4fb8-4768-b74b-731bfc843241" />
---

## 🚀 Características Principales

- **Gestión Multi-Plancha:** Creación y administración de planchas electorales con perfiles detallados de candidatos.
- **Censo Electoral Digital:** Importación masiva de electores vía Excel y generación automática de tokens únicos (UUID).
- **Notificación Inteligente:** Envío de códigos de votación mediante correo electrónico integrado (SMTP).
- **Urna Electrónica Blindada:** Registro de votos anónimos mediante transacciones SQL atómicas.
- **Dashboard de Administración:** Panel premium para monitoreo en vivo, gestión de candidatos y descarga de reportes PDF.
- **Documentación Integrada:** Generación automática de manuales técnicos, diccionarios de datos y guías de API en PDF.

<img width="1070" height="482" alt="image" src="https://github.com/user-attachments/assets/ef1b80bd-ddd8-4cea-901c-70469271e033" />
---

## 🛠️ Requisitos del Sistema

- **Node.js:** Versión 18 o superior.
- **NPM:** Gestor de paquetes incluido en Node.js.
- **Base de Datos:** SQLite (No requiere servidor de base de datos externo).
- **Navegador:** Compatible con estándares modernos (Chrome, Firefox, Edge, Safari).

<img width="466" height="356" alt="image" src="https://github.com/user-attachments/assets/247241dd-2469-4731-8a11-3ec07b18bd47" />

---

## 📦 Instalación y Despliegue

### 1. Preparación del Entorno
Clona el repositorio y configura las variables de entorno en el archivo `.env` de la raíz:

```env
BACKEND_PORT=3000
FRONTEND_PORT=5173
JWT_SECRET=tu_secreto_aleatorio_aqui
FRONTEND_URL=http://localhost:${FRONTEND_PORT}
VITE_API_URL=http://localhost:${BACKEND_PORT}
```

### 2. Instalación de Dependencias
Ejecuta el siguiente comando en la raíz para instalar todos los módulos necesarios (Raíz, Backend y Frontend):

```bash
npm run install:all
```
<img width="557" height="203" alt="image" src="https://github.com/user-attachments/assets/1624f580-1c7d-4483-9a1c-1b89cf5d5e09" />

### 3. Ejecución en Desarrollo
Para iniciar ambos servidores simultáneamente:

```bash
npm run dev
```
<img width="503" height="140" alt="image" src="https://github.com/user-attachments/assets/68bf4a6c-6ceb-4d15-97e9-06cee82cd0e8" />
---

## 🔐 Credenciales por Defecto

Al iniciar el sistema por primera vez, utiliza los siguientes datos para acceder al panel administrativo:

- **URL:** `http://localhost:5173/admin`
- **Usuario:** `admin`
- **Contraseña:** `admin123`

> [!IMPORTANT]
> Se recomienda cambiar la contraseña inmediatamente desde la pestaña de **Ajustes > Seguridad** una vez dentro del sistema.

<img width="706" height="295" alt="image" src="https://github.com/user-attachments/assets/b8487106-3bd4-4f17-8582-c9746eaf4f80" />
---

## 📈 Flujo de Trabajo Operativo

### 1. Configuración de la Elección
Desde la pestaña **Ajustes**, define el nombre del sindicato, la fecha de la elección y sube el logotipo institucional. Configura el servidor SMTP para habilitar el envío automático de tokens.

<img width="713" height="456" alt="image" src="https://github.com/user-attachments/assets/6fb76fad-aee9-4d16-8ef7-1886842625b6" />


### 2. Creación de Planchas y Candidatos
- En la sección **Planchas**, crea las opciones electorales.
- Dentro de cada plancha, registra a los integrantes (Candidatos) especificando su nombre y el cargo al que aspiran.

<img width="1021" height="348" alt="image" src="https://github.com/user-attachments/assets/e8d91a91-3a86-42f0-8709-0356735541c9" />

### 3. Gestión del Censo y Tokens
- Sube el listado de electores mediante la plantilla Excel proporcionada en el panel.
- El sistema generará un Token secreto para cada persona.
- Utiliza la función "Enviar Tokens por Email" para notificar a los votantes de forma masiva.

<img width="1031" height="328" alt="image" src="https://github.com/user-attachments/assets/f255f74c-ccd8-4370-9ca1-09acb28a61a9" />

### 4. Proceso de Votación
- El elector ingresa a la página principal con su Token.
- Selecciona su opción preferida y confirma su voto secreto.
- Una vez emitido, el Token queda invalidado permanentemente.

### 5. Resultados y Auditoría
- El administrador puede ver el conteo de votos en tiempo real.
- Al finalizar, se puede generar un **Reporte Oficial en PDF** con los resultados finales y el listado de participación.

<img width="1047" height="597" alt="image" src="https://github.com/user-attachments/assets/61fd13aa-8f60-4a3f-9123-0f46f99ec6da" />
---

## 🛡️ Seguridad y Anonimato del Voto

El sistema ha sido diseñado bajo principios de integridad y privacidad:

1. **Anonimato Total:** La base de datos registra que un elector *ya participó* para evitar la duplicidad, pero el registro del voto en la "Urna" no contiene ninguna referencia al elector. No existe trazabilidad técnica que vincule la identidad con la elección realizada.
2. **Atomicidad:** El uso de transacciones SQL garantiza que el registro del voto y la invalidación del token ocurran simultáneamente; si uno falla, el otro no se realiza, evitando errores en el conteo.
3. **Cifrado:** Las sesiones administrativas están protegidas mediante JWT (JSON Web Tokens) y las contraseñas se almacenan cifradas con algoritmos de hash de alta seguridad.
4. **Integridad de Datos:** Los tokens UUID de 36 caracteres hacen que sea estadísticamente imposible adivinar un código de acceso válido.

---

# Contacto

Si esta interesado en contactarme puede realizarlo mediante mis redes sociales

[Linkedin](https://www.linkedin.com/in/macoronadob)

[Facebook](https://www.facebook.com/marcoalberto.coronadobaquero)

