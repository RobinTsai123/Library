document.addEventListener('DOMContentLoaded', function() {
    const userBtn = document.getElementById('userBtn');
    const adminLoginBtn = document.getElementById('adminLoginBtn');

    userBtn.addEventListener('click', function() {
        alert('Welcome to our library!');
        // Replace with the correct URL for the user home page
        window.location.href = 'frontEnd.html'; // Ensure this file exists in your project directory
    });

    adminLoginBtn.addEventListener('click', function() {
        const username = prompt('Enter Admin Username:');
        const password = prompt('Enter Admin Password:');
        
        if (username === 'DatabaseProject' && password === '1234') {
            alert('Login successful! Redirecting to backend...');
            // Replace with the correct URL for the admin backend page
            window.location.href = 'backEnd.html'; // Ensure this file exists in your project directory
        } else {
            alert('Error: Incorrect username or password');
        }
    });
});
