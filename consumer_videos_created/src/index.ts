import amqp, { Connection } from 'amqplib';
import { Pool } from 'pg';

const queueName = process.env.QUEUENAME;
const queueHost = process.env.QUEUEHOST;

// Db config
const pgUser = process.env.PGUSER;
const pgUserPsswd = process.env.PGUSERPSSWD;
const pgHost = process.env.PGHOST;
const pgPort = Number(process.env.PGPORT);
const pool = new Pool({
    host: pgHost,
    user: pgUser,
    port: pgPort,
    password: pgUserPsswd,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

interface VideoCreated {
    videoId: string;
}

(async () => {
    let connection: Connection;
    try {
        console.log(`Consuming & Listening to ${queueHost} on queue ${queueName}`);
        console.log(
            `[db]: db is running at ${pgHost}:5433 user ${pgUser} and password ${pgUserPsswd}`,
        );

        connection = await amqp.connect(`amqp://${queueHost}`);
        const channel = await connection.createChannel();

        process.once('SIGINT', async () => {
            await channel.close();
            await connection.close();
        });

        await channel.assertQueue(queueName, { durable: false });
        await channel.consume(
            queueName,
            async (message) => {
                if (message) {
                    const videoCreated: VideoCreated = JSON.parse(message.content.toString());
                    console.log(" [x] Received '%s'", videoCreated);

                    // insert into db
                    const text = `INSERT INTO likes(video_id) VALUES($1) RETURNING *`;
                    const values = [videoCreated.videoId];
                    const queryResult = await pool.query(text, values);

                    console.log(queryResult.rows[0]);
                }
            },
            { noAck: true },
        );

        console.log(' [*] Waiting for messages. To exit press CTRL+C');
    } catch (err) {
        console.warn(err);
    }
})();
