import { Kafka } from "kafkajs"

const kafka = new Kafka({
    clientId: 'notification-service-consumer',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    // Confluent Cloud requires SASL/SSL — falls back to no auth for local dev
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_USERNAME ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD,
    } : undefined,
})

const consumer = kafka.consumer({ groupId: 'notification-service-group' })

export const connectConsumer = async (topics, eachMessageCallback) => {
    try {
        await consumer.connect()
        console.log("[Notification Service] Kafka Consumer connected")
        
        for (const topic of topics) {
            await consumer.subscribe({ topic, fromBeginning: true })
            console.log(`[Notification Service] Subscribed to topic: ${topic}`)
        }

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const payload = JSON.parse(message.value.toString())
                    await eachMessageCallback(payload, topic)
                } catch (error) {
                    console.error("[Notification Service] Error processing message:", error)
                }
            },
        })
    } catch (error) {
        console.error("[Notification Service] Failed to connect Kafka Consumer:", error)
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await consumer.disconnect()
    process.exit(0)
})
