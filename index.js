require('dotenv').config();
const client = require('./config/database');
const express = require('express');
const cors = require('cors');
const { createServer } = require("http");
const { Server } = require("socket.io");
const { rateLimit } = require('express-rate-limit');
const authenticator = require('./middlewares/auth');
const sizeof = require('object-sizeof');

const jwt = require("jsonwebtoken");

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
        methods: ["POST"],
    },
});

io.use(function(socket, next) {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, process.env.TOKEN_KEY, function(err, decoded) {
            if (err) {
                return next(new Error("Invalid token"));
            }
            socket.user = decoded;
            next();
        });
    } else {
        next(new Error("Token not found"));
    }
})

const accounts_coll = client.db("LinkUp").collection("accounts");

async function getBasicUserInfo(user_id) {
    const result = await accounts_coll.findOne({ user_id }, { projection: { 
        _id: 0, display_name: 1, username: 1, email: 1
    } });
    return result;
}

async function updateSocketIdOfUser(method, user_id, socket_id) {
    if (method === "add") {
        await accounts_coll.updateOne({ user_id }, { $push: { socket_ids: socket_id } });
    } else if (method === "remove") {
        await accounts_coll.updateOne({ user_id }, { $pull: { socket_ids: socket_id } });
    }
}

io.on("connection", async (socket) => {
    const basicUserInfo = await getBasicUserInfo(socket.user.user_id);
    await updateSocketIdOfUser('add', socket.user.user_id, socket.id);
    console.log("a user connected");
    console.table({...basicUserInfo, socket_id: socket.id});


    socket.on("disconnect", async (reason) => {
        await updateSocketIdOfUser('remove', socket.user.user_id, socket.id);
        console.log("a user disconnected");
        console.table({...basicUserInfo, socket_id: socket.id});
        console.log(reason);
    });
});


const port = process.env.PORT || 3000;

httpServer.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})