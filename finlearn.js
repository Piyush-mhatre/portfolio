document.addEventListener('DOMContentLoaded', function() {
    // Get all navigation items
    const navItems = document.querySelectorAll('.nav-item');
    const submenuItems = document.querySelectorAll('.submenu-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Function to hide all content sections
    function hideAllSections() {
        contentSections.forEach(section => {
            section.classList.remove('active');
        });
    }
    
    // Function to deactivate all nav items
    function deactivateAllItems() {
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        
        submenuItems.forEach(item => {
            item.classList.remove('active');
        });
    }
    
    // Handle click on main nav items
    navItems.forEach(item => {
        const hasSubmenu = item.querySelector('.submenu');
        const navLink = item.querySelector('.nav-link');
        
        navLink.addEventListener('click', function() {
            if (hasSubmenu) {
                // Toggle submenu
                item.classList.toggle('open');
            } else {
                // Show content for this nav item
                const sectionId = item.getAttribute('data-section');
                if (sectionId) {
                    hideAllSections();
                    deactivateAllItems();
                    item.classList.add('active');
                    document.getElementById(sectionId).classList.add('active');
                    
                    // Scroll to top of content
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Handle click on submenu items
    submenuItems.forEach(item => {
        item.addEventListener('click', function() {
            const sectionId = item.getAttribute('data-section');
            if (sectionId) {
                hideAllSections();
                deactivateAllItems();
                
                // Activate parent menu
                const parentItem = item.closest('.nav-item');
                parentItem.classList.add('active');
                parentItem.classList.add('open');
                
                // Activate this submenu item
                item.classList.add('active');
                
                // Show content section
                document.getElementById(sectionId).classList.add('active');
                
                // Scroll to top of content
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add mobile toggle functionality
    const sidebarToggle = document.createElement('div');
    sidebarToggle.className = 'sidebar-toggle';
    sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
    document.body.appendChild(sidebarToggle);
    
    sidebarToggle.addEventListener('click', function() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('sidebar-open');
        this.classList.toggle('active');
    });
    
    // Check for URL hash to load specific section
    if (window.location.hash) {
        const sectionId = window.location.hash.substring(1);
        const section = document.getElementById(sectionId);
        if (section) {
            hideAllSections();
            section.classList.add('active');
            
            // Find and activate corresponding nav item
            const navItem = document.querySelector(`[data-section="${sectionId}"]`);
            if (navItem) {
                deactivateAllItems();
                if (navItem.classList.contains('submenu-item')) {
                    const parentItem = navItem.closest('.nav-item');
                    parentItem.classList.add('active');
                    parentItem.classList.add('open');
                    navItem.classList.add('active');
                } else {
                    navItem.classList.add('active');
                }
            }
        }
    }
    
    // Add CSS for sidebar toggle in mobile view
    const style = document.createElement('style');
    style.textContent = `
        .sidebar-toggle {
            display: none;
            position: fixed;
            top: 15px;
            right: 15px;
            width: 40px;
            height: 40px;
            background-color: #2c3e50;
            color: white;
            border-radius: 4px;
            z-index: 1001;
            cursor: pointer;
            text-align: center;
            line-height: 40px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        @media screen and (max-width: 768px) {
            .sidebar-toggle {
                display: block;
            }
            
            .sidebar {
                transform: translateX(-100%);
                width: 100%;
            }
            
            .sidebar.sidebar-open {
                transform: translateX(0);
            }
            
            .main-content {
                padding-top: 70px;
            }
        }
    `;
    document.head.appendChild(style);
});