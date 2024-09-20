require('dotenv').config();
const client = require('./config/database');
const express = require('express');
const cors = require('cors');
const { createServer } = require("http");
const { Server } = require("socket.io");
const { rateLimit } = require('express-rate-limit');

const app = express();
const httpServer = createServer(app);

app.use(cors())

client.connect()
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error(err);
    });

// (async () => {
//     //  making variables global
//     try {
//         app.set("accounts_coll", await client.db("LinkUp").collection("accounts"));
//     }
//     catch (err) { console.error(err); }
// })();


const min = 1
const limiter = rateLimit({
	windowMs: min * 60 * 1000, // 1 minutes
	limit: 5, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next) => {
        res.status(429).json({ type: "limit", message: "Too many requests. Please try again later" });
    }
})


app.use(express.json({ limit: "5kb" }));
app.use(limiter)


app.use("/register", require('./routes/authentication/register'));
app.use("/login", require('./routes/authentication/login'));
app.use("/verifyOTP", require('./routes/authentication/verifyOTP'));
app.use("/resendOTP", require('./routes/authentication/resendOTP'));
app.use("/forgot-password", require('./routes/authentication/forgotPass'));
app.use("/reset-password", require('./routes/authentication/resetPass'));




const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
});

const port = process.env.PORT || 3000;

httpServer.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})