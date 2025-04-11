const fs = require('fs');
const path = require('path');

// Leer el archivo
const filePath = path.join(process.cwd(), 'client/src/components/schedule-table.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Reemplazar todos los valores fijos de width, height y lineHeight por referencias a cellSize
content = content.replace(/width: "30px"/g, 'width: `${cellSize}px`');
content = content.replace(/height: "30px"/g, 'height: `${cellSize}px`');
content = content.replace(/lineHeight: "30px"/g, 'lineHeight: `${cellSize}px`');
content = content.replace(/top: "30px"/g, 'top: `${cellSize}px`');

// Actualizar las referencias en los comentarios
content = content.replace(/\/\/ Exactamente 30px de ancho/g, '// Ancho dinámico basado en cellSize');
content = content.replace(/\/\/ Exactamente 30px de altura/g, '// Altura dinámica basada en cellSize');

// Guardar el archivo actualizado
fs.writeFileSync(filePath, content, 'utf8');
console.log('Archivo actualizado con éxito');
