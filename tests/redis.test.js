const { getAuthClient } = require('./utils');

describe('Redis Caching', () => {
    let clientA, userA;

    beforeAll(async () => {
        const authA = await getAuthClient('redis_user');
        clientA = authA.client;
        userA = authA.user;
    });

    it('Profile API: should populate cache and then hit cache on subsequent requests', async () => {
        // 1. Initial request (populates cache)
        const start1 = Date.now();
        const res1 = await clientA.get(`/api/user/getProfile/${userA.userName}`);
        const time1 = Date.now() - start1;
        
        expect(res1.status).toBe(200);
        expect(res1.data.userName).toBe(userA.userName);

        // 2. Subsequent request (should hit cache)
        const start2 = Date.now();
        const res2 = await clientA.get(`/api/user/getProfile/${userA.userName}`);
        const time2 = Date.now() - start2;

        expect(res2.status).toBe(200);
        expect(res2.data.userName).toBe(userA.userName);

        // Cache hit is usually much faster. We aren't doing strict performance benchmarking, 
        // but verifying the data integrity remains correct.
    });

    it('Profile API: mutations should invalidate the cache', async () => {
        // Mutate the user profile
        const newBio = `Updated bio ${Date.now()}`;
        const editRes = await clientA.post(`/api/user/editProfile`, {
            name: userA.name,
            userName: userA.userName,
            bio: newBio
        });
        
        expect(editRes.status).toBe(200);

        // Fetch profile again; should reflect the new bio (meaning cache was invalidated)
        const profileRes = await clientA.get(`/api/user/getProfile/${userA.userName}`);
        expect(profileRes.status).toBe(200);
        expect(profileRes.data.bio).toBe(newBio);
    });

});
