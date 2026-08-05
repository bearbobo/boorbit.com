(function(){
  const saved = localStorage.getItem('boorbit-theme');
  if(saved === 'dark') document.documentElement.classList.add('dark');
  updateThemeUI();
  window.toggleTheme = function(){
    const dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('boorbit-theme', dark ? 'dark' : 'light');
    updateThemeUI();
  };
  function updateThemeUI(){
    const icon = document.getElementById('themeIcon');
    if(icon) icon.textContent = document.documentElement.classList.contains('dark') ? '☀' : '◐';
  }
  const items = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if(entry.isIntersecting){ entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), {threshold:.12});
    items.forEach(el => observer.observe(el));
  } else items.forEach(el => el.classList.add('visible'));
})();
