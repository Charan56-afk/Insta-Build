const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = 'craftopia_secret_key';

// In-memory data stores
let users = [
  {
    id: 1,
    name: 'Alex Morgan',
    email: 'alex@example.com',
    password: '$2b$10$8K1p/aqRk2uZ4r7WmQDkIuN8JyV3Pz8R4U5X9Y2Z7Q8R3S4T5U6V7', // 'password123'
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&q=80',
    googleId: null,
    cinesocialId: null
  },
  {
    id: 2,
    name: 'Taylor Swift',
    email: 'taylor@example.com',
    password: '$2b$10$8K1p/aqRk2uZ4r7WmQDkIuN8JyV3Pz8R4U5X9Y2Z7Q8R3S4T5U6V7', // 'password123'
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&q=80',
    googleId: 'google123',
    cinesocialId: null
  },
  {
    id: 3,
    name: 'Jamie Smith',
    email: 'jamie@example.com',
    password: '$2b$10$8K1p/aqRk2uZ4r7WmQDkIuN8JyV3Pz8R4U5X9Y2Z7Q8R3S4T5U6V7', // 'password123'
    avatar: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=100&q=80',
    googleId: null,
    cinesocialId: 'cinesocial456'
  }
];

let items = [
  {
    id: 1,
    title: 'Handcrafted Ceramic Mug',
    description: 'Beautiful hand-thrown ceramic mug with unique glaze finish.',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&q=80',
    category: 'Home Decor',
    sellerId: 1,
    createdAt: new Date('2023-05-15'),
    likes: 24,
    rating: 4.8,
    tags: ['ceramic', 'handmade', 'coffee']
  },
  {
    id: 2,
    title: 'Macrame Wall Hanging',
    description: 'Large bohemian-style macrame wall hanging with natural cotton cords.',
    price: 45.50,
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&q=80',
    category: 'Home Decor',
    sellerId: 2,
    createdAt: new Date('2023-06-22'),
    likes: 18,
    rating: 4.9,
    tags: ['macrame', 'wall art', 'boho']
  },
  {
    id: 3,
    title: 'Hand-painted Canvas Art',
    description: 'Original abstract painting on stretched canvas with vibrant colors.',
    price: 89.99,
    image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&q=80',
    category: 'Art',
    sellerId: 1,
    createdAt: new Date('2023-07-10'),
    likes: 32,
    rating: 4.7,
    tags: ['abstract', 'canvas', 'painting']
  },
  {
    id: 4,
    title: 'Wooden Jewelry Box',
    description: 'Handcrafted wooden jewelry box with intricate carving details.',
    price: 35.00,
    image: 'https://images.unsplash.com/photo-1590664140122-0f8b0238050c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&q=80',
    category: 'Jewelry',
    sellerId: 3,
    createdAt: new Date('2023-08-05'),
    likes: 15,
    rating: 4.6,
    tags: ['wood', 'jewelry', 'storage']
  },
  {
    id: 5,
    title: 'Knitted Scarf Set',
    description: 'Set of 3 cozy knitted scarves in different colors and patterns.',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1590664140122-0f8b0238050c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&q=80',
    category: 'Clothing',
    sellerId: 2,
    createdAt: new Date('2023-09-12'),
    likes: 27,
    rating: 4.9,
    tags: ['knit', 'scarves', 'winter']
  },
  {
    id: 6,
    title: 'Hand-carved Wooden Bowl',
    description: 'Beautiful hand-carved wooden bowl made from sustainable hardwood.',
    price: 32.50,
    image: 'https://images.unsplash.com/photo-1551822363-79e486591523?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&q=80',
    category: 'Home Decor',
    sellerId: 1,
    createdAt: new Date('2023-10-01'),
    likes: 12,
    rating: 4.5,
    tags: ['wood', 'handmade', 'bowl']
  },
  {
    id: 7,
    title: 'Embroidered Quilting Kit',
    description: 'Complete quilting kit with fabric, thread, and instructions for beginners.',
    price: 27.99,
    image: 'https://images.unsplash.com/photo-1590664140122-0f8b0238050c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&q=80',
    category: 'Craft Supplies',
    sellerId: 3,
    createdAt: new Date('2023-10-10'),
    likes: 8,
    rating: 4.3,
    tags: ['quilting', 'embroidery', 'kit']
  }
];

let orders = [];

// Helper functions
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

const getUserById = (id) => users.find(user => user.id === parseInt(id));
const getItemById = (id) => items.find(item => item.id === parseInt(id));

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    if (users.some(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      id: users.length + 1,
      name,
      email,
      password: hashedPassword,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=100`,
      googleId: null,
      cinesocialId: null
    };
    
    users.push(newUser);
    
    const token = generateToken(newUser.id);
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { googleId, name, email, avatar } = req.body;
    
    // Check if user already exists with Google ID
    let user = users.find(u => u.googleId === googleId);
    
    if (!user) {
      // Create new user
      user = {
        id: users.length + 1,
        name,
        email,
        password: null,
        avatar,
        googleId,
        cinesocialId: null
      };
      
      users.push(user);
    }
    
    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/cinesocial', async (req, res) => {
  try {
    const { cinesocialId, name, email, avatar } = req.body;
    
    // Check if user already exists with CineSocial ID
    let user = users.find(u => u.cinesocialId === cinesocialId);
    
    if (!user) {
      // Create new user
      user = {
        id: users.length + 1,
        name,
        email,
        password: null,
        avatar,
        googleId: null,
        cinesocialId
      };
      
      users.push(user);
    }
    
    const token = generateToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Items Routes
app.get('/api/items', (req, res) => {
  try {
    const { category, search, sortBy = 'newest' } = req.query;
    
    let filteredItems = [...items];
    
    if (category) {
      filteredItems = filteredItems.filter(item => 
        item.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.title.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    // Sort items
    switch (sortBy) {
      case 'price-low':
        filteredItems.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filteredItems.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filteredItems.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        filteredItems.sort((a, b) => b.likes - a.likes);
        break;
      default: // newest
        filteredItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    res.json(filteredItems);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/items/:id', (req, res) => {
  try {
    const item = getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/items', (req, res) => {
  try {
    const { title, description, price, category, image, tags } = req.body;
    const sellerId = req.user.userId;
    
    const newItem = {
      id: items.length + 1,
      title,
      description,
      price,
      image,
      category,
      sellerId,
      createdAt: new Date(),
      likes: 0,
      rating: 0,
      tags: tags || []
    };
    
    items.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/items/:id', (req, res) => {
  try {
    const itemIndex = items.findIndex(item => item.id === parseInt(req.params.id));
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const { title, description, price, category, image, tags } = req.body;
    const sellerId = req.user.userId;
    
    // Verify ownership
    if (items[itemIndex].sellerId !== sellerId) {
      return res.status(403).json({ error: 'Unauthorized to modify this item' });
    }
    
    items[itemIndex] = {
      ...items[itemIndex],
      title,
      description,
      price,
      category,
      image,
      tags: tags || items[itemIndex].tags
    };
    
    res.json(items[itemIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/items/:id', (req, res) => {
  try {
    const itemIndex = items.findIndex(item => item.id === parseInt(req.params.id));
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const sellerId = req.user.userId;
    
    // Verify ownership
    if (items[itemIndex].sellerId !== sellerId) {
      return res.status(403).json({ error: 'Unauthorized to delete this item' });
    }
    
    items.splice(itemIndex, 1);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Categories Route
app.get('/api/categories', (req, res) => {
  try {
    const categories = [...new Set(items.map(item => item.category))];
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Tags Route
app.get('/api/tags', (req, res) => {
  try {
    const allTags = items.flatMap(item => item.tags);
    const uniqueTags = [...new Set(allTags)];
    res.json(uniqueTags);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User Profile Route
app.get('/api/profile', (req, res) => {
  try {
    const user = getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Orders Routes
app.post('/api/orders', (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const buyerId = req.user.userId;
    
    const item = getItemById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Check if buyer is not the seller
    if (item.sellerId === buyerId) {
      return res.status(400).json({ error: 'Cannot purchase your own item' });
    }
    
    const order = {
      id: orders.length + 1,
      itemId,
      buyerId,
      sellerId: item.sellerId,
      quantity,
      totalPrice: item.price * quantity,
      status: 'pending',
      createdAt: new Date()
    };
    
    orders.push(order);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    const buyerId = req.user.userId;
    const userOrders = orders.filter(order => order.buyerId === buyerId);
    res.json(userOrders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders/seller', (req, res) => {
  try {
    const sellerId = req.user.userId;
    const sellerOrders = orders.filter(order => order.sellerId === sellerId);
    res.json(sellerOrders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Item Likes Route
app.post('/api/items/:id/like', (req, res) => {
  try {
    const itemIndex = items.findIndex(item => item.id === parseInt(req.params.id));
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    items[itemIndex].likes += 1;
    res.json({ success: true, likes: items[itemIndex].likes });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Apply authentication middleware to protected routes
app.use('/api/items', authenticateToken);
app.use('/api/orders', authenticateToken);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});