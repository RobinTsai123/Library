const express = require('express');
const path = require('path');
const routes = require('./routes/routes');
const app = express();

const port = 3000;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', routes);

app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
