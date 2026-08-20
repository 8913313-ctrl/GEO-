document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('.demo-switcher button') : null;
  if (!b) return;
  document.documentElement.setAttribute('data-theme', b.getAttribute('data-set'));
  var all = document.querySelectorAll('.demo-switcher button');
  for (var i = 0; i < all.length; i++) {
    all[i].classList.toggle('active', all[i] === b);
  }
});
