const axios = require('axios');
const { API_URL, getAuthClient } = require('./utils');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Kafka Event Flow', () => {
    let clientA, clientB, userA, userB;

    beforeAll(async () => {
        // Setup two users
        const authA = await getAuthClient('kafka_user_a');
        clientA = authA.client;
        userA = authA.user;

        const authB = await getAuthClient('kafka_user_b');
        clientB = authB.client;
        userB = authB.user;
    });

    it('Should process USER_FOLLOWED event and create a notification', async () => {
        // User A follows User B
        const followRes = await clientA.get(`/api/user/follow/${userB._id}`);
        expect(followRes.status).toBe(200);
        expect(followRes.data.following).toBe(true);

        // Allow some time for Kafka consumer to process the event
        // (User Service -> Kafka -> Notification Service -> MongoDB)
        await delay(3000);

        // Fetch User B's notifications
        const notifRes = await clientB.get(`/api/user/getAllNotifications`);
        expect(notifRes.status).toBe(200);
        
        // Find the specific follow notification from User A
        const notifications = notifRes.data;
        const followNotif = notifications.find(n => n.type === 'follow' && n.sender._id === userA._id);
        
        expect(followNotif).toBeDefined();
        expect(followNotif.message).toMatch(/started following you/i);
    }, 10000); // Give the test more timeout for async delays

});
