const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');

require('dotenv').config();

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');

const cartRoutes = require('../routes/cartRoutes');
const authRoutes = require('../routes/authRoutes');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const mockCheckToken = (req, res, next) => {
  req.user = {
    id: req.headers['x-test-user-id'] || '507f1f77bcf86cd799439011',
    username: 'testuser'
  };
  next();
};

jest.mock('../middleware/checkToken', () => ({
  checkToken: mockCheckToken
}));

app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);

describe('Cart API Tests', () => {
  let testUser;
  let testProduct;
  let testProduct2;
  let authToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobileShop_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});

    testProduct = await Product.create({
      info: { name: 'Test Product', price: 100 },
      tags: { brand: 'test' },
      stock: 10
    });

    testProduct2 = await Product.create({
      info: { name: 'Test Product 2', price: 200 },
      tags: { brand: 'test' },
      stock: 5
    });

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'testpass',
        email: 'test@test.com',
        address: '123 Test St',
        phone: '1234567890'
      });
    
    testUser = registerRes.body;
  });

  describe('Bug 1: POST /cart - user query consistency', () => {
    it('should use req.user.id consistently and not create duplicate carts', async () => {
      const addRes1 = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 1
        });
      
      expect(addRes1.status).toBe(200);

      const addRes2 = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct2._id.toString(),
          quantity: 1
        });
      
      expect(addRes2.status).toBe(200);

      const carts = await Cart.find({ user: testUser.id });
      expect(carts.length).toBe(1);
      expect(carts[0].items.length).toBe(2);
    });
  });

  describe('Bug 2: POST /cart - product validation', () => {
    it('should return 404 when product does not exist', async () => {
      const invalidProductId = '507f1f77bcf86cd799439999';
      
      const res = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: invalidProductId,
          quantity: 1
        });
      
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Product not found');
    });

    it('should return 400 when quantity exceeds stock', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 100
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Insufficient stock');
    });

    it('should return 400 when quantity is 0 or negative', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 0
        });
      
      expect(res.status).toBe(400);
    });

    it('should successfully add product when valid', async () => {
      const res = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 2
        });
      
      expect(res.status).toBe(200);

      const cart = await Cart.findOne({ user: testUser.id });
      expect(cart).not.toBeNull();
      expect(cart.items.length).toBe(1);
      expect(cart.items[0].quantity).toBe(2);
    });
  });

  describe('Bug 3: PUT /cart - delete item validation', () => {
    it('should return 404 when itemId does not exist in cart', async () => {
      const addRes = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 1
        });
      
      expect(addRes.status).toBe(200);

      const cart = await Cart.findOne({ user: testUser.id });
      const invalidItemId = '507f1f77bcf86cd799439999';

      const deleteRes = await request(app)
        .put('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          cartId: cart._id.toString(),
          itemId: invalidItemId
        });
      
      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.error).toBe('Item not found in cart');
    });

    it('should successfully delete item when valid', async () => {
      const addRes = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 1
        });
      
      expect(addRes.status).toBe(200);

      let cart = await Cart.findOne({ user: testUser.id });
      expect(cart.items.length).toBe(1);

      const deleteRes = await request(app)
        .put('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          cartId: cart._id.toString(),
          itemId: cart.items[0]._id.toString()
        });
      
      expect(deleteRes.status).toBe(200);

      cart = await Cart.findOne({ user: testUser.id });
      expect(cart.items.length).toBe(0);
    });
  });

  describe('PUT /cart/:itemId - update quantity feature', () => {
    it('should update quantity successfully', async () => {
      const addRes = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 1
        });
      
      expect(addRes.status).toBe(200);

      let cart = await Cart.findOne({ user: testUser.id });
      const itemId = cart.items[0]._id.toString();

      const updateRes = await request(app)
        .put(`/api/cart/${itemId}`)
        .set('x-test-user-id', testUser.id)
        .send({
          quantity: 5
        });
      
      expect(updateRes.status).toBe(200);

      cart = await Cart.findOne({ user: testUser.id });
      expect(cart.items[0].quantity).toBe(5);
    });

    it('should return 400 when quantity exceeds stock', async () => {
      const addRes = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 1
        });
      
      expect(addRes.status).toBe(200);

      const cart = await Cart.findOne({ user: testUser.id });
      const itemId = cart.items[0]._id.toString();

      const updateRes = await request(app)
        .put(`/api/cart/${itemId}`)
        .set('x-test-user-id', testUser.id)
        .send({
          quantity: 100
        });
      
      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toBe('Insufficient stock');
    });

    it('should return 400 when quantity is 0 or negative', async () => {
      const addRes = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 1
        });
      
      expect(addRes.status).toBe(200);

      const cart = await Cart.findOne({ user: testUser.id });
      const itemId = cart.items[0]._id.toString();

      const updateRes = await request(app)
        .put(`/api/cart/${itemId}`)
        .set('x-test-user-id', testUser.id)
        .send({
          quantity: 0
        });
      
      expect(updateRes.status).toBe(400);
    });

    it('should return 404 when itemId does not exist', async () => {
      const invalidItemId = '507f1f77bcf86cd799439999';

      const updateRes = await request(app)
        .put(`/api/cart/${invalidItemId}`)
        .set('x-test-user-id', testUser.id)
        .send({
          quantity: 5
        });
      
      expect(updateRes.status).toBe(404);
    });

    it('should return 404 when cart does not exist', async () => {
      const addRes = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 1
        });
      
      expect(addRes.status).toBe(200);

      const cart = await Cart.findOne({ user: testUser.id });
      const itemId = cart.items[0]._id.toString();

      const differentUserId = '507f1f77bcf86cd799439022';
      const updateRes = await request(app)
        .put(`/api/cart/${itemId}`)
        .set('x-test-user-id', differentUserId)
        .send({
          quantity: 5
        });
      
      expect(updateRes.status).toBe(404);
    });
  });

  describe('GET /cart - consistency check', () => {
    it('should return the same cart that was created via POST', async () => {
      const addRes = await request(app)
        .post('/api/cart')
        .set('x-test-user-id', testUser.id)
        .send({
          product: testProduct._id.toString(),
          quantity: 3
        });
      
      expect(addRes.status).toBe(200);

      const getRes = await request(app)
        .get('/api/cart')
        .set('x-test-user-id', testUser.id);
      
      expect(getRes.status).toBe(200);
      expect(getRes.body).not.toBeNull();
      expect(getRes.body.items.length).toBe(1);
      expect(getRes.body.items[0].quantity).toBe(3);
    });
  });
});
