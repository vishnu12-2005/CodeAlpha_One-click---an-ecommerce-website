# Production Deployment Instructions

This guide describes how to deploy the **OneClick** full-stack web application to production hosting environments.

---

## 1. Production Database Hosting

You will need a hosted MySQL database instance.

### Options:
1. **AWS RDS (Relational Database Service)**: Setup a Free-Tier MySQL database.
2. **DigitalOcean Managed Databases**: Premium reliable managed MySQL cluster.
3. **PlanetScale / Aiven**: Cloud-native serverless database host supporting MySQL connections.

### Setup Steps:
1. Create a database instance.
2. Obtain the database connection credentials:
   - Host domain
   - Port (usually 3306)
   - Master user and secure password
   - Database name (`oneclick_db`)
3. Open a terminal, connect using a database tool (e.g. DBeaver, MySQL Workbench), and run the statements in [schema.sql](file:///C:/Users/dp032/Documents/antigravity/intelligent-pascal/database/schema.sql) to initialize the production tables.

---

## 2. Deploying the Node.js / Express Backend

The backend is built as a stateless Node.js server. Since it also serves the static frontend files via `express.static`, you can run the entire site from a single server host.

### Recommended Providers:
* **Render**: Render is an excellent, developer-friendly web service host.
* **Railway**: Quick deployments directly connected to GitHub.
* **AWS Elastic Beanstalk / EC2**: Scale-out cloud servers.

### Deployment on Render:
1. Push your code repository to GitHub.
2. Log in to [Render](https://render.com/) and click **New** ➔ **Web Service**.
3. Link your GitHub repository.
4. Configure the Web Service settings:
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
5. Click **Advanced** and add the environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render handles the port routing automatically)
   - `DB_HOST`: *Your hosted database host*
   - `DB_USER`: *Your database user*
   - `DB_PASSWORD`: *Your database password*
   - `DB_DATABASE`: *Your database name*
   - `JWT_SECRET`: *A long, randomly generated secure key (e.g. 64-character hash)*
   - `JWT_EXPIRE`: `24h`
6. Click **Create Web Service**. Render will build and deploy the app.

---

## 3. High Performance CDN Optimization (Optional)

Since the frontend is composed of static HTML, CSS, and JS files (stored in `frontend/`), you can optimize loading times globally by decoupling the frontend and hosting it on a specialized CDN, while pointing AJAX requests to the backend server.

### Steps to Decouple:
1. **Frontend Hosting**: Deploy the `/frontend` directory to [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
2. **Backend API Domain**: Deploy the backend to a separate API subdomain (e.g., `api.oneclick.com`).
3. **Change Base API URL**: In [api.js](file:///C:/Users/dp032/Documents/antigravity/intelligent-pascal/frontend/js/api.js#L1), update the API host variable to point to your live backend domain:
   ```diff
   -const API_BASE = '/api';
   +const API_BASE = 'https://api.oneclick.com/api';
   ```
4. **CORS Settings**: In [server.js](file:///C:/Users/dp032/Documents/antigravity/intelligent-pascal/backend/server.js), ensure you configure CORS to allow requests originating from your Vercel/Netlify frontend URL.

---

## 4. Security Checklist for Production

* **HTTPS/SSL**: Ensure the site runs exclusively over HTTPS. Render, Vercel, and Netlify provide free SSL certificates out of the box.
* **Passwords**: Ensure the default admin password (`admin123`) is updated immediately in the database upon launch.
* **SQL Injection & XSS protection**: The application routes utilize parameterized SQL statements (`?` placeholders in mysql2) preventing SQL injection attacks, and inputs are checked in the validator middlewares.
* **JWT Secret Key**: Never commit your production `.env` files. Ensure the `JWT_SECRET` key is generated dynamically using a cryptographically secure generator.
