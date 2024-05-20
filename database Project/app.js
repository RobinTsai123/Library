document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const adminLoginBtn = document.getElementById('adminLoginBtn');

    loginBtn.addEventListener('click', function() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        alert(`Login attempt with username: ${username} and password: ${password}`);
    });

    registerBtn.addEventListener('click', function() {
        alert('Redirecting to registration page...');
        // You can add the code to redirect to a registration page here
    });

    adminLoginBtn.addEventListener('click', function() {
        alert('Redirecting to admin login page...');
        // You can add the code to redirect to an admin login page here
    });
});
