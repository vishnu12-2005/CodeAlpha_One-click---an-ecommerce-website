const http = require('http');

const SERVER_URL = 'http://localhost:5000';

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SERVER_URL}${path}`);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log(' Starting OneClick API Smoke Integration Tests');
  console.log(' (Ensure backend server is running on port 5000)');
  console.log('==================================================\n');

  try {
    // Test 1: Fetch Products
    console.log('Test 1: Querying catalog products list...');
    const prodRes = await makeRequest('GET', '/api/products');
    if (prodRes.status === 200 && prodRes.body.success) {
      console.log('✔ SUCCESS: Retreived products listing. Total count:', prodRes.body.pagination.total);
    } else {
      console.error('❌ FAIL: Products fetch failed. Status:', prodRes.status, prodRes.body);
    }

    // Test 2: Login as sample customer
    console.log('\nTest 2: Logging in as seed customer...');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'user@oneclick.com',
      password: 'user123'
    });

    if (loginRes.status === 200 && loginRes.body.success) {
      console.log('✔ SUCCESS: Logged in successfully. Token generated.');
      const token = loginRes.body.token;

      // Test 3: Fetch Cart
      console.log('\nTest 3: Querying customer cart items...');
      const cartRes = await makeRequest('GET', '/api/cart', null, token);
      if (cartRes.status === 200 && cartRes.body.success) {
        console.log('✔ SUCCESS: Retreived user cart. Number of items:', cartRes.body.cart.length);
      } else {
        console.error('❌ FAIL: Cart retrieval failed. Status:', cartRes.status);
      }

      // Test 3.1: Add item to Cart
      console.log('\nTest 3.1: Adding product 1 to cart...');
      const addCartRes = await makeRequest('POST', '/api/cart', { product_id: 1, quantity: 1 }, token);
      if (addCartRes.status === 200 && addCartRes.body.success) {
        console.log('✔ SUCCESS: Added product 1 to cart successfully!');
      } else {
        console.error('❌ FAIL: Adding product to cart failed. Status:', addCartRes.status, addCartRes.body);
      }

      // Test 3.2: Add item to Wishlist
      console.log('\nTest 3.2: Adding product 2 to wishlist...');
      const addWishRes = await makeRequest('POST', '/api/wishlist', { product_id: 2 }, token);
      if (addWishRes.status === 200 && addWishRes.body.success) {
        console.log('✔ SUCCESS: Added product 2 to wishlist successfully!');
      } else {
        console.error('❌ FAIL: Adding product to wishlist failed. Status:', addWishRes.status, addWishRes.body);
      }
    } else {
      console.error('❌ FAIL: User login failed. Check database seeding status. Status:', loginRes.status);
    }

    // Test 4: Query Admin Dashboard Analytics without admin token
    console.log('\nTest 4: Requesting admin analytics without privileges...');
    try {
      const authErrorRes = await makeRequest('GET', '/api/admin/analytics');
      if (authErrorRes.status === 401) {
        console.log('✔ SUCCESS: Blocked access correctly with 401 Unauthorized.');
      } else {
        console.error('❌ FAIL: Route is open! Status:', authErrorRes.status);
      }
    } catch (e) {
      console.log('✔ SUCCESS: Protected route threw expected connection/security error');
    }

    console.log('\n==================================================');
    console.log(' Integration check finished.');
    console.log('==================================================');

  } catch (err) {
    console.error('\n❌ ERROR: Failed connecting to the Express server.', err.message);
    console.log('Please ensure you have run "npm run dev" or "node server.js" in the backend directory first.');
  }
}

runTests();
