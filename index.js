require('dotenv').config();
const client = require('./config/database');
const express = require('express');
const cors = require('cors');
const { createServer } = require("http");
const { Server } = require("socket.io");
const { rateLimit } = require('express-rate-limit');
const authenticator = require('./middlewares/auth');
const sizeof = require('object-sizeof');

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
	limit: 20, // Limit each IP to x requests per `window` (here, per y minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next) => {
        res.status(429).json({ type: "limit", message: "Too many requests. Please try again later" });
    }
})

app.use(express.json())
app.use(limiter)
app.use((req, res, next) => {
    const excluded_route = ['/setProfilePic'];
    // console.log("payload size : ", sizeof(req.body));
    if (excluded_route.includes(req.path)) {
        if (sizeof(req.body) > 200000) { // 200kb
            return res.status(400).json({ type: "size limit", message: "Request too large. Please try again later" });
        }
        next();
    }
    else {
        if (sizeof(req.body) > 5000) { // 500 bytes
            return res.status(400).json({ type: "size limit", message: "Request too large. Please try again later" });
        }
        next();
    }
})


app.use("/register", require('./routes/authentication/register'));
app.use("/login", require('./routes/authentication/login'));
app.use("/verifyOTP", require('./routes/authentication/verifyOTP'));
app.use("/resendOTP", require('./routes/authentication/resendOTP'));
app.use("/forgot-password", require('./routes/authentication/forgotPass'));
app.use("/reset-password", require('./routes/authentication/resetPass'));

app.use(authenticator);

app.use("/setProfilePic", require('./routes/service/setProfilePic'));
app.use("/deleteProfilePic", require('./routes/service/delProfilePic'));
app.use("/getUser", require('./routes/service/getUser'));

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