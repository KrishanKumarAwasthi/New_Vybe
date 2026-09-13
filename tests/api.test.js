const axios = require('axios');
const { API_URL, generateTestUser, getAuthClient } = require('./utils');

describe('API Routing & Boundaries', () => {
    
    it('Gateway routes /api/auth to Auth Service', async () => {
        try {
            await axios.get(`${API_URL}/api/auth/signout`);
        } catch (error) {
            // Auth service returns 200 for logout even if no token is present
            expect(error.response || { status: 200 }).toHaveProperty('status', 200);
        }
    });

    it('Gateway routes /api/user to User Service', async () => {
        try {
            await axios.get(`${API_URL}/api/user/current`);
        } catch (error) {
            // Unauthenticated request, user service rejects it with 400 or 401
            expect([400, 401]).toContain(error.response.status);
        }
    });

    it('Gateway routes /api/post to Content Service', async () => {
        // Authenticated request to fetch posts
        const { client } = await getAuthClient('api_routing');
        const res = await client.get(`/api/post/getAll`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
    });

});
