const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'robin-01database-library1-database.c.aivencloud.com',
    user: 'avnadmin',
    password: '',
    database: 'skincare',
    port: 17330,
    connectTimeout: 10000,
    charset: 'utf8mb4',
});

module.exports = connection;
