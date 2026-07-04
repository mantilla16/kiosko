# 🐎 Sistema del Kiosco — Caballeriza

Sistema de gestión tipo **dashboard** para controlar inventario, compras, ventas, kardex, inventario físico y cartera (créditos) del kiosco.

- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL (con Prisma ORM + migraciones)
- **Frontend:** Dashboard web (HTML + CSS + JavaScript) que consume la API REST

---

## 📦 Módulos incluidos

| Módulo | Descripción |
|---|---|
| **Panel** | Indicadores clave: ventas de hoy, cartera por cobrar, productos por agotarse, valor del inventario. |
| **Productos** | Maestro de productos (código, categoría, costo, precio, stock mínimo/actual, estado). |
| **Categorías** | Crear y administrar categorías y subcategorías. |
| **Compras** | Registra entradas de mercancía → **aumenta el inventario automáticamente**. |
| **Ventas** | Ventas de contado o crédito → **descuenta el inventario automáticamente**. |
| **Control de Inventario** | Entradas, salidas y existencia en tiempo real. |
| **Inventario Físico** | Conteo general o por categoría, diferencias y ajustes aprobados. |
| **Kardex** | Historial completo de movimientos por producto con saldo. |
| **Créditos (Cartera)** | Ventas a crédito, abonos, saldos pendientes e historial por cliente. |
| **Reportes** | Inventario actual, productos por agotarse, utilidad y ventas por día. |

---

## 🚀 Opción A — Despliegue con Docker (recomendado para el servidor en la nube)

Levanta la app **y** PostgreSQL juntos en el mismo servidor con un solo comando:

```bash
# 1. Edita las contraseñas en docker-compose.yml
# 2. Construye y arranca
docker compose up -d --build
```

La aplicación queda disponible en `http://IP-DEL-SERVIDOR:3000`.
La base de datos PostgreSQL queda en el mismo servidor con su volumen persistente.

---

## 🛠️ Opción B — Instalación manual

### Requisitos
- Node.js 18 o superior
- PostgreSQL 14 o superior

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar la conexión a la base de datos
cp .env.example .env
#   → edita DATABASE_URL con tu usuario, contraseña y nombre de BD

# 3. Crear las tablas (migraciones)
npm run prisma:migrate

# 4. Cargar datos iniciales (categorías sugeridas + productos de ejemplo)
npm run db:seed

# 5. Arrancar el servidor
npm start          # producción
npm run dev        # desarrollo (recarga automática)
```

Abre el navegador en `http://localhost:3000`.

---

## 🗂️ Estructura del proyecto

```
sistemaCaballeriza/
├── prisma/
│   ├── schema.prisma        # Definición de tablas (modelo de datos)
│   └── seed.js              # Datos iniciales
├── src/
│   ├── server.js            # Arranque del servidor
│   ├── app.js               # Configuración de Express
│   ├── prisma.js            # Cliente de base de datos
│   ├── routes/              # Endpoints de la API REST
│   ├── services/            # Lógica de negocio (stock, kardex, cartera)
│   └── utils/               # Utilidades (errores, async handler)
├── public/                  # Frontend (dashboard)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js           # Enrutador
│       ├── api.js           # Cliente de la API
│       ├── utils.js         # Utilidades de UI
│       └── modules/         # Un archivo por módulo del dashboard
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 🔌 Endpoints principales de la API

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/products` | Maestro de productos |
| GET/POST/PUT/DELETE | `/api/categories` | Categorías y subcategorías |
| GET/POST | `/api/purchases` | Compras (suben stock) |
| GET/POST | `/api/sales` | Ventas (bajan stock) |
| GET | `/api/credits` | Cartera / cuentas por cobrar |
| POST | `/api/credits/:saleId/payments` | Registrar abono |
| GET | `/api/credits/customers/:id/history` | Historial por cliente |
| GET/POST | `/api/physical-inventory` | Inventario físico |
| POST | `/api/physical-inventory/:id/approve` | Aprobar y generar ajustes |
| GET | `/api/reports/dashboard` | Indicadores del panel |
| GET | `/api/reports/inventory` | Control de inventario |
| GET | `/api/reports/low-stock` | Productos por agotarse |
| GET | `/api/reports/profit` | Reporte de utilidad |
| GET | `/api/reports/sales-by-day` | Ventas por día |
| GET | `/api/reports/kardex/:productId` | Kardex de un producto |

---

## ✅ Reglas de negocio garantizadas

- Las **compras** aumentan el stock y dejan un movimiento de entrada en el kardex.
- Las **ventas** descuentan el stock (validando existencias) y dejan un movimiento de salida.
- Cada operación corre dentro de una **transacción**: o se aplica todo, o nada — el inventario nunca queda inconsistente.
- El **inventario físico** ajusta el stock al conteo real solo cuando se **aprueba**.
- Los **créditos** recalculan su estado (Pendiente / Parcial / Pagado) con cada abono.
```
