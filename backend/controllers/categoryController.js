const db = require('../config/db');

exports.getCategories = async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');
    return res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving categories.' });
  }
};

exports.getCategoryById = async (req, res) => {
  const { id } = req.params;

  try {
    const [categories] = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (categories.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    return res.status(200).json({
      success: true,
      category: categories[0]
    });
  } catch (error) {
    console.error('Get category by ID error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving category details.' });
  }
};
