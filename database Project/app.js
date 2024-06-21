const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const routes = require('./routes/routes'); // Adjust the path as per your project structure

const app = express();
const port = process.env.PORT || 3000;

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware
app.use(session({
    secret: 'Slaytons Skincare', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true
}));

// Set the view engine to ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to set global variables
app.use((req, res, next) => {
    // Example of setting global variables (if needed)
    res.locals.currentUser = req.session.user; // Example: storing user information
    next();
});

// Routes
app.use('/', routes);

// Handle 404 errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(400).send('Not Found!');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).render('error', { error: err.message }); // Render the error view
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
