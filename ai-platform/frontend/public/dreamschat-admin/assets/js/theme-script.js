// Immediately apply the theme based on localStorage
(function() {
    const darkMode = localStorage.getItem('darkMode');
    const isDarkMode = darkMode === 'enabled';

    // Apply the theme class to the document immediately
    document.documentElement.className = isDarkMode ? 'dark' : '';

    // Wait for DOMContentLoaded to set up event listeners
    document.addEventListener('DOMContentLoaded', () => {
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const lightModeToggle = document.getElementById('light-mode-toggle');

        const toggleMode = (isDarkMode) => {
            document.documentElement.className = isDarkMode ? 'dark' : ''; // Add/remove class
            localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
            updateToggleButtons(isDarkMode);
        };

        const updateToggleButtons = (isDarkMode) => {
            darkModeToggle.classList.toggle('activate', !isDarkMode);
            lightModeToggle.classList.toggle('activate', isDarkMode);
        };

        // Initial activation based on current theme
        updateToggleButtons(isDarkMode);

        // Add event listeners if elements are present
        if (darkModeToggle && lightModeToggle) {
            darkModeToggle.addEventListener('click', () => toggleMode(true));
            lightModeToggle.addEventListener('click', () => toggleMode(false));
        }
    });
})();
