/* <lc-galaxia> — galaxia de conocimiento, versión 2D (canvas). Atributos:
   modo="vivo" (órbita + interacción) | "cierre" (animación de nuevo conocimiento) | "quieto"
   Eventos: lc-estrella {detail: concepto} al tocar una estrella · lc-cierre-fin al terminar la animación. */
(function () {
  const C = { fondo: '#0A1230', acento: '#FF6A1A', desc: '#38B6FF', sost: '#5BD36F', trans: '#9B6CFF', dom: '#FFC23D', texto: '#F3F6FF', t2: '#9AA7C7', rojo: '#FF5A5A', ambar: '#E0A33A' };
  const ZONAS = [
    { id: 'narrativa', nombre: 'Narrativa y símbolo', color: '56,182,255' },
    { id: 'sociedad', nombre: 'Sociedad y conciencia', color: '91,211,111' },
    { id: 'poder', nombre: 'Empoderamiento', color: '155,108,255' },
    { id: 'medios', nombre: 'Medios y método', color: '255,194,61' }
  ];
  // estados: 0 no tocada · 1 vista · 2 reconocida · 3 relacionada · 4 consolidada · 5 se te resiste
  const E = [
    ['lj', 'Literatura juvenil', 'narrativa', 4, -0.62, -0.18, 0.2],
    ['sim', 'Simbolismo', 'narrativa', 3, -0.78, 0.22, -0.3],
    ['nar', 'Elementos narrativos', 'narrativa', 2, -0.45, 0.42, 0.45],
    ['prot', 'Protagonista femenina fuerte y compleja', 'narrativa', 3, -0.35, -0.5, -0.55],
    ['cs', 'Crítica social', 'sociedad', 4, -0.1, -0.05, 0.1],
    ['es', 'Elementos sociales', 'sociedad', 2, 0.05, 0.38, -0.35],
    ['cso', 'Conciencia social', 'sociedad', 3, -0.15, 0.55, 0.3],
    ['ccr', 'Conciencia crítica', 'sociedad', 1, 0.2, 0.15, 0.62],
    ['disc', 'Discusión cultural sobre desigualdad, violencia y poder de los medios', 'sociedad', 1, 0.12, -0.42, 0.4],
    ['emp', 'Empoderamiento', 'poder', 3, 0.42, -0.15, -0.2],
    ['empm', 'Empoderamiento de las mujeres', 'poder', 2, 0.62, -0.42, 0.15],
    ['act', 'Conciencia política y activismo', 'poder', 5, 0.55, 0.28, 0.5],
    ['hcs', 'Herramienta de crítica social', 'poder', 1, 0.3, 0.55, -0.6],
    ['ic', 'Impacto cultural', 'medios', 3, 0.28, -0.7, -0.15],
    ['eti', 'Ética del entretenimiento', 'medios', 0, 0.7, 0.6, -0.1],
    ['med', 'Papel de los medios de comunicación', 'medios', 1, 0.75, 0.05, -0.5],
    ['ac', 'Análisis de contenido', 'medios', 2, 0.55, -0.72, 0.5],
    ['acd', 'Análisis crítico de discursos', 'medios', 0, 0.85, -0.35, 0.6]
  ].map(([id, nombre, zona, estado, x, y, z]) => ({ id, nombre, zona, estado, x, y, z }));
  // hilos: tipo firme | insinuado | propuesta
  const H = [
    ['lj', 'emp', 'apoya', 'firme'], ['cs', 'ic', 'causa', 'firme'], ['sim', 'cs', 'apoya', 'firme'],
    ['acd', 'ac', 'extiende', 'insinuado'], ['lj', 'cs', 'requiere', 'firme'], ['prot', 'empm', 'ejemplifica', 'firme'],
    ['cso', 'act', 'causa', 'firme'], ['emp', 'empm', 'generaliza', 'firme'], ['es', 'cso', 'apoya', 'firme'],
    ['nar', 'sim', 'requiere', 'firme'], ['ic', 'disc', 'causa', 'insinuado'], ['med', 'ic', 'matiza', 'propuesta'],
    ['emp', 'act', 'apoya', 'firme'], ['cs', 'hcs', 'generaliza', 'insinuado'], ['ccr', 'cso', 'extiende', 'firme']
  ].map(([a, b, tipo, clase]) => ({ a, b, tipo, clase }));
  // lo que se gana en el cierre de la expedición de ejemplo
  const GANANCIAS = {
    hilos: [['ccr', 'cs', 'apoya'], ['disc', 'act', 'causa'], ['hcs', 'emp', 'ejemplifica']],
    suben: [['ccr', 3], ['hcs', 2]],
    propuestas: [['eti', 'med', 'matiza']]
  };
  window.LC_CAMPO = { zonas: ZONAS, estrellas: E, hilos: H, ganancias: GANANCIAS, colores: C };

  const reducido = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Galaxia {
    constructor(host, props) {
      this.host = host; this.props = props || {};
      host.style.cssText += ';display:block;position:relative;width:100%;height:100%;min-height:240px;touch-action:none;cursor:grab';
      host.innerHTML = '<canvas style="display:block;width:100%;height:100%"></canvas>';
      this.cv = host.querySelector('canvas');
      this.ang = -0.4; this.vel = 0; this.drag = null; this.t0 = performance.now();
      this.estrellas = E.map(s => Object.assign({}, s));
      this.hilos = H.map(h => Object.assign({}, h));
      this.part = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + .3, f: Math.random() * 6 }));
      this.cierre = null;
    }
    conectar() {
      this.ro = new ResizeObserver(() => this.medir()); this.ro.observe(this.host);
      this.cv.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, a: this.ang, mov: 0 }; this.cv.setPointerCapture(e.pointerId); });
      this.cv.addEventListener('pointermove', e => { if (!this.drag) return; const dx = e.clientX - this.drag.x; this.drag.mov += Math.abs(dx); this.ang = this.drag.a + dx * 0.006; this.vel = 0; });
      this.cv.addEventListener('pointerup', e => { const d = this.drag; this.drag = null; if (d && d.mov < 4) this.tocar(e); });
      this.medir(); this.reiniciar(); this.loop = t => { this.dibujar(t); this.raf = requestAnimationFrame(this.loop); }; this.raf = requestAnimationFrame(this.loop);
    }
    desconectar() { cancelAnimationFrame(this.raf); this.ro.disconnect(); }
    actualizar(props) { const cambia = props.modo !== this.props.modo; this.props = props; if (cambia) this.reiniciar(); }
    get modo() { return this.props.modo || 'vivo'; }
    getBoundingClientRect() { return this.host.getBoundingClientRect(); }
    dispatchEvent(e) { return this.host.dispatchEvent(e); }
    reiniciar() {
      this.estrellas = E.map(s => Object.assign({}, s)); this.hilos = H.map(h => Object.assign({}, h));
      this.cierre = this.modo === 'cierre' ? { t0: performance.now(), hechos: new Set() } : null;
    }
    medir() {
      const r = this.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      this.cv.width = Math.max(1, r.width * d); this.cv.height = Math.max(1, r.height * d); this.d = d; this.w = r.width; this.h = r.height;
    }
    proy(s) {
      const c = Math.cos(this.ang), sn = Math.sin(this.ang);
      const x = s.x * c - s.z * sn, z = s.x * sn + s.z * c;
      const esc = 1 + z * 0.32, R = Math.min(this.w, this.h) * 0.42;
      return { x: this.w / 2 + x * R * 1.25 * esc, y: this.h / 2 + s.y * R * 0.82 * esc, esc, z };
    }
    tocar(e) {
      const r = this.cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      let mejor = null, dm = 18;
      for (const s of this.estrellas) { const p = this.proy(s); const dd = Math.hypot(p.x - px, p.y - py); if (dd < dm) { dm = dd; mejor = s; } }
      if (mejor) this.dispatchEvent(new CustomEvent('lc-estrella', { bubbles: true, composed: true, detail: Object.assign({ zonaNombre: ZONAS.find(z => z.id === mejor.zona).nombre }, mejor) }));
    }
    // Timeline del cierre (ms): hilos 0–3300 (900 cada uno + 200 pausa) · subidas 3500–4900 (700 c/u) · propuesta 5000–5900 · fin 6200
    avanzarCierre(t) {
      const c = this.cierre; if (!c) return; const ms = reducido() ? 99999 : t - c.t0;
      GANANCIAS.hilos.forEach(([a, b, tipo], i) => {
        const ini = i * 1100, p = Math.min(1, Math.max(0, (ms - ini) / 900));
        const k = 'h' + i; let h = this.hilos.find(x => x.k === k);
        if (p > 0 && !h) { h = { a, b, tipo, clase: 'firme', k, p: 0, nuevo: true }; this.hilos.push(h); } if (h) h.p = p;
      });
      GANANCIAS.suben.forEach(([id, nivel], i) => {
        const ini = 3500 + i * 700, p = (ms - ini) / 700;
        const s = this.estrellas.find(x => x.id === id);
        if (p > 0) { s.estado = nivel; s.destello = Math.max(0, 1 - p); }
      });
      GANANCIAS.propuestas.forEach(([a, b, tipo], i) => {
        const p = Math.min(1, Math.max(0, (ms - 5000) / 900)), k = 'p' + i; let h = this.hilos.find(x => x.k === k);
        if (p > 0 && !h) { h = { a, b, tipo, clase: 'propuesta', k, p: 0, nuevo: true, etiqueta: 'lo viste tú' }; this.hilos.push(h); } if (h) h.p = p;
      });
      if (ms > 6200 && !c.fin) { c.fin = true; this.dispatchEvent(new CustomEvent('lc-cierre-fin', { bubbles: true, composed: true })); }
    }
    dibujar(t) {
      const g = this.cv.getContext('2d'), d = this.d, w = this.w, h = this.h;
      if (!w) return;
      const quieto = reducido() || this.modo === 'quieto';
      if (!this.drag && !quieto) this.ang += 0.0011; // una vuelta ≈ 95 s
      this.avanzarCierre(t);
      g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
      const P = {}; this.estrellas.forEach(s => P[s.id] = this.proy(s));
      // nebulosas: una por zona, centradas en sus estrellas
      ZONAS.forEach(z => {
        const ss = this.estrellas.filter(s => s.zona === z.id); const cx = ss.reduce((a, s) => a + P[s.id].x, 0) / ss.length, cy = ss.reduce((a, s) => a + P[s.id].y, 0) / ss.length;
        const rr = Math.min(w, h) * 0.34, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
        gr.addColorStop(0, `rgba(${z.color},0.13)`); gr.addColorStop(1, `rgba(${z.color},0)`);
        g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      });
      // partículas
      if (!quieto) this.part.forEach(p => { const a = 0.25 + 0.25 * Math.sin(t / 900 + p.f); g.fillStyle = `rgba(243,246,255,${a})`; g.beginPath(); g.arc((p.x + Math.sin(t / 9000 + p.f) * 0.01) * w, (p.y + t / 240000 * (0.5 + p.r) % 1) % 1 * h, p.r, 0, 7); g.fill(); });
      // hilos
      this.hilos.forEach(hh => {
        const a = P[hh.a], b = P[hh.b]; if (!a || !b) return; const p = hh.p == null ? 1 : hh.p;
        const bx = a.x + (b.x - a.x) * p, by = a.y + (b.y - a.y) * p;
        g.save(); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(bx, by);
        if (hh.clase === 'firme') { g.strokeStyle = hh.nuevo ? C.dom : `rgba(56,182,255,${0.55 + a.z * 0.2})`; g.lineWidth = hh.nuevo ? 2.2 : 1.6; if (hh.nuevo) { g.shadowColor = C.dom; g.shadowBlur = 10; } }
        else if (hh.clase === 'insinuado') { g.strokeStyle = 'rgba(224,163,58,0.75)'; g.lineWidth = 0.9; }
        else { g.strokeStyle = C.trans; g.lineWidth = 1.6; g.setLineDash([4, 5]); if (hh.nuevo) { g.shadowColor = C.trans; g.shadowBlur = 10; } }
        g.stroke(); g.restore();
        if (hh.etiqueta && p >= 1) { g.font = '600 11px Manrope, sans-serif'; g.fillStyle = C.trans; g.textAlign = 'center'; g.fillText(hh.etiqueta, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8); }
      });
      // estrellas
      const foco = this.props.foco;
      this.estrellas.sort((s1, s2) => P[s1.id].z - P[s2.id].z).forEach(s => {
        const p = P[s.id], k = p.esc; let r, col, alfa = 1, label = null;
        switch (s.estado) {
          case 0: r = 1.4; col = C.t2; alfa = 0.45; break;
          case 1: r = 2; col = C.t2; label = C.t2; break;
          case 2: r = 3; col = C.desc; label = C.texto; break;
          case 3: r = 3.4; col = C.desc; label = C.texto; break;
          case 4: r = 4.2; col = C.dom; label = C.texto; break;
          case 5: r = 3; col = C.rojo; label = C.rojo; alfa = 0.7 + 0.3 * Math.sin(t / 260); break;
        }
        r *= k; g.save(); g.globalAlpha = alfa;
        if (s.estado === 3) { g.strokeStyle = 'rgba(56,182,255,0.45)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 5, 0, 7); g.stroke(); }
        if (s.estado === 4) { g.shadowColor = C.dom; g.shadowBlur = quieto ? 10 : 14 + 6 * Math.sin(t / 700 + p.x); }
        if (s.destello) { g.shadowColor = '#fff'; g.shadowBlur = 40 * s.destello; r += 6 * s.destello; }
        if (foco === s.id) { g.strokeStyle = C.acento; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, r + 8, 0, 7); g.stroke(); }
        g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
        if (label && w > 360) { g.shadowBlur = 0; g.font = `${s.estado >= 4 ? 700 : 500} ${Math.round(10 + 2 * k)}px Manrope, sans-serif`; g.fillStyle = label; g.textAlign = 'center'; const n = s.nombre.length > 26 ? s.nombre.slice(0, 24) + '…' : s.nombre; g.fillText(n, p.x, p.y + r + 13); }
        g.restore();
      });
    }
  }
  window.LcGalaxia = function LcGalaxia(props) {
    const ref = React.useRef(null), ctl = React.useRef(null);
    React.useEffect(() => { const g = new Galaxia(ref.current, props); ctl.current = g; g.conectar(); ref.current.__galaxia = g; return () => g.desconectar(); }, []);
    React.useEffect(() => { if (ctl.current) ctl.current.actualizar(props); }, [props.modo, props.foco]);
    return React.createElement('div', { ref, 'data-lc-galaxia': '', style: { position: 'absolute', inset: 0 } });
  };
})();
