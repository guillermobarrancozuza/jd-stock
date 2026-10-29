# JD Control de Stock — Sistema de Gestión Integral de Inventario AV y Contratos

Sistema integral profesional full-stack para el control exhaustivo de inventario audiovisual, preparación de eventos, expedición de albaranes y contratos, pasarela de pago para reservas (10%), control de almacén, partes de averías SAT y auditoría inmutable de movimientos.

---

## 🔐 Control de Acceso y Jerarquía de Roles

### 👑 Administrador Jefe (Control Total)
- **Credenciales Maestras de Acceso Directo:**
  - **Usuario:** `admin`
  - **Contraseña:** `JDAdmin2026*`
- **Capacidades exclusivas:**
  - **Gestión de Personal & Roles:** Solo el Administrador Jefe puede asignar y revocar roles en el sistema.
  - **Contratos y Facturación:** Creación, edición, descarga de contratos con cálculo del 10% de fianza y pasarela de pago bancaria/Bizum.
  - **Edición de Beneficiario y Cuentas:** Modificación en vivo de datos de facturación (Nombre de beneficiario, IBAN, BIC, Concepto).
  - Acceso total a finanzas, compras, altas, bajas y configuración.

### 👥 Registro de Personal vía Google y Flujo de Aprobación
1. Cualquier miembro del equipo (técnicos, encargados de almacén) puede iniciar sesión con su **cuenta de Google**.
2. **Estado Inicial Seguro (`Pendiente`):** Al registrarse por primera vez, el usuario queda en estado pendiente de aprobación y no puede ver ni modificar datos del almacén.
3. **Aprobación del Admin Jefe:** El Administrador Jefe accede a la pestaña **Personal & Roles Google** y con un solo clic asigna el rol correspondiente:
   - 📦 **Encargado de Almacén:** Gestión de stock, salidas, devoluciones, traslados, inventarios físicos y albaranes. Oculto: contratos, finanzas y presupuestos.
   - 🛠️ **Técnico:** Preparación de pedidos, asignación de números de serie, partes de avería SAT y devoluciones. Oculto: contratos, finanzas y presupuestos.

---

## 💳 Pasarela de Pago y 10% de Fianza Editable

- **Cálculo automático:** En la creación de contratos o eventos, el sistema calcula de forma instantánea el **10%** del total del servicio en concepto de fianza/reserva previa.
- **Beneficiario y Cuentas Editables en Vivo:**
  - En la pasarela de pago (y en el modal de nuevo contrato), el campo **BENEFICIARIO** (por defecto `JD Control de Stock S.L.`), **IBAN**, **BIC** y **Teléfono Bizum** son totalmente editables.
  - Al editar el beneficiario o la cuenta, el código QR SEPA bancario oficial se regenera en tiempo real para escaneo directo con la app del banco del cliente.
  - Botones de 1 clic para compartir por **WhatsApp** o **Correo Electrónico** con texto comercial formateado y desglose de fianza.

---

## 📦 Conectar con GitHub y Despliegue Automático Continuo (CI/CD)

Para sincronizar este proyecto con tu propio repositorio de GitHub y que cualquier cambio se publique de forma automática:

### 1. Inicializar el Repositorio Local
```bash
git init -b main
git add .
git commit -m "feat: JD Control de Stock inicial con control estricto de roles y pasarela editable"
```

### 2. Vincular con tu Repositorio en GitHub
1. Crea un nuevo repositorio en tu cuenta de GitHub (por ejemplo: `jd-control-de-stock`).
2. Copia la URL del repositorio y ejecuta en tu terminal:
```bash
git remote add origin https://github.com/<TU_USUARIO_GITHUB>/jd-control-de-stock.git
git branch -M main
git push -u origin main
```

### 3. Sincronización Automática con cada Cambio
Cada vez que realices una mejora o cambio en el código:
```bash
git add .
git commit -m "Descripción del cambio"
git push
```

### 4. Automatización con GitHub Actions y Hosting (Vercel / Netlify / Render)
- Este proyecto ya incluye el flujo de trabajo en `.github/workflows/ci.yml`.
- En cada `git push` a la rama `main`, GitHub verifica automáticamente los tipos TypeScript y compila el proyecto sin errores.
- Si conectas el repositorio de GitHub con **Vercel** o **Netlify**:
  1. Inicia sesión en [Vercel](https://vercel.com) o [Netlify](https://netlify.com) con tu cuenta de GitHub.
  2. Haz clic en **"Import Project"** y selecciona `jd-control-de-stock`.
  3. Los ajustes de Vite se detectan automáticamente (`npm run build`, carpeta `dist`).
  4. ¡Listo! A partir de ese momento, cada vez que hagas `git push`, tu web se actualizará en vivo en pocos segundos.

---

## 🛠️ Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en local
npm run dev

# Verificación de sintaxis y tipos
npm run lint

# Compilar para producción
npm run build
```

---

## 🗄️ Tecnologías Utilizadas

- **Frontend:** React 19, TypeScript, Vite.
- **Estilos:** Tailwind CSS v4 (modo industrial oscuro).
- **Iconos:** Lucide React.
- **Gráficas:** Recharts.
- **Códigos QR:** QRCode SEPA bancario estándar europeo.
- **Base de Datos & Auth:** Firebase Firestore y Google Workspace Auth.
- **CI/CD:** GitHub Actions.
