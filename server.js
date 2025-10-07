// server.js
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import multer from 'multer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto';

// Configuración de entorno
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a la base de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'creperia_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Middleware para verificar autenticación y rol de administrador
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    
    // Verificar si es administrador
    if (payload.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: se requiere rol de administrador' });
    }

    req.user = payload;
    next();
  } catch (error) {
    console.error('Error en verificación de admin:', error);
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
async function initializeDatabase(connection) {
  try {
    // Primero verificar/crear tablas básicas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        role ENUM('customer','admin') DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255),
        active TINYINT(1) DEFAULT 1
      )
    `);

    // ... resto de CREATE TABLE básicos

    // Luego ejecutar las modificaciones administrativas
    await ensureAdministrativeSchema(connection);
    
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    throw error;
  }
}

// Garantizar que la base de datos cuente con las tablas necesarias para la reportería
async function ensureAdministrativeSchema(connection) {
  const ensureColumn = async (table, column, definition) => {
    try {
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
      if (columns.length === 0) {
        // Asegurarnos de que la definición incluya el nombre de la columna
        const fullDefinition = `${column} ${definition}`;
        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`🛠️ Columna "${column}" agregada a "${table}" para compatibilidad administrativa`);
      }
    } catch (error) {
      console.error(`❌ Error agregando columna ${column} a ${table}:`, error.message);
    }
  };

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        concept VARCHAR(255) NOT NULL,
        category VARCHAR(120) DEFAULT 'General',
        amount DECIMAL(12,2) NOT NULL,
        incurred_at DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_expenses_incurred_at (incurred_at),
        INDEX idx_expenses_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Asegurar columnas opcionales utilizadas por la aplicación
    await ensureColumn('users', 'address', 'VARCHAR(255) NULL');
    await ensureColumn('orders', 'customer_name', 'VARCHAR(120) NULL');
    await ensureColumn('orders', 'customer_email', 'VARCHAR(150) NULL');
    await ensureColumn('orders', 'customer_phone', 'VARCHAR(40) NULL');
    await ensureColumn('orders', 'customer_address', 'VARCHAR(255) NULL');
    await ensureColumn('order_items', 'product_name', 'VARCHAR(150) NULL');
    
  } catch (error) {
    console.error('❌ Error en ensureAdministrativeSchema:', error.message);
  }
}


// Verificar conexión a la base de datos al iniciar
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado a la base de datos MySQL');

        await ensureAdministrativeSchema(connection);


    
    // Verificar si las tablas necesarias existen
    const [productsTable] = await connection.query("SHOW TABLES LIKE 'products'");
    const [categoriesTable] = await connection.query("SHOW TABLES LIKE 'categories'");
    const [usersTable] = await connection.query("SHOW TABLES LIKE 'users'");
    const [expensesTable] = await connection.query("SHOW TABLES LIKE 'expenses'");

    if (productsTable.length === 0) {
      console.warn('⚠️ La tabla "products" no existe en la base de datos');
    } else {
      console.log('✅ Tabla "products" encontrada');
    }
    
   

    if (categoriesTable.length === 0) {
      console.warn('⚠️ La tabla "categories" no existe en la base de datos');
    } else {
      console.log('✅ Tabla "categories" encontrada');
    }
    
    if (usersTable.length === 0) {
      console.warn('⚠️ La tabla "users" no existe en la base de datos');
    } else {
      console.log('✅ Tabla "users" encontrada');
    }
     if (expensesTable.length === 0) {
      console.warn('⚠️ La tabla "expenses" no existe en la base de datos');
    } else {
      console.log('✅ Tabla "expenses" encontrada (reportería)');
    }
    connection.release();
  } catch (error) {
    console.error('❌ Error de conexión a la base de datos:', error.message);
    console.log('💡 Asegúrate de que:');
    console.log('1. MySQL esté ejecutándose');
    console.log('2. La base de datos "creperia_db" exista');
    console.log('3. Las credenciales en el archivo .env sean correctas');
    process.exit(1);
  }
}

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Directorio de uploads creado');
}

// Configuración de multer para carga de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\W+/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${name}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

// Healthcheck endpoint
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ 
      ok: true, 
      db: rows[0].ok === 1,
      message: 'Servidor y base de datos funcionando correctamente'
    });
  } catch (e) {
    res.status(500).json({ 
      ok: false, 
      error: e.message,
      message: 'Error de conexión a la base de datos'
    });
  }
});

// --- Endpoints de Productos ---
app.get('/api/products', async (req, res) => {
  try {
    const { q, category_id } = req.query;
    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.active = 1
    `;
    const params = [];
    
    if (category_id) { 
      sql += ' AND p.category_id = ?'; 
      params.push(category_id); 
    }
    
    if (q) { 
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; 
      params.push(`%${q}%`, `%${q}%`); 
    }
    
    sql += ' ORDER BY p.created_at DESC';
    const [rows] = await pool.query(sql, params);
    
    // Formatear precios como números
    const products = rows.map(product => ({
      ...product,
      price: Number(product.price)
    }));
    
    res.json(products);
  } catch (e) {
    console.error('Error en /api/products:', e);
    res.status(500).json({ 
      error: e.message,
      message: 'Error al obtener los productos' 
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `, [req.params.id]);
    
    if (!rows.length) {
      return res.status(404).json({ 
        error: 'Producto no encontrado',
        message: 'El producto solicitado no existe' 
      });
    }
    
    // Formatear precios como números
    const product = {
      ...rows[0],
      price: Number(rows[0].price)
    };
    
    res.json(product);
  } catch (e) {
    console.error('Error en /api/products/:id:', e);
    res.status(500).json({ 
      error: e.message,
      message: 'Error al obtener el producto' 
    });
  }
});

// Endpoint para obtener categorías
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE active = 1 ORDER BY name');
    res.json(rows);
  } catch (e) {
    console.error('Error en /api/categories:', e);
    res.status(500).json({ 
      error: e.message,
      message: 'Error al obtener las categorías' 
    });
  }
});

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(uploadsDir));

// Crear nuevo producto
app.post('/api/products', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category_id, stock } = req.body;
    
    // Validaciones básicas
    if (!name || !price) {
      return res.status(400).json({ 
        error: 'Datos incompletos',
        message: 'El nombre y precio son obligatorios' 
      });
    }
    
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    
    const [result] = await pool.query(
      `INSERT INTO products (category_id, name, description, price, image_url, stock, active) 
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        category_id || null, 
        name, 
        description || null, 
        price, 
        image_url, 
        stock || 0
      ]
    );
    
    const [rows] = await pool.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `, [result.insertId]);
    
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Error en POST /api/products:', e);
    
    // Eliminar archivo subido si hubo error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error eliminando archivo:', err);
      });
    }
    
    res.status(500).json({ 
      error: e.message,
      message: 'Error al crear el producto' 
    });
  }
});

// Actualizar producto
app.put('/api/products/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, description, price, category_id, stock, active } = req.body;
    
    // Verificar si el producto existe
    const [existingProduct] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
    if (!existingProduct.length) {
      return res.status(404).json({ 
        error: 'Producto no encontrado',
        message: 'El producto que intentas actualizar no existe' 
      });
    }
    
    let image_url = existingProduct[0].image_url;
    
    // Si se sube una nueva imagen, eliminar la anterior
    if (req.file) {
      // Eliminar imagen anterior si existe
      if (existingProduct[0].image_url) {
        const oldImagePath = path.join(__dirname, 'public', existingProduct[0].image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      image_url = `/uploads/${req.file.filename}`;
    }
    
    const [result] = await pool.query(
      `UPDATE products 
       SET category_id = ?, name = ?, description = ?, price = ?, 
           image_url = ?, stock = ?, active = ?
       WHERE id = ?`,
      [
        category_id || null, 
        name, 
        description || null, 
        price, 
        image_url, 
        stock || 0,
        active !== undefined ? active : 1,
        productId
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Producto no encontrado',
        message: 'No se pudo actualizar el producto' 
      });
    }
    
    const [rows] = await pool.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `, [productId]);
    
    res.json(rows[0]);
  } catch (e) {
    console.error('Error en PUT /api/products/:id:', e);
    
    // Eliminar archivo subido si hubo error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error eliminando archivo:', err);
      });
    }
    
    res.status(500).json({ 
      error: e.message,
      message: 'Error al actualizar el producto' 
    });
  }
});

// Eliminar producto (borrado lógico)
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    
    const [result] = await pool.query(
      'UPDATE products SET active = 0 WHERE id = ?',
      [productId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Producto no encontrado',
        message: 'El producto que intentas eliminar no existe' 
      });
    }
    
    res.json({ 
      message: 'Producto eliminado correctamente',
      productId 
    });
  } catch (e) {
    console.error('Error en DELETE /api/products/:id:', e);
    res.status(500).json({ 
      error: e.message,
      message: 'Error al eliminar el producto' 
    });
  }
});

// --- Carrito en memoria (para demostración) ---
const carts = new Map();

function getSessionId(req) {
  // Intentar obtener sessionId de header o cookie, o usar IP como fallback
  return req.headers['x-session-id'] || req.cookies?.sessionId || req.ip;
}

// Normalizar un identificador de producto que puede venir como número o string
function normalizeProductId(id) {
  if (typeof id === 'number') return id;
  if (typeof id === 'string') {
    const match = id.match(/\d+/);
    if (match) {
      return Number(match[0]);
    }
  }
  return NaN;
}

app.get('/api/cart', (req, res) => {
  const sid = getSessionId(req);
  res.json(carts.get(sid) || { items: [], total: 0 });
});

app.post('/api/cart/items', async (req, res) => {
  try {
    const sid = getSessionId(req);
    const { product_id, quantity = 1 } = req.body;
    const parsedId = normalizeProductId(product_id);

    if (!product_id || !Number.isInteger(parsedId)) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'El product_id es requerido y debe ser numérico'
      });
    }

    // Verificar que el producto existe
    const [rows] = await pool.query(
      'SELECT id, name, price, image_url, stock FROM products WHERE id = ? AND active = 1',
      [parsedId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ 
        error: 'Producto no encontrado',
        message: 'El producto solicitado no existe' 
      });
    }
    
    const product = rows[0];
    
    // Verificar stock
    if (product.stock < quantity) {
      return res.status(400).json({ 
        error: 'Stock insuficiente',
        message: `Solo quedan ${product.stock} unidades en stock` 
      });
    }
    
    const cart = carts.get(sid) || { items: [] };
    const existingItemIndex = cart.items.findIndex(i => i.product_id == parsedId);
    
    if (existingItemIndex >= 0) {
      // Actualizar cantidad si el producto ya está en el carrito
      cart.items[existingItemIndex].quantity += Number(quantity);
    } else {
      // Agregar nuevo item al carrito
      cart.items.push({
        product_id: parsedId,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        quantity: Number(quantity)
      });
    }
    
    // Calcular total
    cart.total = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    carts.set(sid, cart);
    res.status(201).json(cart);
  } catch (e) {
    console.error('Error en POST /api/cart/items:', e);
    res.status(500).json({ 
      error: e.message,
      message: 'Error al agregar item al carrito' 
    });
  }
});

app.patch('/api/cart/items/:product_id', (req, res) => {
  try {
    const sid = getSessionId(req);
    const { quantity } = req.body;
    const parsedId = normalizeProductId(req.params.product_id);

    if (quantity == null || quantity < 0) {
      return res.status(400).json({
        error: 'Cantidad inválida',
        message: 'La cantidad debe ser un número positivo'
      });
    }

    if (!Number.isInteger(parsedId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'El product_id debe ser numérico'
      });
    }

    const cart = carts.get(sid) || { items: [] };
    const itemIndex = cart.items.findIndex(i => i.product_id == parsedId);

    if (itemIndex === -1) {
      return res.status(404).json({
        error: 'Item no encontrado',
        message: 'El item no existe en el carrito'
      });
    }

    if (quantity === 0) {
      // Eliminar item si la cantidad es 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Actualizar cantidad
      cart.items[itemIndex].quantity = Number(quantity);
    }

    // Calcular total
    cart.total = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

    carts.set(sid, cart);
    res.json(cart);
  } catch (e) {
    console.error('Error en PATCH /api/cart/items/:product_id:', e);
    res.status(500).json({
      error: e.message,
      message: 'Error al actualizar el carrito'
    });
  }
});

app.delete('/api/cart/items/:product_id', (req, res) => {
  try {
    const sid = getSessionId(req);
    const parsedId = normalizeProductId(req.params.product_id);
    const cart = carts.get(sid) || { items: [] };

    if (!Number.isInteger(parsedId)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'El product_id debe ser numérico'
      });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(i => i.product_id != parsedId);

    if (initialLength === cart.items.length) {
      return res.status(404).json({
        error: 'Item no encontrado',
        message: 'El item no existe en el carrito'
      });
    }

    // Calcular total
    cart.total = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

    carts.set(sid, cart);
    res.json(cart);
  } catch (e) {
    console.error('Error en DELETE /api/cart/items/:product_id:', e);
    res.status(500).json({
      error: e.message,
      message: 'Error al eliminar item del carrito'
    });
  }
});

// --- Checkout ---
app.post('/api/checkout', async (req, res) => {
  const sid = getSessionId(req);
  let cart = carts.get(sid);
  const user_id = null; // En una app real, obtendrías el user_id de la sesión o token

  const {
    customer_name,
    customer_email,
    customer_phone = null,
    customer_address = null
  } = req.body;

  if (!customer_name || !customer_email) {
    return res.status(400).json({
      error: 'Datos incompletos',
      message: 'customer_name y customer_email son requeridos'
    });
  }

  // Permitir que los items lleguen directamente en el cuerpo de la petición
  if (!cart || !cart.items.length) {
    if (Array.isArray(req.body.items) && req.body.items.length > 0) {
      cart = {
        items: req.body.items.map(i => ({
          product_id: normalizeProductId(i.product_id ?? i.id),
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 0
        }))
      };
    }
  }

  if (!cart || !cart.items.length) {
    return res.status(400).json({
      error: 'Carrito vacío',
      message: 'No hay items en el carrito'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Verificar stock nuevamente antes de procesar la orden y obtener info del producto
    for (const item of cart.items) {
      item.product_id = normalizeProductId(item.product_id);
      if (!Number.isInteger(item.product_id)) {
        throw new Error(`ID de producto inválido: ${item.product_id}`);
      }

      const [rows] = await conn.query(
        'SELECT name, price, stock FROM products WHERE id = ?',
        [item.product_id]
      );

      if (rows.length === 0) {
        throw new Error(`El producto ${item.product_id} no existe`);
      }

      const product = rows[0];

      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Solo quedan ${product.stock} unidades`);
      }

      // Asegurar que los datos del item coincidan con la base de datos
      item.name = product.name;
      item.price = Number(product.price);
    }

    // Recalcular total con precios de la base de datos
    cart.total = cart.items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    // Crear la orden
    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, total, status, customer_name, customer_email, customer_phone, customer_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user_id, cart.total, 'pending', customer_name, customer_email, customer_phone, customer_address]
    );

    const order_id = orderResult.insertId;

    // Agregar items a la orden y actualizar stock
    for (const item of cart.items) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
        [order_id, item.product_id, item.name, item.quantity, item.price]
      );

      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await conn.commit();

    // Limpiar carrito después de checkout exitoso
    carts.delete(sid);

    res.status(201).json({
      order_id,
      total: cart.total,
      status: 'pending',
      message: 'Orden creada exitosamente'
    });
  } catch (e) {
    await conn.rollback();
    console.error('Error en /api/checkout:', e);
    res.status(500).json({
      error: e.message,
      message: 'Error al procesar la orden'
    });
  } finally {
    conn.release();
  }
});

// Endpoint para obtener órdenes
app.get('/api/orders', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.*,
             COUNT(oi.id) as items_count,
             SUM(oi.quantity) as total_items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER by o.created_at DESC
    `);

    res.json(rows);
  } catch (e) {
    console.error('Error en /api/orders:', e);
    res.status(500).json({
      error: e.message,
      message: 'Error al obtener las órdenes'
    });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orderRows] = await pool.query(
      `SELECT o.id, o.status, o.total, o.created_at,
              COALESCE(o.customer_name, u.name) AS customer_name,
              COALESCE(o.customer_email, u.email) AS customer_email,
              COALESCE(o.customer_address, u.address) AS customer_address
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const order = orderRows[0];

    const [items] = await pool.query(
      `SELECT oi.quantity, p.name, p.price
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    res.json({
      id: order.id,
      status: order.status,
      total: Number(order.total),
      created_at: order.created_at,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        address: order.customer_address,
      },
      items: items.map(it => ({
        name: it.name,
        price: Number(it.price),
        quantity: it.quantity,
      })),
    });
  } catch (e) {
    console.error('Error en /api/orders/:id:', e);
    res.status(500).json({
      error: e.message,
      message: 'Error al obtener la orden',
    });
  }
});

// Fallback para SPA - servir index.html para rutas no definidas en la API
app.get(['/', '/store', '/cart', '/about', '/contact', '/login', '/admin'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    password = password.trim();
    const normalizedPassword = password.normalize('NFKC');
    const hash = crypto.createHash('sha256').update(normalizedPassword).digest('hex');

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = users[0];

    if (hash !== user.password_hash) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ valid: false, message: 'Token no proporcionado' });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    res.json({ valid: true, user: payload });
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Token inválido o expirado' });
  }
});

const normalizeDateRange = (from, to) => {
  const isValid = value => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  };

 const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const normalizedTo = isValid(to) ? to : todayIso;

   let normalizedFrom;
  if (isValid(from)) {
    normalizedFrom = from;
  } else {
    const fallback = new Date(new Date(normalizedTo).getTime() - 29 * 24 * 60 * 60 * 1000);
    normalizedFrom = fallback.toISOString().slice(0, 10);
  }

   if (new Date(normalizedFrom) > new Date(normalizedTo)) {
    normalizedFrom = normalizedTo;
  }

  return { fromDate: normalizedFrom, toDate: normalizedTo };
};
  const getDashboardData = async (fromDate, toDate) => {
  const [[usersCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
  const [[productsCount]] = await pool.query('SELECT COUNT(*) AS count FROM products');
  const [[ordersStats]] = await pool.query(
    'SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS sales FROM orders WHERE DATE(created_at) BETWEEN ? AND ?',
    [fromDate, toDate]
  );
  const [[expensesStats]] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS expenses FROM expenses WHERE DATE(incurred_at) BETWEEN ? AND ?',
    [fromDate, toDate]
  );
  const [daily] = await pool.query(
    'SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS total_sales FROM orders WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY DATE(created_at) ORDER BY DATE(created_at)',
    [fromDate, toDate]
  );
  const [topProducts] = await pool.query(
    `SELECT
       oi.product_id,
       COALESCE(oi.product_name, p.name) AS product_name,
       SUM(oi.quantity) AS units_sold,
       SUM(oi.quantity * oi.unit_price) AS revenue
     FROM order_items oi
     INNER JOIN orders o ON oi.order_id = o.id
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE DATE(o.created_at) BETWEEN ? AND ?
     GROUP BY oi.product_id, product_name
     ORDER BY revenue DESC
     LIMIT 5`,
    [fromDate, toDate]
  );

  const [salesByCategory] = await pool.query(
    `SELECT
       COALESCE(c.name, 'Sin categoría') AS category,
       SUM(oi.quantity * oi.unit_price) AS revenue
     FROM order_items oi
     INNER JOIN orders o ON oi.order_id = o.id
     LEFT JOIN products p ON oi.product_id = p.id
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE DATE(o.created_at) BETWEEN ? AND ?
     GROUP BY category
     ORDER BY revenue DESC`,
    [fromDate, toDate]
  );

  const [monthlySales] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COALESCE(SUM(total), 0) AS sales, COUNT(*) AS orders
     FROM orders
     WHERE DATE(created_at) BETWEEN ? AND ?
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month`,
    [fromDate, toDate]
  );

  const [monthlyExpenses] = await pool.query(
    `SELECT DATE_FORMAT(incurred_at, '%Y-%m') AS month, COALESCE(SUM(amount), 0) AS expenses
     FROM expenses
     WHERE DATE(incurred_at) BETWEEN ? AND ?
     GROUP BY DATE_FORMAT(incurred_at, '%Y-%m')
     ORDER BY month`,
    [fromDate, toDate]
  );

  const expensesMap = new Map(monthlyExpenses.map(row => [row.month, Number(row.expenses)]));
  const monthlyFinancial = monthlySales.map(row => ({
    month: row.month,
    sales: Number(row.sales),
    expenses: Number(expensesMap.get(row.month) || 0),
    orders: Number(row.orders)
  }));

  for (const expenseRow of monthlyExpenses) {
    if (!monthlyFinancial.find(row => row.month === expenseRow.month)) {
      monthlyFinancial.push({
        month: expenseRow.month,
        sales: 0,
        expenses: Number(expenseRow.expenses),
        orders: 0
      });
      }
      }

monthlyFinancial.sort((a, b) => a.month.localeCompare(b.month));

  const totalSales = Number(ordersStats.sales || 0);
  const totalOrders = Number(ordersStats.count || 0);
  const totalExpenses = Number(expensesStats.expenses || 0);
  const netIncome = totalSales - totalExpenses;
  const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

  return {
    range: { from: fromDate, to: toDate },
    users: Number(usersCount?.count || 0),
    products: Number(productsCount?.count || 0),
    orders: totalOrders,
    sales: totalSales,
    expenses: totalExpenses,
    netIncome,
    avgTicket: averageTicket,
    ordersDaily: daily.map(row => ({
      date: row.date,
      total_sales: Number(row.total_sales || 0)
    })),
    topProducts: topProducts.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      units_sold: Number(row.units_sold || 0),
      revenue: Number(row.revenue || 0)
    })),
    salesByCategory: salesByCategory.map(row => ({
      category: row.category,
      revenue: Number(row.revenue || 0)
    })),
    monthlyFinancial: monthlyFinancial.map(item => ({
      month: item.month,
      sales: Number(item.sales || 0),
      expenses: Number(item.expenses || 0),
      orders: Number(item.orders || 0)
    }))
  };
};

const escapeCsvValue = value => {
  if (value === null || value === undefined) {
    return '""';
  }

      const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

const createDashboardCsv = (data) => {
  const lines = [];
  const formatCurrency = value => `Q${Number(value || 0).toFixed(2)}`;

  lines.push(escapeCsvValue('Reporte Dashboard Crepería OyE'));
  lines.push(`${escapeCsvValue('Generado')},${escapeCsvValue(new Date().toISOString())}`);
  lines.push('');
  lines.push(`${escapeCsvValue('Periodo')},${escapeCsvValue('Desde')},${escapeCsvValue('Hasta')}`);
  lines.push(`${escapeCsvValue('Rango seleccionado')},${escapeCsvValue(data.range.from)},${escapeCsvValue(data.range.to)}`);
  lines.push('');
  lines.push(`${escapeCsvValue('Indicador')},${escapeCsvValue('Valor')}`);
  lines.push(`${escapeCsvValue('Usuarios activos')},${escapeCsvValue(data.users)}`);
  lines.push(`${escapeCsvValue('Productos publicados')},${escapeCsvValue(data.products)}`);
  lines.push(`${escapeCsvValue('Pedidos procesados')},${escapeCsvValue(data.orders)}`);
  lines.push(`${escapeCsvValue('Ventas totales')},${escapeCsvValue(formatCurrency(data.sales))}`);
  lines.push(`${escapeCsvValue('Gastos operativos')},${escapeCsvValue(formatCurrency(data.expenses))}`);
  lines.push(`${escapeCsvValue('Utilidad neta')},${escapeCsvValue(formatCurrency(data.netIncome))}`);
  lines.push(`${escapeCsvValue('Ticket promedio')},${escapeCsvValue(formatCurrency(data.avgTicket))}`);

  lines.push('');
  lines.push(escapeCsvValue('Ventas diarias'));
  lines.push(`${escapeCsvValue('Fecha')},${escapeCsvValue('Ventas')}`);
  if (data.ordersDaily.length === 0) {
    lines.push(`${escapeCsvValue('Sin registros en el periodo')},${escapeCsvValue(formatCurrency(0))}`);
  } else {
    data.ordersDaily.forEach(item => {
      lines.push(`${escapeCsvValue(item.date)},${escapeCsvValue(formatCurrency(item.total_sales))}`);
    
    });
     }

  lines.push('');
  lines.push(escapeCsvValue('Resumen mensual'));
  lines.push(`${escapeCsvValue('Mes')},${escapeCsvValue('Ventas')},${escapeCsvValue('Gastos')},${escapeCsvValue('Utilidad')},${escapeCsvValue('Pedidos')}`);
  if (data.monthlyFinancial.length === 0) {
    lines.push(`${escapeCsvValue('Sin datos')},${escapeCsvValue('0')},${escapeCsvValue('0')},${escapeCsvValue('0')},${escapeCsvValue('0')}`);
  } else {
    data.monthlyFinancial.forEach(item => {
      const utilidad = Number(item.sales || 0) - Number(item.expenses || 0);
      lines.push(`${escapeCsvValue(item.month)},${escapeCsvValue(formatCurrency(item.sales))},${escapeCsvValue(formatCurrency(item.expenses))},${escapeCsvValue(formatCurrency(utilidad))},${escapeCsvValue(item.orders)}`);
    });
  }

  lines.push('');
  lines.push(escapeCsvValue('Top productos'));
  lines.push(`${escapeCsvValue('Producto')},${escapeCsvValue('Unidades vendidas')},${escapeCsvValue('Ingresos')}`);
  if (data.topProducts.length === 0) {
    lines.push(`${escapeCsvValue('Sin datos en el periodo')},${escapeCsvValue('0')},${escapeCsvValue('0.00')}`);
  } else {
    data.topProducts.forEach(item => {
      lines.push(`${escapeCsvValue(item.product_name)},${escapeCsvValue(item.units_sold)},${escapeCsvValue(formatCurrency(item.revenue))}`);
    });
  }

  lines.push('');
  lines.push(escapeCsvValue('Ventas por categoría'));
  lines.push(`${escapeCsvValue('Categoría')},${escapeCsvValue('Ingresos')}`);
  if (data.salesByCategory.length === 0) {
    lines.push(`${escapeCsvValue('Sin datos en el periodo')},${escapeCsvValue('0.00')}`);
  } else {
    data.salesByCategory.forEach(item => {
      lines.push(`${escapeCsvValue(item.category)},${escapeCsvValue(formatCurrency(item.revenue))}`);
    });
  }

  return lines.join('\n');
};

// Endpoint del dashboard administrativo
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    const { fromDate, toDate } = normalizeDateRange(from, to);
    const data = await getDashboardData(fromDate, toDate);

    res.json(data);
  } catch (error) {
    console.error('Error en /api/admin/dashboard:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});
app.get('/api/admin/dashboard/export', requireAdmin, async (req, res) => {
  try {
    const { from, to, format = 'csv' } = req.query;
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ message: 'Formato de exportación no soportado' });
    }

    const { fromDate, toDate } = normalizeDateRange(from, to);
    const data = await getDashboardData(fromDate, toDate);

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-report-${fromDate}-al-${toDate}.json"`);
      return res.json({
        generatedAt: new Date().toISOString(),
        ...data
      });
    }

    const csv = createDashboardCsv(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-report-${fromDate}-al-${toDate}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error en /api/admin/dashboard/export:', error);
    res.status(500).json({ message: 'No fue posible generar el reporte' });
  }
});

// Endpoint para obtener todos los usuarios (solo admin)
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    // Obtener usuarios de la base de datos
    const [users] = await pool.query('SELECT id, name, email, role, phone, address FROM users');
    
    res.json(users);
  } catch (error) {
    console.error('Error en /api/users:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para obtener un usuario específico (solo admin)
app.get('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const [users] = await pool.query(
      'SELECT id, name, email, role, phone, address FROM users WHERE id = ?',
      [userId]
    );
    
    if (!users.length) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json(users[0]);
  } catch (error) {
    console.error('Error en /api/users/:id:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para crear un nuevo usuario (público para rol 'user', admin para otros roles)
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role = 'customer', phone, address } = req.body;

    // Validaciones básicas
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son requeridos' });
    }

    // Si el rol no es 'user', requerir autenticación de admin
    if (role !== 'customer') {
      try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
          return res.status(401).json({ message: 'Token no proporcionado para crear usuario con rol ' + role });
        }

        const payload = jwt.verify(token, JWT_SECRET);
        
        if (payload.role !== 'admin') {
          return res.status(403).json({ message: 'Acceso denegado: se requiere rol de administrador' });
        }
      } catch (error) {
        console.error('Error en verificación de token:', error);
        return res.status(401).json({ message: 'Token inválido o expirado' });
      }
    }

    // Verificar si el usuario ya existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'El usuario con este email ya existe' });
    }

    // Hash de la contraseña
    const normalizedPassword = password.normalize('NFKC');
    const password_hash = crypto.createHash('sha256').update(normalizedPassword).digest('hex');

    // Crear usuario
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, password_hash, role, phone || null, address || null]
    );

    // Obtener usuario creado
    const [users] = await pool.query(
      'SELECT id, name, email, role, phone, address FROM users WHERE id = ?',
      [result.insertId]
    );

    // Si es registro público, generar token de autenticación
    if (role === 'user') {
      const token = jwt.sign(
        { id: users[0].id, email: users[0].email, name: users[0].name, role: users[0].role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        user: users[0],
        token,
        message: 'Usuario registrado exitosamente'
      });
    }

    res.status(201).json(users[0]);
  } catch (error) {
    console.error('Error en POST /api/users:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para actualizar perfil de usuario
app.put('/api/user/profile', async (req, res) => {
  try {
    // Verificar autenticación
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const { name, email, phone, address } = req.body;

    // Actualizar usuario en la base de datos
    const [result] = await pool.query(
      'UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
      [name, email, phone, address, payload.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener usuario actualizado
    const [users] = await pool.query('SELECT id, name, email, role, phone, address FROM users WHERE id = ?', [payload.id]);
    
    res.json({ 
      message: 'Perfil actualizado correctamente',
      user: users[0] 
    });
  } catch (error) {
    console.error('Error en /api/user/profile:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para actualizar cualquier usuario (solo admin)
app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role, phone, address } = req.body;

    // Verificar si el usuario existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existingUsers.length) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si el email ya está en uso por otro usuario
    const [emailUsers] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (emailUsers.length > 0) {
      return res.status(409).json({ message: 'El email ya está en uso por otro usuario' });
    }

    // Actualizar usuario
    const [result] = await pool.query(
      'UPDATE users SET name = ?, email = ?, role = ?, phone = ?, address = ? WHERE id = ?',
      [name, email, role, phone, address, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener usuario actualizado
    const [users] = await pool.query(
      'SELECT id, name, email, role, phone, address FROM users WHERE id = ?',
      [userId]
    );

    res.json({ 
      message: 'Usuario actualizado correctamente',
      user: users[0] 
    });
  } catch (error) {
    console.error('Error en PUT /api/users/:id:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para eliminar usuario (solo admin)
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Verificar si el usuario existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existingUsers.length) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Eliminar usuario
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ 
      message: 'Usuario eliminado correctamente',
      userId 
    });
  } catch (error) {
    console.error('Error en DELETE /api/users/:id:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ 
    error: err.message,
    message: 'Error interno del servidor' 
  });
});

// Manejo de rutas no encontradas (para cualquier método HTTP)
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    message: 'La ruta solicitada no existe' 
  });
});

// Iniciar servidor
const port = process.env.PORT || 3000;

app.listen(port, async () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
  await testConnection();
  console.log('📋 Endpoints disponibles:');
  console.log(`   - GET  http://localhost:${port}/api/health`);
  console.log(`   - GET  http://localhost:${port}/api/products`);
  console.log(`   - GET  http://localhost:${port}/api/categories`);
  console.log(`   - POST http://localhost:${port}/api/cart/items`);
  console.log(`   - POST http://localhost:${port}/api/checkout`);
  console.log(`   - CRUD http://localhost:${port}/api/users (solo admin)`);
  console.log(`   - CRUD http://localhost:${port}/api/products (solo admin)`);
  console.log(`   - GET  http://localhost:${port}/api/admin/dashboard (requiere token admin)`);
  console.log(`   - GET  http://localhost:${port}/api/admin/dashboard/export (requiere token admin)`);
});