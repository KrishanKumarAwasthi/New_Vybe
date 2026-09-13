import { Kafka } from "kafkajs"

const kafka = new Kafka({
    clientId: 'content-service-producer',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    // Confluent Cloud requires SASL/SSL — falls back to no auth for local dev
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_USERNAME ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD,
    } : undefined,
})

const producer = kafka.producer()

export const connectProducer = async () => {
    try {
        await producer.connect()
        console.log("[Content Service] Kafka Producer connected")
    } catch (error) {
        console.error("[Content Service] Failed to connect Kafka Producer:", error)
        // We do not crash the app if Kafka fails to connect, to maintain existing DB behavior
    }
}

export const publishEvent = async (topic, eventType, payload) => {
    try {
        await producer.send({
            topic,
            messages: [
                {
                    key: payload.eventId,
                    value: JSON.stringify({
                        eventType,
                        timestamp: new Date().toISOString(),
                        ...payload
                    })
                }
            ]
        })
    } catch (error) {
        console.error(`[Content Service] Failed to publish ${eventType} to ${topic}:`, error)
        // Explicitly catching this so the caller doesn't fail the HTTP request if publishing fails
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await producer.disconnect()
    process.exit(0)
})
