document.addEventListener('DOMContentLoaded', () => {
  const pastesContainer = document.getElementById('pastes');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeBtn = document.querySelector('.close');
  const searchInput = document.getElementById('search');
  const totalCount = document.getElementById('total-count');
  const filteredCount = document.getElementById('filtered-count');

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
      
      // Получаем первую строку для превью (без лишних пробелов)
      const lines = item.info.split('\n').filter(line => line.trim() !== '');
      const firstLine = lines.length > 0 ? lines[0] : 'Нет описания';
      const previewText = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
      
      card.innerHTML = `
        <div class="paste-header">
          <div class="paste-title">
            ${item.pin === "y" ? '<span class="pin-icon">📌</span>' : ''}
            ${item.title}
          </div>
          ${nick ? `<div class="paste-nick">@${nick}</div>` : ''}
        </div>
        <div class="paste-preview">${previewText}</div>
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
    
    // Форматируем многострочный текст для отображения
    let formattedText = item.info;
    
    // Заменяем переносы строк на <br>, а табы на отступы
    formattedText = formattedText
      .replace(/\n/g, '<br>')
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    
    modalBody.innerHTML = formattedText;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    modalBody.innerHTML = '';
  }

  searchInput.addEventListener('input', (e) => {
    filterPastes(e.target.value);
  });

  closeBtn.onclick = closeModal;
  
  window.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  init();
});