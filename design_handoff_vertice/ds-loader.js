/* Carga el bundle del sistema (y opcionalmente una demo), los transpila con Babel
   standalone en modo clásico y los ejecuta. Expone window.DSReady.

   <script src="../../ds-loader.js"
           data-bundle="../../_ds_bundle.jsx"
           data-demo="core.demo.jsx"></script>

   Dentro de la demo, los componentes están en window.DS. No uses
   <script type="text/babel"> inline: Babel lo transpila con el runtime
   automático y emite un import que el navegador no puede ejecutar. */
window.DSReady = (function () {
  var el = document.currentScript;
  var bundle = el.getAttribute('data-bundle') || '_ds_bundle.jsx';
  var demo = el.getAttribute('data-demo');

  function run(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('No se pudo cargar ' + url + ' (' + r.status + ')');
      return r.text();
    }).then(function (src) {
      var out = Babel.transform(src, {
        presets: [['react', { runtime: 'classic' }]],
        filename: url,
      }).code;
      (0, eval)(out);
    });
  }

  function fallo(e) {
    var p = document.createElement('p');
    p.style.cssText = 'font:14px system-ui;color:#b45309;padding:16px';
    p.textContent = 'No se pudo cargar el sistema: ' + e.message;
    document.body.appendChild(p);
    throw e;
  }

  var ready = run(bundle).then(function () { return window.DS; });
  if (demo) {
    ready = ready.then(function (DS) {
      return new Promise(function (res, rej) {
        var go = function () { run(demo).then(function () { res(DS); }, rej); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
        else go();
      });
    });
  }
  return ready.catch(fallo);
})();
