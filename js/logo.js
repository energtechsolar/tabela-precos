// logo do topo da proposta: desenhado no navegador (leve, sem arquivo de imagem)
// gera um JPEG 900x240 usado pelo jsPDF em pdf.js
const LOGO_TOPO = (() => {
  try {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 240;
    const c = cv.getContext('2d');
    c.fillStyle = '#111111'; c.fillRect(0, 0, 900, 240);
    c.fillStyle = '#FFC107'; c.beginPath(); c.arc(120, 120, 100, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111111'; c.beginPath();
    [[134, 44], [86, 133], [119, 133], [100, 196], [159, 104], [126, 104]].forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); c.fill();
    c.fillStyle = '#FFFFFF'; c.textBaseline = 'alphabetic';
    c.font = 'bold 84px Arial, Helvetica, sans-serif';
    const k = 444 / c.measureText('Energtech').width;   // mesma largura em qualquer aparelho
    c.save(); c.translate(251, 131); c.scale(k, 1); c.fillText('Energtech', 0, 0); c.restore();
    c.font = '38px Arial, Helvetica, sans-serif';
    const letras = [...'Engenharia'], soma = letras.reduce((t, ch) => t + c.measureText(ch).width, 0), esp = (325 - soma) / (letras.length - 1);
    let x = 263; letras.forEach(ch => { c.fillText(ch, x, 187); x += c.measureText(ch).width + esp; });
    return cv.toDataURL('image/jpeg', 0.92);
  } catch (e) { return ''; }
})();
