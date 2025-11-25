document.addEventListener('DOMContentLoaded', () => {
  const pastesContainer = document.getElementById('pastes');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalImages = document.getElementById('modal-images');
  const closeBtn = document.querySelector('.close');
  const searchInput = document.getElementById('search');
  const totalCount = document.getElementById('total-count');
  const filteredCount = document.getElementById('filtered-count');
  
  const imageViewer = document.getElementById('image-viewer');
  const viewerImage = document.getElementById('viewer-image');
  const imageClose = document.querySelector('.image-close');
  const prevBtn = document.getElementById('prev-image');
  const nextBtn = document.getElementById('next-image');
  const downloadBtn = document.getElementById('download-image');
  
  let currentImages = [];
  let currentImageIndex = 0;

  let allPastes = [];
  let filteredPastes = [];

  function init() {
    allPastes = [...infobase];
    sortPastes();
    filteredPastes = [...allPastes];
    updateStats();
    renderPastes();
  }

  function sortPastes() {
    allPastes.sort((a, b) => {
      if (a.pin === "y" && b.pin !== "y") return -1;
      if (a.pin !== "y" && b.pin === "y") return 1;
      return 0;
    });
  }

  function updateStats() {
    totalCount.textContent = `всего записей: ${allPastes.length}`;
    if (filteredPastes.length !== allPastes.length) {
      filteredCount.textContent = `показано: ${filteredPastes.length}`;
      filteredCount.style.display = 'inline';
    } else {
      filteredCount.style.display = 'none';
    }
  }

  function renderPastes() {
    pastesContainer.innerHTML = '';
    
    if (filteredPastes.length === 0) {
      pastesContainer.innerHTML = '<div class="no-results">ничего не найдено</div>';
      return;
    }

    filteredPastes.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'paste-card';
      card.style.animationDelay = `${index * 0.1}s`;
      if (item.pin === "y") {
        card.setAttribute('data-pinned', 'true');
      }
      
      const nickMatch = item.title.match(/«(.+?)»/);
      const nick = nickMatch ? nickMatch[1] : '';
      
      card.innerHTML = `
        <div class="paste-header">
          <div class="paste-title">
            ${item.pin === "y" ? '<span class="pin-icon">📌</span>' : ''}
            ${item.title}
          </div>
          ${nick ? `<div class="paste-nick">@${nick}</div>` : ''}
        </div>
        <div class="paste-meta">
          <span>📅 ${item.date || 'недавно'}</span>
          <span>📄 ${item.info.split('\n').length} строк</span>
          ${item.pin === "y" ? '<span class="pinned-badge">закреплено</span>' : ''}
        </div>
      `;
      card.onclick = () => openModal(item);
      pastesContainer.appendChild(card);
    });
  }

  function filterPastes(query) {
    if (!query.trim()) {
      filteredPastes = [...allPastes];
    } else {
      const searchTerm = query.toLowerCase();
      filteredPastes = allPastes.filter(item => {
        const title = item.title.toLowerCase();
        const info = item.info.toLowerCase();
        return title.includes(searchTerm) || info.includes(searchTerm);
      });
      filteredPastes.sort((a, b) => {
        if (a.pin === "y" && b.pin !== "y") return -1;
        if (a.pin !== "y" && b.pin === "y") return 1;
        return 0;
      });
    }
    updateStats();
    renderPastes();
  }

  function openModal(item) {
    modalTitle.textContent = item.title;
    modalBody.textContent = item.info;
    
    if (item.img && item.img.trim()) {
      const images = item.img.split(',').map(img => img.trim()).filter(img => img);
      renderModalImages(images);
      modalImages.style.display = 'block';
    } else {
      modalImages.style.display = 'none';
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function renderModalImages(images) {
    if (!images || images.length === 0) {
      modalImages.innerHTML = '';
      return;
    }

    const gallery = document.createElement('div');
    gallery.className = 'image-gallery';
    
    images.forEach((imgUrl, index) => {
      if (!imgUrl) return;
      
      const imageItem = document.createElement('div');
      imageItem.className = 'image-item';
      
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = `Изображение ${index + 1}`;
      img.loading = 'lazy';
      
      img.onerror = function() {
        this.style.display = 'none';
        imageItem.style.display = 'none';
      };
      
      const overlay = document.createElement('div');
      overlay.className = 'image-overlay';
      overlay.innerHTML = '<div class="zoom-icon">🔍</div>';
      
      imageItem.appendChild(img);
      imageItem.appendChild(overlay);
      imageItem.onclick = () => openImageViewer(images, index);
      
      gallery.appendChild(imageItem);
    });
    
    modalImages.innerHTML = '';
    modalImages.appendChild(gallery);
  }

  function openImageViewer(images, startIndex) {
    currentImages = images;
    currentImageIndex = startIndex;
    showCurrentImage();
    imageViewer.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function showCurrentImage() {
    if (currentImages.length === 0) return;
    
    const currentImg = currentImages[currentImageIndex];
    viewerImage.src = currentImg;
    downloadBtn.href = currentImg;
    downloadBtn.download = `image_${currentImageIndex + 1}.jpg`;
    
    prevBtn.disabled = currentImageIndex === 0;
    nextBtn.disabled = currentImageIndex === currentImages.length - 1;
    
    if (currentImages.length <= 1) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'block';
      nextBtn.style.display = 'block';
    }
  }

  function closeImageViewer() {
    imageViewer.style.display = 'none';
    document.body.style.overflow = 'hidden';
  }

  function previousImage() {
    if (currentImageIndex > 0) {
      currentImageIndex--;
      showCurrentImage();
    }
  }

  function nextImage() {
    if (currentImageIndex < currentImages.length - 1) {
      currentImageIndex++;
      showCurrentImage();
    }
  }

  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  searchInput.addEventListener('input', (e) => {
    filterPastes(e.target.value);
  });

  closeBtn.onclick = closeModal;
  imageClose.onclick = closeImageViewer;
  prevBtn.onclick = previousImage;
  nextBtn.onclick = nextImage;
  
  window.onclick = (e) => {
    if (e.target === modal) closeModal();
    if (e.target === imageViewer) closeImageViewer();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (imageViewer.style.display === 'block') {
        closeImageViewer();
      } else {
        closeModal();
      }
    }
    if (imageViewer.style.display === 'block') {
      if (e.key === 'ArrowLeft') previousImage();
      if (e.key === 'ArrowRight') nextImage();
    }
  });

  init();
});