import express, { Express, NextFunction, Request, Response } from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import { Connection, Pool } from 'pg';
import amqp from 'amqplib';

dotenv.config();

const app: Express = express();

const pgUser = process.env.PGUSER;
const pgUserPsswd = process.env.PGUSERPSSWD;
const pgHost = process.env.PGHOST;
const pgPort = Number(process.env.PGPORT);
console.log(
    `[db]: db is running at ${pgHost}:${pgPort} user ${pgUser} and password ${pgUserPsswd}`,
);

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

// QUEUE CONFIG Video creation
const queue = 'video_liked';
const queueHost = process.env.VIDEOLIKEDQUEUEHOST;

// Express
app.use(cors()).use(express.json()).options('*', cors());

// Routes
app.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
        return res.send('Video Likes service is up...').status(200);
    } catch (error) {
        next(error);
    }
});

app.patch('/likes/:videoId', async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const videoId = req.params.videoId;

        const text = `UPDATE likes
                         SET likes_counter = likes.likes_counter + 1
                       WHERE likes.video_id = $1
                      RETURNING *`;
        const values = [videoId];

        const queryResult = await pool.query(text, values);
        console.log(queryResult.rows[0]);

        //// enqueue VideoCreated
        const videolikedEvent = { videoId: queryResult.rows[0].id };
        connection = await amqp.connect(`amqp://${queueHost}`);
        const channel = await connection.createChannel();
        await channel.assertQueue(queue, { durable: false });
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(videolikedEvent)));
        console.log(" [x] Sent '%s'", videolikedEvent);
        await channel.close();

        return res.status(200).send('');
    } catch (error) {
        next(error);
    }
});

// ports
const PORT = process.env.PORT;
const HOST = process.env.HOST;
const port = PORT || 3111;
const host = HOST || 'localhost';

app.listen(port, () => {
    console.log(`[server]: Server is running at http://${host}:${port}`);
});

export default app;
