const API_BASE_URL = 'https://kbu-pulse-api-1.onrender.com';

// Helper function to resize and compress uploaded images
function compressImage(file, maxWidth, quality, callback) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      callback(canvas.toDataURL('image/jpeg', quality));
    };
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  
  // DOM Elements
  const avatarInput = document.getElementById('avatar-input');
  const avatarImg = document.getElementById('profile-avatar');
  const coverInput = document.getElementById('cover-input');
  const coverBanner = document.getElementById('cover-banner');
  
  const nameDisplay = document.getElementById('user-name');
  const emailDisplay = document.getElementById('user-email');
  const bioDisplay = document.getElementById('user-bio-display');
  
  const nameInput = document.getElementById('edit-name');
  const emailInput = document.getElementById('edit-email');
  const bioInput = document.getElementById('edit-bio');
  const editForm = document.getElementById('edit-profile-form');

  // 1. Load Local Saved Avatar & Cover
  const savedAvatar = localStorage.getItem('user_avatar');
  if (savedAvatar && avatarImg) avatarImg.src = savedAvatar;

  const savedCover = localStorage.getItem('user_cover');
  if (savedCover && coverBanner) coverBanner.style.backgroundImage = `url(${savedCover})`;

  const savedBio = localStorage.getItem('user_bio');
  if (savedBio) {
    if (bioDisplay) bioDisplay.textContent = `"${savedBio}"`;
    if (bioInput) bioInput.value = savedBio;
  }

  // 2. Fetch User Data from Backend
  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const userData = await response.json();
        const currentName = userData.name || userData.username || 'KBU Student';
        const currentEmail = userData.email || 'student@kbu.ac.th';

        if (nameDisplay) nameDisplay.textContent = currentName;
        if (emailDisplay) emailDisplay.textContent = currentEmail;
        if (nameInput) nameInput.value = currentName;
        if (emailInput) emailInput.value = currentEmail;
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }

  // 3. Avatar Photo Upload
  if (avatarInput) {
    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        compressImage(file, 300, 0.8, (compressedDataUrl) => {
          avatarImg.src = compressedDataUrl;
          try {
            localStorage.setItem('user_avatar', compressedDataUrl);
          } catch (err) {
            alert('Image is too large. Please select a smaller file.');
          }
        });
      }
    });
  }

  // 4. Cover Background Upload
  if (coverInput) {
    coverInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        compressImage(file, 900, 0.75, (compressedDataUrl) => {
          coverBanner.style.backgroundImage = `url(${compressedDataUrl})`;
          try {
            localStorage.setItem('user_cover', compressedDataUrl);
          } catch (err) {
            alert('Cover image is too large. Please select a smaller file.');
          }
        });
      }
    });
  }

  // 5. Save Form Changes
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const updatedName = nameInput ? nameInput.value.trim() : '';
      const updatedEmail = emailInput ? emailInput.value.trim() : '';
      const updatedBio = bioInput ? bioInput.value.trim() : '';

      if (updatedName && nameDisplay) nameDisplay.textContent = updatedName;
      if (updatedEmail && emailDisplay) emailDisplay.textContent = updatedEmail;
      
      if (bioDisplay) {
        bioDisplay.textContent = updatedBio ? `"${updatedBio}"` : '';
      }
      localStorage.setItem('user_bio', updatedBio);

      alert('Profile updated successfully!');
    });
  }

  // 6. Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    });
  }
});s