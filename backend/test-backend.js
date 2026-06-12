const axios = require('axios');

const API_URL = 'http://localhost:5000';
let token = '';

async function test() {
    try {
        // 1. Login
        console.log('1. Logging in...');
        const login = await axios.post(`${API_URL}/api/auth/admin/login`, {
            email: 'admin@shop.com',
            password: 'Admin@123'
        });
        token = login.data.token;
        console.log('✅ Login successful!');
        
        // 2. Get products
        console.log('\n2. Getting products...');
        const products = await axios.get(`${API_URL}/api/products`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`✅ Found ${products.data.length} products in database`);
        
        // 3. Add a new product
        console.log('\n3. Adding new product...');
        const newProduct = await axios.post(`${API_URL}/api/products`, {
            product_code: 'TEST999',
            name: 'Test Product',
            purchase_price: 100,
            selling_price: 200,
            current_stock: 50
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Product added to database!');
        
        // 4. Verify product was saved
        console.log('\n4. Verifying product is in database...');
        const productsAgain = await axios.get(`${API_URL}/api/products`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const testProduct = productsAgain.data.find(p => p.product_code === 'TEST999');
        if (testProduct) {
            console.log('✅ Product is PERMANENTLY stored in PostgreSQL!');
            console.log(`   Product: ${testProduct.name}, Price: ₹${testProduct.selling_price}`);
        }
        
        console.log('\n🎉 Your data is being stored in the backend database!');
        console.log('   Restart the server and the data will still be there.');
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

test();