const tabs = Array.from(document.querySelectorAll('.intro-tab'));
const slideTitle = document.getElementById('intro-slide-title');
const slideCopy = document.getElementById('intro-slide-copy');
const slideImage = document.getElementById('intro-slide-image');
const year = document.getElementById('year');

if (year) {
  year.textContent = String(new Date().getFullYear());
}

function activateTab(tab) {
  tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
  tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
  slideTitle.textContent = tab.dataset.slideTitle || '';
  slideCopy.textContent = tab.dataset.slideCopy || '';
  slideImage.src = tab.dataset.slideImage || '';
  slideImage.alt = tab.dataset.slideTitle || 'Notion 3.0 preview';
}

tabs.forEach((tab) => {
  tab.setAttribute('aria-selected', String(tab.classList.contains('is-active')));
  tab.addEventListener('click', () => activateTab(tab));
});

let activeIndex = 0;
setInterval(() => {
  if (!tabs.length) return;
  activeIndex = (activeIndex + 1) % tabs.length;
  activateTab(tabs[activeIndex]);
}, 4800);
