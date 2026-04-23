const express = require('express');
const bodyParser = require('body-parser');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { checkToken } = require('../middleware/checkToken');

const router = express.Router();
const jsonParser = bodyParser.json();

router.post('/', checkToken, jsonParser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { product: productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const qty = parseInt(quantity) || 1;
    if (qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    if (qty > product.stock) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    let cart = await Cart.findOne({ user: userId });

    if (cart) {
      const existingItem = cart.items.find(
        (item) => item.product.toString() === productId
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + qty;
        if (newQuantity > product.stock) {
          return res.status(400).json({ error: 'Insufficient stock' });
        }
        existingItem.quantity = newQuantity;
      } else {
        cart.items.push({ product: productId, quantity: qty });
      }
      await cart.save();
      res.end();
    } else {
      await Cart.create({
        user: userId,
        items: [{ product: productId, quantity: qty }]
      });
      res.end();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', checkToken, (req, res) => {
  Cart.findOne({ user: req.user.id })
  .populate('items.product')
  .exec((err, cart) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!cart) {
      return res.send(null);
    }
    res.send(cart);
  });
});

router.put('/', checkToken, jsonParser, async (req, res) => {
  try {
    const { cartId, itemId } = req.body;

    if (!cartId || !itemId) {
      return res.status(400).json({ error: 'cartId and itemId are required' });
    }

    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:itemId', checkToken, jsonParser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const item = cart.items.find(
      (i) => i._id.toString() === itemId
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    const product = await Product.findById(item.product);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (qty > product.stock) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    item.quantity = qty;
    await cart.save();
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', checkToken, (req, res) => {
  Cart.findByIdAndRemove(req.query.id)
    .then(() => res.end())
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    });
});

module.exports = router;

module.exports = router;
