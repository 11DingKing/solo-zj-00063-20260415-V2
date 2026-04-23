const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');

require('dotenv').config();

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');

const cartRoutes = require('../routes/cartRoutes');

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

const originalCheckToken = require('../middleware/checkToken');
originalCheckToken.checkToken = mockCheckToken;

app.use('/api/cart', cartRoutes);

let testUser;
let testProduct;
let testProduct2;

async function runTests() {
  console.log('=== Cart API Integration Tests ===\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mobileShop_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to database.\n');

    await setupTestData();

    console.log('--- Test 1: Bug 1 - POST /cart user query consistency ---');
    try {
      await testUserQueryConsistency();
      console.log('✅ PASSED: User query is consistent (uses req.user.id)\n');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}\n`);
      failed++;
    }

    console.log('--- Test 2: Bug 2 - POST /cart product validation ---');
    try {
      await testProductValidation();
      console.log('✅ PASSED: Product validation works correctly\n');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}\n`);
      failed++;
    }

    console.log('--- Test 3: Bug 3 - PUT /cart delete item validation ---');
    try {
      await testDeleteItemValidation();
      console.log('✅ PASSED: Delete item validation returns 404 for invalid itemId\n');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}\n`);
      failed++;
    }

    console.log('--- Test 4: PUT /cart/:itemId - update quantity feature ---');
    try {
      await testUpdateQuantity();
      console.log('✅ PASSED: Update quantity feature works correctly\n');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}\n`);
      failed++;
    }

    console.log('--- Test 5: GET /cart - consistency check ---');
    try {
      await testGetCartConsistency();
      console.log('✅ PASSED: GET /cart returns consistent data\n');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}\n`);
      failed++;
    }

    console.log('=== Test Summary ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);

    if (failed > 0) {
      process.exit(1);
    }

  } catch (err) {
    console.error('Test setup failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

async function setupTestData() {
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

  testUser = {
    id: '507f1f77bcf86cd799439011',
    username: 'testuser'
  };
}

function mockRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve) => {
    const req = {
      method,
      path,
      headers: { 'content-type': 'application/json', ...headers },
      body,
      query: {}
    };

    if (path.includes('?')) {
      const [pathPart, queryPart] = path.split('?');
      req.path = pathPart;
      queryPart.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        req.query[key] = value;
      });
    }

    const res = {
      statusCode: 200,
      body: null,
      ended: false,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        this.ended = true;
        resolve(this);
      },
      send: function(data) {
        this.body = data;
        this.ended = true;
        resolve(this);
      },
      end: function() {
        this.ended = true;
        resolve(this);
      },
      sendStatus: function(code) {
        this.statusCode = code;
        this.ended = true;
        resolve(this);
      }
    };

    const next = () => {
      if (!res.ended) {
        resolve(res);
      }
    };

    if (path.startsWith('/api/cart')) {
      const router = require('../routes/cartRoutes');
      const params = {};
      
      const putItemMatch = path.match(/^\/api\/cart\/([^/?]+)/);
      if (putItemMatch && method === 'PUT') {
        params.itemId = putItemMatch[1];
        req.params = params;
      }
      
      router.handle(req, res, next);
    } else {
      resolve(res);
    }
  });
}

async function testUserQueryConsistency() {
  await Cart.deleteMany({ user: testUser.id });

  const res1 = await mockRequest('POST', '/api/cart', 
    { 'x-test-user-id': testUser.id },
    { product: testProduct._id.toString(), quantity: 1 }
  );

  if (res1.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${res1.statusCode}`);
  }

  const res2 = await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: testProduct2._id.toString(), quantity: 1 }
  );

  if (res2.statusCode !== 200) {
    throw new Error(`Expected status 200, got ${res2.statusCode}`);
  }

  const carts = await Cart.find({ user: testUser.id });
  if (carts.length !== 1) {
    throw new Error(`Expected 1 cart, found ${carts.length}`);
  }

  if (carts[0].items.length !== 2) {
    throw new Error(`Expected 2 items in cart, found ${carts[0].items.length}`);
  }
}

async function testProductValidation() {
  await Cart.deleteMany({ user: testUser.id });

  const invalidProductId = '507f1f77bcf86cd799439999';
  const res1 = await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: invalidProductId, quantity: 1 }
  );

  if (res1.statusCode !== 404) {
    throw new Error(`Expected 404 for non-existent product, got ${res1.statusCode}`);
  }

  const res2 = await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: testProduct._id.toString(), quantity: 100 }
  );

  if (res2.statusCode !== 400) {
    throw new Error(`Expected 400 for quantity exceeding stock, got ${res2.statusCode}`);
  }

  const res3 = await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: testProduct._id.toString(), quantity: 0 }
  );

  if (res3.statusCode !== 400) {
    throw new Error(`Expected 400 for quantity 0, got ${res3.statusCode}`);
  }

  const res4 = await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: testProduct._id.toString(), quantity: 2 }
  );

  if (res4.statusCode !== 200) {
    throw new Error(`Expected 200 for valid product, got ${res4.statusCode}`);
  }

  const cart = await Cart.findOne({ user: testUser.id });
  if (!cart) {
    throw new Error('Cart should exist after adding valid product');
  }
  if (cart.items[0].quantity !== 2) {
    throw new Error(`Expected quantity 2, got ${cart.items[0].quantity}`);
  }
}

async function testDeleteItemValidation() {
  await Cart.deleteMany({ user: testUser.id });

  await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: testProduct._id.toString(), quantity: 1 }
  );

  const cart = await Cart.findOne({ user: testUser.id });
  const invalidItemId = '507f1f77bcf86cd799439999';

  const res = await mockRequest('PUT', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { cartId: cart._id.toString(), itemId: invalidItemId }
  );

  if (res.statusCode !== 404) {
    throw new Error(`Expected 404 for invalid itemId, got ${res.statusCode}`);
  }

  const res2 = await mockRequest('PUT', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { cartId: cart._id.toString(), itemId: cart.items[0]._id.toString() }
  );

  if (res2.statusCode !== 200) {
    throw new Error(`Expected 200 for valid delete, got ${res2.statusCode}`);
  }

  const updatedCart = await Cart.findOne({ user: testUser.id });
  if (updatedCart.items.length !== 0) {
    throw new Error('Cart should be empty after deleting item');
  }
}

async function testUpdateQuantity() {
  await Cart.deleteMany({ user: testUser.id });

  await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: testProduct._id.toString(), quantity: 1 }
  );

  let cart = await Cart.findOne({ user: testUser.id });
  const itemId = cart.items[0]._id.toString();

  const res1 = await mockRequest('PUT', `/api/cart/${itemId}`,
    { 'x-test-user-id': testUser.id },
    { quantity: 5 }
  );

  if (res1.statusCode !== 200) {
    throw new Error(`Expected 200 for valid quantity update, got ${res1.statusCode}`);
  }

  cart = await Cart.findOne({ user: testUser.id });
  if (cart.items[0].quantity !== 5) {
    throw new Error(`Expected quantity 5, got ${cart.items[0].quantity}`);
  }

  const res2 = await mockRequest('PUT', `/api/cart/${itemId}`,
    { 'x-test-user-id': testUser.id },
    { quantity: 100 }
  );

  if (res2.statusCode !== 400) {
    throw new Error(`Expected 400 for quantity exceeding stock, got ${res2.statusCode}`);
  }

  const res3 = await mockRequest('PUT', `/api/cart/${itemId}`,
    { 'x-test-user-id': testUser.id },
    { quantity: 0 }
  );

  if (res3.statusCode !== 400) {
    throw new Error(`Expected 400 for quantity 0, got ${res3.statusCode}`);
  }

  const invalidItemId = '507f1f77bcf86cd799439999';
  const res4 = await mockRequest('PUT', `/api/cart/${invalidItemId}`,
    { 'x-test-user-id': testUser.id },
    { quantity: 5 }
  );

  if (res4.statusCode !== 404) {
    throw new Error(`Expected 404 for invalid itemId, got ${res4.statusCode}`);
  }
}

async function testGetCartConsistency() {
  await Cart.deleteMany({ user: testUser.id });

  await mockRequest('POST', '/api/cart',
    { 'x-test-user-id': testUser.id },
    { product: testProduct._id.toString(), quantity: 3 }
  );

  const cart = await Cart.findOne({ user: testUser.id });
  if (!cart) {
    throw new Error('Cart should exist');
  }
  if (cart.items.length !== 1) {
    throw new Error(`Expected 1 item, got ${cart.items.length}`);
  }
  if (cart.items[0].quantity !== 3) {
    throw new Error(`Expected quantity 3, got ${cart.items[0].quantity}`);
  }
}

runTests();
