const cassandra = require('cassandra-driver');
const fs = require('fs');

const auth = new cassandra.auth.PlainTextAuthProvider(process.env.CASSANDRA_USERNAME, process.env.CASSANDRA_PASSWORD);

const sslOptions1 = {
    ca: [fs.readFileSync(__dirname + "/sf-class2-root.crt", "utf-8")],
    host: process.env.CASSANDRA_HOST,
    rejectUnauthorized: true,
};
const client = new cassandra.Client({
    contactPoints: ["cassandra"],
    localDataCenter: "datacenter1",
    keyspace: "aicte",
    credentials: { username: "admin", password: "admin123" },
  });

const db = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_HOST],
    localDataCenter: process.env.AWS_REGION,
    authProvider: auth,
    sslOptions: sslOptions1,
    protocolOptions: { port: 9142 },
    queryOptions: { consistency: cassandra.types.consistencies.localQuorum },
});
async function connectDB(){
    try{
        await db.connect();
        console.log('Connected to Cassandra');
        // await client.connect()
    }catch(error){
        console.log(error);
    }
}

module.exports = {
    connectDB,db,
};