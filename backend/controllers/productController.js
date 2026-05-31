const db = require('../config/db');

exports.getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort, page = 1, limit = 12 } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    // 1. Category Filter
    if (category) {
      if (!isNaN(category)) {
        query += ' AND p.category_id = ?';
        params.push(parseInt(category, 10));
      } else {
        query += ' AND c.name = ?';
        params.push(category);
      }
    }

    // 2. Search Filter
    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard);
    }

    // 3. Price Filter
    if (minPrice) {
      query += ' AND (p.price * (1 - p.discount/100)) >= ?';
      params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      query += ' AND (p.price * (1 - p.discount/100)) <= ?';
      params.push(parseFloat(maxPrice));
    }

    // Get count for pagination before ordering and limits
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const countParams = [...params];
    if (category) {
      if (!isNaN(category)) {
        countQuery += ' AND p.category_id = ?';
      } else {
        countQuery += ' AND c.name = ?';
      }
    }
    if (search) {
      countQuery += ' AND (p.name LIKE ? OR p.description LIKE ?)';
    }
    if (minPrice) {
      countQuery += ' AND (p.price * (1 - p.discount/100)) >= ?';
    }
    if (maxPrice) {
      countQuery += ' AND (p.price * (1 - p.discount/100)) <= ?';
    }

    // 4. Sorting
    switch (sort) {
      case 'price_asc':
        query += ' ORDER BY (p.price * (1 - p.discount/100)) ASC';
        break;
      case 'price_desc':
        query += ' ORDER BY (p.price * (1 - p.discount/100)) DESC';
        break;
      case 'rating_desc':
        query += ' ORDER BY p.rating DESC';
        break;
      case 'newest':
        query += ' ORDER BY p.created_at DESC';
        break;
      default:
        query += ' ORDER BY p.id ASC';
    }

    // 5. Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), offset);

    const [[{ total }]] = await db.query(countQuery, countParams);
    const [products] = await db.query(query, params);

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving products.' });
  }
};

exports.getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const [products] = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ?`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = products[0];

    // Fetch product reviews (Approved reviews only for storefront)
    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name as user_name 
       FROM reviews r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.product_id = ? AND r.status = 'Approved' 
       ORDER BY r.created_at DESC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      product,
      reviews
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving product details.' });
  }
};

exports.getRelatedProducts = async (req, res) => {
  const { id } = req.params;

  try {
    // Get category_id of current product
    const [products] = await db.query('SELECT category_id FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const categoryId = products[0].category_id;

    // Get products of same category, excluding current product, limit 4
    const [related] = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.category_id = ? AND p.id != ? 
       LIMIT 4`,
      [categoryId, id]
    );

    return res.status(200).json({
      success: true,
      products: related
    });
  } catch (error) {
    console.error('Get related products error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving related products.' });
  }
};
