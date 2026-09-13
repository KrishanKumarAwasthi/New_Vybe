const axios = require('axios');
const { API_URL, generateTestUser } = require('./utils');

describe('Authentication', () => {
    let testUser = generateTestUser('auth_test');
    let authCookie;

    it('Sign Up: should create a new user and return a cookie', async () => {
        const res = await axios.post(`${API_URL}/api/auth/signup`, testUser);
        expect(res.status).toBe(201);
        expect(res.data).toHaveProperty('_id');
        expect(res.data.email).toBe(testUser.email);
        expect(res.headers['set-cookie']).toBeDefined();
        authCookie = res.headers['set-cookie'][0];
    });

    it('Sign In: should log the user in and return a new cookie', async () => {
        const res = await axios.post(`${API_URL}/api/auth/signin`, {
            userName: testUser.userName,
            password: testUser.password
        });
        expect(res.status).toBe(200);
        expect(res.data.email).toBe(testUser.email);
        expect(res.headers['set-cookie']).toBeDefined();
        authCookie = res.headers['set-cookie'][0]; // Update for subsequent tests
    });

    it('Protected Routes: should reject unauthenticated requests', async () => {
        try {
            await axios.get(`${API_URL}/api/user/current`);
            // Force failure if the above line doesn't throw
            expect(true).toBe(false); 
        } catch (error) {
            expect([400, 401]).toContain(error.response.status);
            // expect(error.response.data.message).toMatch(/unauthorized/i);
        }
    });

    it('Protected Routes: should accept authenticated requests', async () => {
        const res = await axios.get(`${API_URL}/api/user/current`, {
            headers: { Cookie: authCookie }
        });
        expect(res.status).toBe(200);
        expect(res.data.email).toBe(testUser.email);
    });

    it('Invalid Auth: should reject invalid passwords', async () => {
        try {
            await axios.post(`${API_URL}/api/auth/signin`, {
                userName: testUser.userName,
                password: 'wrong_password'
            });
            expect(true).toBe(false);
        } catch (error) {
            expect(error.response.status).toBe(400);
            expect(error.response.data.message).toMatch(/incorrect password/i);
        }
    });
});
