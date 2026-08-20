document.addEventListener('click', function (e) {
  var sw = e.target && e.target.closest ? e.target.closest('.swatch') : null;
  if (sw) {
    var hex = sw.getAttribute('data-accent');
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var root = document.documentElement;
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-strong', 'rgb(' + Math.round(r * 0.82) + ',' + Math.round(g * 0.82) + ',' + Math.round(b * 0.82) + ')');
    root.style.setProperty('--accent-soft', 'rgba(' + r + ',' + g + ',' + b + ',.09)');
    root.style.setProperty('--nav-active', 'rgba(' + r + ',' + g + ',' + b + ',.08)');
    var all = document.querySelectorAll('.swatch');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.toggle('active', all[i] === sw);
    }
    var val = document.getElementById('accent-val');
    if (val) val.textContent = hex;
    var prev = document.getElementById('accent-preview');
    if (prev) prev.style.background = hex;
    return;
  }
  var b = e.target && e.target.closest ? e.target.closest('.demo-switcher button:not(.swatch)') : null;
  if (!b) return;
  document.documentElement.setAttribute('data-theme', b.getAttribute('data-set'));
  var btns = document.querySelectorAll('.demo-switcher button:not(.swatch)');
  for (var j = 0; j < btns.length; j++) {
    btns[j].classList.toggle('active', btns[j] === b);
  }
});
