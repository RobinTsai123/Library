const mysql = require('mysql2');
const { MongoClient, ServerApiVersion } = require('mongodb');
const neo4j = require('neo4j-driver');

// MySQL setup
const mysqlConnection = mysql.createConnection({
    host: 'robin-01database-library1-database.c.aivencloud.com',
    user: 'avnadmin',
    password: '',
    database: 'skincare',
    port: 17330,
    connectTimeout: 10000,
    charset: 'utf8mb4',
});

// Connect to MySQL
mysqlConnection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        process.exit(1); // Exit the process if connection fails
    }
    console.log('Connected to MySQL!');
});

// MongoDB setup
const mongoUri = "mongodb+srv://D5DatabaseProject:zTldmjgQkX58dGvc@databaseproject.aznccga.mongodb.net/?retryWrites=true&w=majority&appName=databaseProject";
const mongoClient = new MongoClient(mongoUri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function connectToMongoDB() {
    try {
        await mongoClient.connect();
        return mongoClient.db("skincare"); // Replace with your MongoDB database name
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        throw err;
    }
}

async function closeMongoDBConnection() {
    try {
        await mongoClient.close();
    } catch (err) {
        console.error('Error closing MongoDB connection:', err);
    }
}

// Neo4j setup
const neo4jUri = 'neo4j+s://849ba047.databases.neo4j.io'; // Replace with your Neo4j host and port
const neo4jUser = 'neo4j'; // Replace with your Neo4j username
const neo4jPassword = ''; // Replace with your Neo4j password

const neo4jDriver = neo4j.driver(
    neo4jUri,
    neo4j.auth.basic(neo4jUser, neo4jPassword)
);

async function connectToNeo4j() {
    try {
        return neo4jDriver.session(); // Create a session to interact with Neo4j
    } catch (err) {
        console.error('Error connecting to Neo4j:', err);
        throw err;
    }
}

async function closeNeo4jConnection(session) {
    try {
        await session.close(); // Close the session
    } catch (err) {
        console.error('Error closing Neo4j session:', err);
    }
}

// Export connections and functions
module.exports = {
    mysqlConnection,
    connectToMongoDB,
    closeMongoDBConnection,
    mongoClient,
    connectToNeo4j,
    closeNeo4jConnection,
    neo4jDriver
};
