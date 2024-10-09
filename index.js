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

const { black, bgGreen, bgRed } = require('ansis')

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
app.use("/findUser", require('./routes/service/findUser'));
app.use("/addContact", require('./routes/service/addContact'));

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["POST"],
    },
});

io.use(function (socket, next) {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, process.env.TOKEN_KEY, function (err, decoded) {
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
    const result = await accounts_coll.findOne({ user_id }, {
        projection: {
            _id: 0, display_name: 1, username: 1, email: 1, socket_ids: 1
        }
    });
    return result;
}

const addSocketId = async (user_id, socket_id) => {
    await accounts_coll.updateOne({ user_id }, { $push: { socket_ids: socket_id } });
}

const removeSocketIds = async (user_id, socket_ids) => {
    await accounts_coll.updateOne({ user_id }, { $pull: { socket_ids: { $in: [...socket_ids] } } });
}

async function getInActiveSocketIds(user_socket_ids) {
    if (!user_socket_ids.length) return [];

    // getting list of all connected socket ids
    const all_socket_ids = Array.from(await io.allSockets());
    // removing active socket ids
    user_socket_ids = user_socket_ids.filter((socket_id) => {
        return !all_socket_ids.includes(socket_id);
    })

    return user_socket_ids;
}

io.on("connection", async (socket) => {
    // getting basic user info from database
    const basicUserInfo = await getBasicUserInfo(socket.user.user_id);
    const active_user_sockets = basicUserInfo.socket_ids ? basicUserInfo.socket_ids : [];
    
    console.log(black.bgGreen(basicUserInfo.username));

    // removing inactive socket ids
    if (active_user_sockets.length) {
        const filtered_socket_ids = await getInActiveSocketIds(active_user_sockets);
        if (filtered_socket_ids) {
            // locally managing active socket ids
            active_user_sockets.filter((socket_id) => {
                return !filtered_socket_ids.includes(socket_id);
            })
            await removeSocketIds(socket.user.user_id, filtered_socket_ids);
        }
    }

    // adding active socket ids to local list
    active_user_sockets.push(socket.id);
    // updating socket ids in database
    await addSocketId(socket.user.user_id, socket.id);


    socket.on("disconnect", async (reason) => {
        console.log(black.bgRed(basicUserInfo.username));

        // locally managing active socket ids
        active_user_sockets.splice(active_user_sockets.indexOf(socket.id), 1);
        // updating socket ids in database
        await removeSocketIds(socket.user.user_id, [socket.id]);
        // updating last seen time, if no active connections
        if (active_user_sockets.length === 0) {
            accounts_coll.updateOne({ user_id: socket.user.user_id }, { $set: { last_seen: new Date() } });
        }
    });
});


const port = process.env.PORT || 3000;

httpServer.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})