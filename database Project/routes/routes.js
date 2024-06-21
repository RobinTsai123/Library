const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const connection = require('../config/database'); // Adjust the path as per your project structure
const utils = require('../public/javascript/utils'); // Adjust the path as per your project structure

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        if (req.session.user && req.session.user.role === 'admin') {
            next();
        } else if (req.session.user) {
            res.status(403).send('Access Forbidden');
        } else {
            res.status(401).send('Unauthorized');
        }
    } catch (err) {
        next(err);
    }
};

// Middleware to check if user is logged in
const preventUnauthorisedAccess = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
};

// Middleware to prevent logged-in users from accessing pages like login or signup
const preventLoggedInAccess = (req, res, next) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            res.redirect('/admin/index');
        } else {
        // User is logged in, redirect to another page (e.g., dashboard)
            res.redirect('/product_list');
        }
    } else {
        // User is not logged in, proceed to render the login page
        next();
    }
};

// Middleware to check if user is logged in
router.use((req, res, next) => {
    res.locals.loggedIn = req.session.user ? true : false;
    next();
});

// Function to execute SQL query with promise
function queryPromise(sql, params) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}
// Default routes
router.get('/', preventLoggedInAccess,(req, res) => {
    res.render('index');
});

// admin home page accessible only to admins
router.get('/admin/index', preventUnauthorisedAccess, isAdmin, (req, res) => {
    const user = req.session.user;
    res.render('admin/index', {'user': user}); // Render the admin view, accessible only to admins
});

// Route to fetch and display product list for users
router.get('/product_list', preventUnauthorisedAccess, (req, res, next) => {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Number of products per page
    const offset = (page - 1) * limit;
    const labelFilter = req.query.label || '';
    const brandFilter = req.query.brand || '';
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || 1000000000;

    // SQL query to fetch brands for filter options
    const brandsQuery = 'SELECT * FROM Brands';

    // SQL count query with JOIN
    const countQuery = `
        SELECT COUNT(*) as count 
        FROM Products p 
        LEFT JOIN Brands b ON p.brandID = b.BrandID 
        WHERE (p.label LIKE ?) 
          AND (p.price BETWEEN ? AND ?) 
          AND (b.brand_name LIKE ?)
    `;

    // SQL products query with JOIN
    const productsQuery = `
        SELECT p.*, b.brand_name 
        FROM Products p 
        LEFT JOIN Brands b ON p.brandID = b.BrandID 
        WHERE (p.label LIKE ?) 
          AND (p.price BETWEEN ? AND ?) 
          AND (b.brand_name LIKE ?)
        ORDER BY p.ProdID ASC
        LIMIT ? OFFSET ?
    `;

    const labelPattern = `%${labelFilter}%`;
    const brandPattern = `%${brandFilter}%`;

    // Execute count query to get total count of products
    connection.query(countQuery, [labelPattern, minPrice, maxPrice, brandPattern], (err, countResult) => {
        if (err) {
            return next(err);
        }

        const totalProducts = countResult[0].count;
        const totalPages = Math.ceil(totalProducts / limit);

        // Execute products query to fetch products for the current page
        connection.query(productsQuery, [labelPattern, minPrice, maxPrice, brandPattern, limit, offset], (err, productsResult) => {
            if (err) {
                return next(err);
            }

            // Execute brands query to fetch brands for filter options
            connection.query(brandsQuery, (err, brandResults) => {
                if (err) {
                    return next(err);
                }

                // Render the user products view with fetched data
                res.render('product_list', {
                    brands: brandResults,
                    products: productsResult,
                    page: page,
                    totalPages: totalPages,
                    labelFilter: labelFilter,
                    brandFilter: brandFilter,
                    minPrice: minPrice,
                    maxPrice: maxPrice,
                    user: user
                });
            });
        });
    });
});

// individual product page
router.get('/product_detail/:id', preventUnauthorisedAccess, (req, res, next) => {
    const productId = req.params.id;
    const userId = req.session.user.id;

    const productQuery = `
        SELECT p.*, b.brand_name, s.type_name as skin_type_name, s.description as skin_type_description 
        FROM Products p
        JOIN Brands b ON p.brandID = b.BrandID
        JOIN Skin_Types s ON p.skin_typeID = s.SkinTypeID
        WHERE p.ProdID = ?
    `;

    const reviewsQuery = `
        SELECT r.*, u.username 
        FROM Reviews r
        JOIN Users u ON r.userID = u.UserID
        WHERE r.prodID = ?
        ORDER BY r.userID = ? DESC, r.created_at DESC
    `;

    connection.query(productQuery, [productId], (err, productResults) => {
        if (err) {
            return next(err);
        }

        if (productResults.length === 0) {
            return res.status(404).send('Product not found');
        }

        const product = productResults[0];

        connection.query(reviewsQuery, [productId, userId], (err, reviewResults) => {
            if (err) {
                console.error('Error fetching reviews:', err);
                return next(err); // Handle error
            }

            // Separate current user's review from others
            const currentUserReview = reviewResults.find(review => review.userID === userId);
            const otherReviews = reviewResults.filter(review => review.userID !== userId);

            // Combine reviews with current user's review prioritized first
            const combinedReviews = [];
            if (currentUserReview) {
                combinedReviews.push(currentUserReview);
            }
            combinedReviews.push(...otherReviews);

            res.render('product_detail', {
                title: 'Product Details', // Pass any title or variables needed for the layout
                body: '', // Pass any other variables needed for the layout
                product: product,
                reviews: combinedReviews,
                userHasReviewed: !!currentUserReview, // Boolean flag if current user has reviewed
                user: req.session.user
            });
        });
    });
});

// Route to handle updating a review
router.post('/update_review/:productId', preventUnauthorisedAccess, (req, res, next) => {
    const productId = req.params.productId;
    const userId = req.session.user.id;
    const { userRating, reviewText } = req.body;

    // Assuming you have an update operation in your database
    const updateReviewQuery = `
        UPDATE Reviews
        SET user_rating = ?, review = ?, created_at = NOW()
        WHERE prodID = ? AND userID = ?
    `;

    connection.query(updateReviewQuery, [userRating, reviewText, productId, userId], (err, updateResult) => {
        if (err) {
            console.error('Error updating review:', err);
            return next(err);
        }
        // Redirect to the product detail page after update
        res.redirect(`/product_detail/${productId}`);
    });
});

// Route to handle adding a review
router.post('/add_review/:productId', preventUnauthorisedAccess, (req, res, next) => {
    const productId = req.params.productId;
    const userId = req.session.user.id;
    const { userRating, reviewText } = req.body;

    // Assuming you have an insert operation in your database
    const insertReviewQuery = `
        INSERT INTO Reviews (prodID, userID, user_rating, review, created_at)
        VALUES (?, ?, ?, ?, NOW())
    `;

    connection.query(insertReviewQuery, [productId, userId, userRating, reviewText], (err, insertResult) => {
        if (err) {
            console.error('Error adding review:', err);
            return next(err);
        }
        // Redirect to the product detail page after insertion
        res.redirect(`/product_detail/${productId}`);
    });
});

// Route to handle deleting a review
router.get('/delete_review/:productId', preventUnauthorisedAccess, (req, res, next) => {
    const productId = req.params.productId;
    const userId = req.session.user.id;

    // Assuming you have a delete operation in your database
    const deleteReviewQuery = `
        DELETE FROM Reviews
        WHERE prodID = ? AND userID = ?
    `;

    connection.query(deleteReviewQuery, [productId, userId], (err, deleteResult) => {
        if (err) {
            console.error('Error deleting review:', err);
            return next(err);
        }

        // Redirect to the product detail page after deletion
        res.redirect(`/product_detail/${productId}`);
    });
});

// profile page
router.get('/profile', preventUnauthorisedAccess, (req, res) => {
    const userId = req.session.user.id;
    const sql = 'SELECT * FROM Users WHERE UserID = ?';
    connection.query(sql, [userId], (err, results) => {
        if (err) {
            return next(err);
        }
        res.render('profile', { user: results[0] });
    });
});

// delete viewer user account
router.get('/delete_profile', preventUnauthorisedAccess, (req, res, next) => {
    const userId = req.session.user.id;
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        const sql = 'DELETE FROM Users WHERE UserID = ?';
        connection.query(sql, [userId], (err, result) => {
            if (err) {
                return next(err);
            }
            res.redirect('/');
        });
    });
});

// edit profile page
router.get('/edit_profile', preventUnauthorisedAccess, (req, res) => {
    const userId = req.session.user.id;
    const sql = 'SELECT * FROM Users WHERE UserID = ?';
    connection.query(sql, [userId], (err, results) => {
        if (err) {
            return next(err);
        }
        res.render('edit_profile', { user: results[0] });
    });
});

// submit edit profile form
router.post('/edit_profile', preventUnauthorisedAccess, (req, res, next) => {
    const userId = req.session.user.id;
    const { username, email, password, age, gender } = req.body;
    console.log(userId, username, email, password, age, gender);

    // Update query without password
    let sql = 'UPDATE Users SET username = ?, email = ?, age = ?, gender = ? WHERE UserID = ?';
    let params = [username, email, age, gender, userId];

    // If password is provided, include it in the update query
    if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        sql = 'UPDATE Users SET username = ?, email = ?, password = ?, age = ?, gender = ? WHERE UserID = ?';
        params = [username, email, hashedPassword, age, gender, userId];
    }

    connection.query(sql, params, (err, results) => {
        if (err) {
            return next(err);
        }
        res.redirect('/profile');
    });
});

// signup page
router.get('/signup', preventLoggedInAccess, (req, res) => {
    res.render('signup');
});

// submit signup form
router.post('/signup', preventLoggedInAccess, (req, res, next) => {
    const { role, username, email, password, age, gender } = req.body;

    // Hash the password before storing it (you can use bcrypt for this)
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = 'INSERT INTO Users (role, username, email, password, age, gender) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [role, username, email, hashedPassword, age, gender];

    connection.query(sql, params, (err, results) => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});

// login page
router.get('/login', preventLoggedInAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); // Prevent caching
    const error_msg = req.session.error_msg;
    req.session.error_msg = null; // Clear the session after retrieving the error message
    res.render('login', { error_msg: error_msg });
});

// change password page
router.post('/change-password', preventUnauthorisedAccess, (req, res) => {
    const userId = req.session.user.id; // Assume user ID is stored in session
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;

    // Fetch the user's current password hash from the database
    const sqlFetch = 'SELECT password FROM Users WHERE id = ?';
    connection.query(sqlFetch, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching password:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const storedPasswordHash = results[0].password;

        // Compare the current password with the stored hash
        bcrypt.compare(currentPassword, storedPasswordHash, (err, match) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!match) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            // Hash the new password
            bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
                if (err) {
                    console.error('Error hashing new password:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                // Update the password in the database
                const sqlUpdate = 'UPDATE Users SET password = ? WHERE id = ?';
                connection.query(sqlUpdate, [hashedPassword, userId], (err, result) => {
                    if (err) {
                        console.error('Error updating password:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    res.status(200).json({ message: 'Password updated successfully' });
                });
            });
        });
    });
});

// login route
router.post('/login', preventLoggedInAccess, (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM Users WHERE username = ?';
    connection.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.session.error_msg = 'Internal server error';
            return res.redirect('/login');
        }

        if (results.length > 0) {
            const user = results[0];
            bcrypt.compare(password, user.password, (err, match) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    req.session.error_msg = 'Internal server error';
                    return res.redirect('/login');
                } 
                
                if (match) {
                    // Store user information in session
                    req.session.user = {
                        id: user.UserID,
                        username: user.username,
                        role: user.role // Assuming your user table has a 'role' column
                    };
                    console.log('User logged in:', req.session.user)

                    // Redirect to appropriate route based on user role
                    if (user.role === 'admin') {
                        return res.redirect('/admin/index');
                    } else {
                        return res.redirect('/product_list');
                    }
                } else {
                    req.session.error_msg = 'Invalid username or password';
                    return res.redirect('/login');
                }
            });
        } else {
            req.session.error_msg = 'Invalid username or password';
            return res.redirect('/login');
        }
    });
});

// logout route
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.redirect('/');
    });
});

// Route for products with pagination and filters
router.get('/admin/products', isAdmin, (req, res, next) => {
    const truncateText = utils.truncateText;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of products per page
    const offset = (page - 1) * limit;
    const labelFilter = req.query.label || '';
    const brandFilter = req.query.brand || ''; // New brand filter parameter
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || 1000000000;

    const brandQeury = 'SELECT * FROM Brands';

    // Count query with JOIN
    const countQuery = 'SELECT COUNT(*) as count FROM Products p LEFT JOIN Brands b ON p.brandID = b.BrandID WHERE (p.label LIKE ?) AND (p.price BETWEEN ? AND ?) AND (b.brand_name LIKE ?)';

    // Products query with JOIN
    const productsQuery = `
        SELECT p.*, b.brand_name 
        FROM Products p 
        LEFT JOIN Brands b ON p.brandID = b.BrandID 
        WHERE (p.label LIKE ?) AND (p.price BETWEEN ? AND ?) AND (b.brand_name LIKE ?)
        ORDER BY p.ProdID ASC
        LIMIT ? OFFSET ?
    `;

    const labelPattern = `%${labelFilter}%`;
    const brandPattern = `%${brandFilter}%`;

    connection.query(countQuery, [labelPattern, minPrice, maxPrice, brandPattern], (err, countResult) => {
        if (err) {
            return next(err);
        }
        const totalProducts = countResult[0].count;
        const totalPages = Math.ceil(totalProducts / limit);

        connection.query(productsQuery, [labelPattern, minPrice, maxPrice, brandPattern, limit, offset], (err, productsResult) => {
            if (err) {
                return next(err);
            }
            connection.query(brandQeury, (err, brandResults) => {
                if (err) {
                    return next(err);
                }
                res.render('admin/products', {
                    brands: brandResults,
                    products: productsResult,
                    page: page,
                    totalPages: totalPages,
                    labelFilter: labelFilter,
                    brandFilter: brandFilter,
                    minPrice: minPrice,
                    maxPrice: maxPrice,
                    truncateText: truncateText
                });
            });
        });
    });
});

// Route to admin user management page
router.get('/admin/users', isAdmin, (req, res, next) => {
    const { role = '', page = 1 } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;
    let sql = 'SELECT * FROM Users WHERE 1=1';
    let countSql = 'SELECT COUNT(*) AS count FROM Users WHERE 1=1';
    const params = [];
    const countParams = [];

    if (role) {
        sql += ' AND role = ?';
        countSql += ' AND role = ?';
        params.push(role);
        countParams.push(role);
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    connection.query(countSql, countParams, (err, countResults) => {
        if (err) {
            return next(err);
        }
        const totalUsers = countResults[0].count;
        const totalPages = Math.ceil(totalUsers / limit);

        connection.query(sql, params, (err, results) => {
            if (err) {
                return next(err);
            }
            res.render('admin/users', {
                users: results,
                page: parseInt(page, 10),
                totalPages,
                roleFilter: role,
            });
        });
    });
});

// Route to show the add user form
router.get('/admin/add_user', isAdmin, (req, res, next) => {
    res.render('admin/add_user');
});

// Route to handle the form submission
router.post('/admin/add_user', isAdmin, (req, res, next) => {
    const { role, username, email, password, age, gender } = req.body;

    // Hash the password before storing it (you can use bcrypt for this)
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = 'INSERT INTO Users (role, username, email, password, age, gender) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [role, username, email, hashedPassword, age, gender];

    connection.query(sql, params, (err, results) => {
        if (err) {
            return next(err);
        }
        res.redirect('/admin/users');
    });
});

// Route delete user
router.post('/admin/users/:id/delete', isAdmin, (req, res, next) => {
    const userId = req.params.id;
    if (userId == req.session.user.id) {
        return res.status(400).send('You cannot delete your own account');
    } else {
        const sql = 'DELETE FROM Users WHERE UserID = ?';
        connection.query(sql, [userId], (err, result) => {
            if (err) {
                return next(err);
            }
            res.redirect('/admin/users');
        });
    }
});

// Route to show the edit user form
router.get('/admin/users/:id/edit', isAdmin, (req, res, next) => {
    const userId = req.params.id;
    const sql = 'SELECT * FROM Users WHERE UserID = ?';

    connection.query(sql, [userId], (err, results) => {
        if (err) {
            return next(err);
        }
        if (results.length === 0) {
            return res.status(404).send('User not found');
        }
        res.render('admin/edit_user', { user: results[0] });
    });
});

// Route to submit the edit user form
router.post('/admin/users/:id/edit', isAdmin, (req, res, next) => {
    const userId = req.params.id;
    const { role, username, email, password, age, gender } = req.body;

    // Update query without password
    let sql = 'UPDATE Users SET role = ?, username = ?, email = ?, age = ?, gender = ? WHERE UserID = ?';
    let params = [role, username, email, age, gender, userId];

    // If password is provided, include it in the update query
    if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        sql = 'UPDATE Users SET role = ?, username = ?, email = ?, password = ?, age = ?, gender = ? WHERE UserID = ?';
        params = [role, username, email, hashedPassword, age, gender, userId];
    }

    connection.query(sql, params, (err, results) => {
        if (err) {
            return next(err);
        }
        res.redirect('/admin/users');
    });
});

// Route to show the add product form
router.get('/admin/add_product', isAdmin, (req, res, next) => {
    const brandSql = 'SELECT * FROM Brands ORDER BY brand_name ASC';
    const skinTypeSql = 'SELECT * FROM Skin_Types';
    const ingredientsSql = 'SELECT * FROM Ingredients ORDER BY ing_name ASC';

    connection.query(brandSql, (err, brandResults) => {
        if (err) {
            return next(err);
        }

        connection.query(skinTypeSql, (err, skinTypeResults) => {
            if (err) {
                return next(err);
            }

            connection.query(ingredientsSql, (err, ingredientResults) => {
                if (err) {
                    return next(err);
                }

                res.render('admin/add_product', {
                    brands: brandResults,
                    skinTypes: skinTypeResults,
                    ingredients: ingredientResults // Pass ingredients to the view
                });
            });
        });
    });
});


// Route to handle the form submission of adding a product
router.post('/admin/add_product', isAdmin, (req, res, next) => {
    const { name, label, brandID, price, skin_typeID, ingredients } = req.body;

    const sql = 'INSERT INTO Products (name, label, brandID, price, skin_typeID) VALUES (?, ?, ?, ?, ?)';
    const params = [name, label, brandID, price, skin_typeID];

    connection.query(sql, params, (err, results) => {
        if (err) {
            return next(err);
        }

        const prodID = results.insertId;

        // Insert ingredients into Prod_Ing_Mapping
        if (Array.isArray(ingredients) && ingredients.length > 0) {
            const mappingSql = 'INSERT INTO Prod_Ing_Mapping (ProdID, IngID) VALUES ?';
            const mappingParams = ingredients.map(ingID => [prodID, ingID]);

            connection.query(mappingSql, [mappingParams], (err) => {
                if (err) {
                    return next(err);
                }

                res.redirect('/admin/products');
            });
        } else {
            res.redirect('/admin/products');
        }
    });
});

// Route delete product
router.post('/admin/products/:id/delete', isAdmin, (req, res, next) => {
    const id = req.params.id;
    // Delete mappings from Prod_Ing_Mapping table
    const deleteMappingsSql = 'DELETE FROM Prod_Ing_Mapping WHERE ProdID = ?';
    connection.query(deleteMappingsSql, [id], (err, deleteMappingsResult) => {
        if (err) {
            return next(err);
        }

        // Delete product from Products table
        const deleteProductSql = 'DELETE FROM Products WHERE ProdID = ?';
        connection.query(deleteProductSql, [id], (err, deleteProductResult) => {
            if (err) {
                return next(err);
            }
            res.redirect('/admin/products');
        });
    });
});

// GET route to render edit product form
router.get('/admin/products/:id/edit', isAdmin, (req, res, next) => {
    const { id } = req.params;

    // Fetch product details based on ProdID
    let sql = 'SELECT * FROM Products WHERE ProdID = ?';
    connection.query(sql, [id], (err, productResults) => {
        if (err) {
            return next(err);
        }

        if (productResults.length === 0) {
            return res.status(404).send('Product not found');
        }

        const product = productResults[0];

        // Fetch brands, skinTypes, and ingredients for dropdowns
        const brandSql = 'SELECT * FROM Brands ORDER BY brand_name ASC';
        const skinTypeSql = 'SELECT * FROM Skin_Types';
        const ingredientsSql = 'SELECT * FROM Ingredients ORDER BY ing_name ASC';

        Promise.all([
            queryPromise(brandSql),
            queryPromise(skinTypeSql),
            queryPromise(ingredientsSql),
        ])
        .then(([brands, skinTypes, ingredients]) => {
            // Fetch product's associated ingredients
            const prodIngSql = 'SELECT IngID FROM Prod_Ing_Mapping WHERE ProdID = ?';
            connection.query(prodIngSql, [id], (err, prodIngResults) => {
                if (err) {
                    return next(err);
                }

                const productIngredients = prodIngResults.map(row => row.IngID);

                // Render edit_product.ejs with fetched data
                res.render('admin/edit_product', {
                    title: 'Edit Product',
                    product,
                    brands,
                    skinTypes,
                    ingredients,
                    productIngredients,
                });
            });
        })
        .catch(err => next(err));
    });
});

// POST route to handle edit product form submission
router.post('/admin/products/:id', isAdmin, (req, res, next) => {
    const { id } = req.params;
    const { name, label, brandID, price, skin_typeID, ingredients } = req.body;

    // Update the product in the database
    const updateSql = 'UPDATE Products SET name = ?, label = ?, brandID = ?, price = ?, skin_typeID = ? WHERE ProdID = ?';
    const updateParams = [name, label, brandID, price, skin_typeID, id];

    connection.query(updateSql, updateParams, (err, updateResult) => {
        if (err) {
            return next(err);
        }

        // Update ingredients mapping for the product
        const deleteSql = 'DELETE FROM Prod_Ing_Mapping WHERE ProdID = ?'; // Adjust this query if necessary
        connection.query(deleteSql, [id], (err, deleteResult) => {
            if (err) {
                return next(err);
            }

            const insertSql = 'INSERT INTO Prod_Ing_Mapping (ProdID, IngID) VALUES ?';
            const insertValues = ingredients.map(ingID => [id, ingID]);

            connection.query(insertSql, [insertValues], (err, insertResult) => {
                if (err) {
                    return next(err);
                }

                // Redirect to product list page after successful update
                res.redirect('/admin/products');
            });
        });
    });
});



module.exports = router;
