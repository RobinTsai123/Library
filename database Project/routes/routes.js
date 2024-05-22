const express = require('express');
const router = express.Router();

// Define routes for different views
router.get('/', (req, res) => {
    res.render('index'); // Render the index view
});

router.get('/backEnd', (req, res) => {
    res.render('backEnd'); // Render the about view
});

router.get('/frontEnd', (req, res) => {
    res.render('frontEnd'); // Render the contact view
});

// Export the router
module.exports = router;