const axios = require('axios');
const API_URL = 'http://localhost:8000';

const generateTestUser = (prefix) => ({
    name: `${prefix} Name`,
    userName: `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    email: `${prefix}_${Date.now()}@example.com`,
    password: 'password123',
    gender: 'male'
});

const getAuthClient = async (prefix) => {
    const userPayload = generateTestUser(prefix);
    const res = await axios.post(`${API_URL}/api/auth/signup`, userPayload);
    const cookie = res.headers['set-cookie'][0];
    const user = res.data;
    
    // Create an axios instance that automatically attaches the cookie
    const client = axios.create({
        baseURL: API_URL,
        headers: { Cookie: cookie }
    });
    
    return { client, user, cookie };
};

module.exports = {
    API_URL,
    generateTestUser,
    getAuthClient
};
