import express, { Express, NextFunction, Request, Response } from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import { Pool } from 'pg';
import amqp from 'amqplib';

dotenv.config();

const app: Express = express();

// Db config
const pgUser = process.env.PGUSER;
const pgUserPsswd = process.env.PGUSERPSSWD;
const pgHost = process.env.PGHOST;
console.log(`[db]: db is running at ${pgHost}:5432 user ${pgUser} and password ${pgUserPsswd}`);

const pool = new Pool({
    host: pgHost,
    user: pgUser,
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
const queue = 'video_created';
const queueHost = process.env.VIDEOCREATEDQUEUEHOST;

//////////////////
//////////////////
app.use(cors()).use(express.json()).options('*', cors());

// Routes
app.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
        return res.send('Video service is up...').status(200);
    } catch (error) {
        next(error);
    }
});

app.post('/videos', async (req: Request, res: Response, next: NextFunction) => {
    let connection;
    try {
        const newVideo = {
            title: req.body.title,
            duration: req.body.duration,
        };

        // insert into db
        const text = 'INSERT INTO videos(title, duration) VALUES($1, $2) RETURNING *';
        const values = [newVideo.title, newVideo.duration];
        const queryResult = await pool.query(text, values);
        console.log(queryResult.rows[0]);
        

        //// enqueue VideoCreated
        const videoCreatedEvent = { videoId: queryResult.rows[0].id };
        connection = await amqp.connect(`amqp://${queueHost}`);
        const channel = await connection.createChannel();
        await channel.assertQueue(queue, { durable: false });
        channel.sendToQueue(queue, Buffer.from(JSON.stringify(videoCreatedEvent)));
        console.log(" [x] Sent '%s'", videoCreatedEvent);
        await channel.close();

        return res.status(201).send('');
    } catch (error) {
        next(error);
    } finally {
        if (connection) await connection.close();
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
