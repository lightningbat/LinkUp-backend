const { MongoClient } = require("mongodb");

const username = encodeURIComponent(process.env.MONGO_USERNAME);
const password = encodeURIComponent(process.env.MONGO_PASSWORD);
const clusterUrl = process.env.MONGO_CLUSTER;

const uri = `mongodb+srv://${username}:${password}@${clusterUrl}/?retryWrites=true&w=majority`;

const client = new MongoClient(uri);

module.exports = client