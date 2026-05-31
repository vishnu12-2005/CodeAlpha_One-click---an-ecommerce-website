-- OneClick Database Schema

CREATE DATABASE IF NOT EXISTS `oneclick_db`;
USE `oneclick_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `address` TEXT NULL,
  `role` ENUM('customer', 'admin') DEFAULT 'customer',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `image` VARCHAR(500) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Products Table
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(5,2) DEFAULT 0.00, -- Discount percentage (e.g. 10.00 for 10% off)
  `stock` INT DEFAULT 0,
  `image` VARCHAR(500) NULL,
  `rating` DECIMAL(3,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Wishlist Table
CREATE TABLE IF NOT EXISTS `wishlist` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  UNIQUE KEY `user_product_wish` (`user_id`, `product_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Cart Table
CREATE TABLE IF NOT EXISTS `cart` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT DEFAULT 1,
  UNIQUE KEY `user_product_cart` (`user_id`, `product_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `total_amount` DECIMAL(10,2) NOT NULL,
  `payment_method` ENUM('COD', 'Online') NOT NULL,
  `payment_status` ENUM('Pending', 'Completed', 'Failed') DEFAULT 'Pending',
  `order_status` ENUM('Pending', 'Confirmed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded') DEFAULT 'Pending',
  `shipping_address` TEXT NOT NULL,
  `coupon_code` VARCHAR(50) NULL,
  `discount_amount` DECIMAL(10,2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. OrderItems Table
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_id` INT NULL,
  `quantity` INT NOT NULL,
  `price` DECIMAL(10,2) NOT NULL, -- Fixed price at purchase
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Reviews Table
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `rating` INT NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
  `comment` TEXT NULL,
  `status` ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Coupons Table
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `discount` DECIMAL(5,2) NOT NULL, -- Discount percentage (e.g. 15.00 for 15% off)
  `expiry_date` DATE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
