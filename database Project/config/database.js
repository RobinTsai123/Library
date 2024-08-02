const mysql = require('mysql2');
const { MongoClient, ServerApiVersion } = require('mongodb');

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
const mongoUri = "mongodb+srv://D5DatabaseProject:<password>@databaseproject.aznccga.mongodb.net/?retryWrites=true&w=majority&appName=databaseProject";
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

// Export connections and functions
module.exports = {
    mysqlConnection,
    connectToMongoDB,
    closeMongoDBConnection, // Export the function to close MongoDB connection
    mongoClient
};
