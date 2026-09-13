const { io } = require('socket.io-client');
const { API_URL, getAuthClient } = require('./utils');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Socket.io Real-time Messaging', () => {
    let clientA, userA, cookieA;
    let clientB, userB, cookieB;
    let socketA, socketB;

    beforeAll(async () => {
        const authA = await getAuthClient('socket_user_a');
        clientA = authA.client;
        userA = authA.user;
        cookieA = authA.cookie;

        const authB = await getAuthClient('socket_user_b');
        clientB = authB.client;
        userB = authB.user;
        cookieB = authB.cookie;
    });

    afterAll(() => {
        if (socketA) socketA.disconnect();
        if (socketB) socketB.disconnect();
    });

    it('Should establish authenticated socket connections via JWT cookies', async () => {
        socketA = io(API_URL, {
            extraHeaders: { Cookie: cookieA },
            transports: ['websocket'] // Force websocket to avoid polling issues in tests
        });

        socketB = io(API_URL, {
            extraHeaders: { Cookie: cookieB },
            transports: ['websocket']
        });

        const connectPromise = (socket) => new Promise((resolve, reject) => {
            socket.on('connect', resolve);
            socket.on('connect_error', reject);
        });

        await Promise.all([connectPromise(socketA), connectPromise(socketB)]);
        
        expect(socketA.connected).toBe(true);
        expect(socketB.connected).toBe(true);
    });

    it('Should emit newMessage event to recipient when message is sent', async () => {
        const testMessage = "Hello from Socket.io Test!";
        
        // Setup listener on User B
        const msgPromise = new Promise((resolve) => {
            socketB.on('newMessage', (msg) => {
                resolve(msg);
            });
        });

        // User A sends message to User B via REST API
        const sendRes = await clientA.post(`/api/message/send/${userB._id}`, {
            message: testMessage
        });
        
        expect(sendRes.status).toBe(200);

        // Wait for the socket event
        const receivedMessage = await msgPromise;
        expect(receivedMessage).toBeDefined();
        expect(receivedMessage.message).toBe(testMessage);
        expect(receivedMessage.sender).toBe(userA._id);
    });
});
