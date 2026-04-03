	// Dark Mode
	
	document.addEventListener("DOMContentLoaded", function() {
		const darkModeToggle = document.getElementById('dark-mode-toggle');
		const lightModeToggle = document.getElementById('light-mode-toggle');
	  
		function enableDarkMode() {
		  document.body.classList.add('darkmode');
		  darkModeToggle.classList.remove('active');
		  lightModeToggle.classList.add('active');
		  localStorage.setItem('darkMode', 'enabled');
		}
	  
		function disableDarkMode() {
		  document.body.classList.remove('darkmode');
		  darkModeToggle.classList.add('active');
		  lightModeToggle.classList.remove('active');
		  localStorage.setItem('darkMode', 'disabled');
		}
	  
		// Set the initial mode based on localStorage
		if (localStorage.getItem('darkMode') === 'enabled') {
		  enableDarkMode();
		} else {
		  disableDarkMode();
		}
	  
		// Attach event listeners for toggling dark/light mode
		if (darkModeToggle) {
		  darkModeToggle.addEventListener('click', enableDarkMode);
		}
	  
		if (lightModeToggle) {
		  lightModeToggle.addEventListener('click', disableDarkMode);
		}
		  }); 

	document.addEventListener("DOMContentLoaded", function() {
		const darkModeToggle = document.getElementById('dark-mode-toggle');
		const lightModeToggle = document.getElementById('light-mode-toggle');

		function enableDarkMode() {
			document.body.classList.add('darkmode');
			darkModeToggle.classList.remove('active');
			lightModeToggle.classList.add('active');
			localStorage.setItem('darkMode', 'enabled');
		}

		function disableDarkMode() {
			document.body.classList.remove('darkmode');
			darkModeToggle.classList.add('active');
			lightModeToggle.classList.remove('active');
			localStorage.setItem('darkMode', 'disabled');
		}

		// Set the initial mode based on localStorage (already applied above)

		// Attach event listeners for toggling dark/light mode
		if (darkModeToggle) {
			darkModeToggle.addEventListener('click', enableDarkMode);
		}

		if (lightModeToggle) {
			lightModeToggle.addEventListener('click', disableDarkMode);
		}
	});
	  