// --- VARIABLES GLOBALES ---
let parsedData = [];
let filteredData = [];
let imageFiles = [];
let imageFileUrls = new Map();
let charts = {};
let currentPage = 1;
const rowsPerPage = 10;
let currentChartIndex = 0;

const fileInput = document.getElementById('fileInput');
const imageInput = document.getElementById('imageInput');
const uploadSection = document.getElementById('uploadSection');
const fileName = document.getElementById('fileName');
const imageCount = document.getElementById('imageCount');
const errorMessage = document.getElementById('errorMessage');
const downloadSection = document.getElementById('downloadSection');
const stats = document.getElementById('stats');
const chartsSection = document.getElementById('chartsSection');
const dataTable = document.getElementById('dataTable');
const tableBody = document.getElementById('tableBody');
const tableControls = document.getElementById('tableControls');
const searchInput = document.getElementById('searchInput');
const paginationControls = document.getElementById('paginationControls');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const carouselTrack = document.getElementById('carouselTrack');
const prevChartBtn = document.getElementById('prevChartBtn');
const nextChartBtn = document.getElementById('nextChartBtn');
const totalCharts = 4;

fileInput.addEventListener('change', handleFileSelect);
imageInput.addEventListener('change', handleImageSelect);
uploadSection.addEventListener('dragover', (e) => { e.preventDefault(); uploadSection.classList.add('dragover'); });
uploadSection.addEventListener('dragleave', () => { uploadSection.classList.remove('dragover'); });
uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
});
searchInput.addEventListener('input', () => {
    currentPage = 1;
    displayData();
});
prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayData(); } });
nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) { currentPage++; displayData(); }
});
prevChartBtn.addEventListener('click', () => {
    currentChartIndex = (currentChartIndex - 1 + totalCharts) % totalCharts;
    updateChartCarousel();
});
nextChartBtn.addEventListener('click', () => {
    currentChartIndex = (currentChartIndex + 1) % totalCharts;
    updateChartCarousel();
});

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

function handleImageSelect(e) {
    imageFiles = Array.from(e.target.files);
    imageCount.textContent = `${imageFiles.length} imágenes cargadas`;
    imageFileUrls.forEach(url => URL.revokeObjectURL(url));
    imageFileUrls.clear();
    imageFiles.forEach(file => {
        const normalizedName = normalizeImageName(file.name);
        if (normalizedName) {
            imageFileUrls.set(normalizedName, URL.createObjectURL(file));
        }
    });

    if (parsedData.length > 0) {
        displayData();
    }
}

function handleFile(file) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
        showError('Por favor selecciona un archivo CSV válido');
        return;
    }
    fileName.textContent = `Archivo: ${file.name}`;
    hideError();
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: function(results) { processData(results.data); },
        error: function(error) { showError('Error al leer el archivo: ' + error.message); }
    });
}

function processData(data) {
    if (data.length === 0) {
        showError('El archivo CSV está vacío');
        return;
    }
    const requiredColumns = ['persona', 'dias_distintos', 'fechas_detectado', 'delitos', 'detalle_delito'];
    const columns = Object.keys(data[0]);
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));
    if (missingColumns.length > 0) {
        showError('Faltan las siguientes columnas: ' + missingColumns.join(', '));
        return;
    }
    parsedData = data;
    calculateStats(data);
    createCharts(data);
    currentPage = 1;
    searchInput.value = '';
    displayData();
    downloadSection.classList.add('show');
}

function displayData() {
    const searchTerm = searchInput.value.toLowerCase();
    filteredData = parsedData.filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(searchTerm)));

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    tableBody.innerHTML = '';
    paginatedData.forEach(row => {
        const imageUrl = findImageUrlForPerson(row.persona);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="photo-cell">
                ${imageUrl ? `<img src="${imageUrl}" alt="Foto de ${row.persona}">` : '<span>Sin foto</span>'}
            </td>
            <td class="persona">${row.persona || ''}</td>
            <td class="dias">${row.dias_distintos || ''}</td>
            <td>${row.fechas_detectado || ''}</td>
            <td class="delito">${row.delitos || ''}</td>
            <td class="detalle">${row.detalle_delito || ''}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    if (parsedData.length > 0) {
        dataTable.classList.add('show');
        tableControls.classList.add('show');
        paginationControls.classList.add('show');
        updatePaginationControls(totalPages);
    }
}

function updatePaginationControls(totalPages) {
    pageInfo.textContent = `Página ${currentPage} de ${totalPages > 0 ? totalPages : 1}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function calculateStats(data) {
    const totalPersonas = data.length;
    const diasArray = data.map(row => parseInt(row.dias_distintos) || 0);
    const totalDetenciones = diasArray.reduce((sum, val) => sum + val, 0);
    const promedio = totalPersonas > 0 ? (totalDetenciones / totalPersonas).toFixed(1) : 0;
    const maxDetenciones = diasArray.length > 0 ? Math.max(...diasArray) : 0;
    const faltasAdmin = data.filter(row => (row.delitos || '').toUpperCase().includes('FALTA ADMINISTRATIVA')).length;
    const disposiciones = data.filter(row => (row.delitos || '').toUpperCase().includes('DISPOSICIÓN') || (row.delitos || '').toUpperCase().includes('DISPOSICION')).length;
    const reincidentes = data.filter(row => parseInt(row.dias_distintos) >= 3).length;
    const sortedDias = [...diasArray].sort((a, b) => a - b);
    let mediana = 0;
    if (sortedDias.length > 0) {
        mediana = sortedDias.length % 2 === 0
            ? ((sortedDias[sortedDias.length / 2 - 1] + sortedDias[sortedDias.length / 2]) / 2).toFixed(1)
            : sortedDias[Math.floor(sortedDias.length / 2)];
    }
    document.getElementById('totalPersonas').textContent = totalPersonas;
    document.getElementById('totalDetenciones').textContent = totalDetenciones;
    document.getElementById('promedioDetenciones').textContent = promedio;
    document.getElementById('maxDetenciones').textContent = maxDetenciones;
    document.getElementById('faltasAdmin').textContent = faltasAdmin;
    document.getElementById('disposiciones').textContent = disposiciones;
    document.getElementById('reincidentes').textContent = reincidentes;
    document.getElementById('medianaDetenciones').textContent = mediana;
    stats.classList.add('show');
}

function normalizeImageName(fileName) {
    try {
        const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
        const parts = nameWithoutExtension.split(' - ');
        if (parts.length > 1) {
            return parts[parts.length - 1].trim().toUpperCase();
        }
    } catch (e) {
        console.error("Error al normalizar el nombre del archivo:", fileName, e);
    }
    return null;
}

function findImageUrlForPerson(personName) {
    if (!personName || imageFileUrls.size === 0) return null;
    const normalizedPersonName = personName.trim().toUpperCase();
    return imageFileUrls.get(normalizedPersonName) || null;
}

function updateChartCarousel() { /* ... sin cambios ... */ }
function createCharts(data) { /* ... sin cambios ... */ }
function createDistributionChart(data) { /* ... sin cambios ... */ }
function createTopPersonsChart(data) { /* ... sin cambios ... */ }
function createDelitosChart(data) { /* ... sin cambios ... */ }
function createWeekdayChart(data) { /* ... sin cambios ... */ }
function destroyCharts() { Object.values(charts).forEach(chart => { if (chart) chart.destroy(); }); charts = {}; }

function downloadExcel() {
    if (parsedData.length === 0) { showError('No hay datos para exportar'); return; }
    const wb = XLSX.utils.book_new();
    const excelData = parsedData.map(row => ({
        'Persona': row.persona || '', 'Días Distintos': row.dias_distintos || '', 'Fechas Detectado': row.fechas_detectado || '', 'Delitos': row.delitos || '', 'Detalle del Delito': row.detalle_delito || ''
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [ { wch: 30 }, { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 80 } ];
    XLSX.utils.book_append_sheet(wb, ws, 'Registros de Detención');
    XLSX.writeFile(wb, `registros_detencion_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = 20;

    pdf.setFontSize(18).setFont(undefined, 'bold');
    pdf.text('Reporte de Detenciones', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    pdf.setFontSize(10).setFont(undefined, 'normal');
    pdf.text(`Generado el: ${new Date().toLocaleDateString('es-MX')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    pdf.setFontSize(12).setFont(undefined, 'bold');
    pdf.text('Estadísticas Generales', margin, yPosition);
    
    const statsBody = [
        ['Total de Personas:', document.getElementById('totalPersonas').textContent, 'Faltas Administrativas:', document.getElementById('faltasAdmin').textContent],
        ['Total de Detenciones:', document.getElementById('totalDetenciones').textContent, 'Disposiciones:', document.getElementById('disposiciones').textContent],
        ['Promedio por Persona:', document.getElementById('promedioDetenciones').textContent, 'Reincidentes (3+ días):', document.getElementById('reincidentes').textContent],
        ['Máximo de Detenciones:', document.getElementById('maxDetenciones').textContent, 'Mediana de Detenciones:', document.getElementById('medianaDetenciones').textContent]
    ];
    pdf.autoTable({
        body: statsBody, startY: yPosition + 6, theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [240, 240, 240] }, 2: { fontStyle: 'bold', fillColor: [240, 240, 240] }
        }
    });
    yPosition = pdf.autoTable.previous.finalY + 15;

    pdf.setFontSize(12).setFont(undefined, 'bold');
    pdf.text('Análisis Gráfico', margin, yPosition);
    yPosition += 8;

    const chartIds = ['distributionChart', 'topPersonsChart', 'delitosChart', 'weekdayChart'];
    const imageWidth = pageWidth - margin * 2;

    for (const chartId of chartIds) {
        const canvas = document.getElementById(chartId);
        if (canvas) {
            const aspectRatio = canvas.width / canvas.height;
            const imageHeight = imageWidth / aspectRatio;
            if (yPosition + imageHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
            }
            const imgData = canvas.toDataURL('image/png', 1.0);
            pdf.addImage(imgData, 'PNG', margin, yPosition, imageWidth, imageHeight);
            yPosition += imageHeight + 10;
        }
    }

    if (parsedData.length > 0) {
        if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
        }
        
        pdf.setFontSize(12).setFont(undefined, 'bold');
        pdf.text('Registros Detallados (Primeros 20)', margin, yPosition);

        const tableData = parsedData.slice(0, 20);

        const loadImageAsBase64 = (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL("image/jpeg"));
                };
                img.onerror = () => resolve(null);
                img.src = url;
            });
        };
        
        const imagePromises = tableData.map(row => {
            const imageUrl = findImageUrlForPerson(row.persona);
            return imageUrl ? loadImageAsBase64(imageUrl) : Promise.resolve(null);
        });
        
        const loadedImagesBase64 = await Promise.all(imagePromises);

        const head = [['Foto', 'Persona', 'Días', 'Delitos', 'Detalle del Delito']];
        const body = tableData.map((row, index) => [
            '', 
            row.persona || '',
            row.dias_distintos || '0',
            row.delitos || '',
            row.detalle_delito || ''
        ]);

        const imageSize = 18;

        pdf.autoTable({
            head: head,
            body: body,
            startY: yPosition + 8,
            headStyles: { fillColor: [52, 73, 94] },
            styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle', overflow: 'linebreak' },
            columnStyles: {
                0: { minCellWidth: imageSize + 2 },
                1: { cellWidth: 35 },
                2: { cellWidth: 10, halign: 'center' },
                3: { cellWidth: 30 },
                4: { cellWidth: 'auto' }
            },
            didDrawCell: function(data) {
                if (data.section === 'body' && data.column.index === 0) {
                    const base64Image = loadedImagesBase64[data.row.index];
                    if (base64Image) {
                        const x = data.cell.x + (data.cell.width - imageSize) / 2;
                        const y = data.cell.y + (data.cell.height - imageSize) / 2;
                        pdf.addImage(base64Image, 'JPEG', x, y, imageSize, imageSize);
                    }
                }
            },
            didParseCell: function (data) {
                if (data.section === 'body') {
                    data.cell.styles.minCellHeight = imageSize + 2;
                }
            }
        });
    }
    
    pdf.save(`reporte_detenciones_${new Date().toISOString().slice(0,10)}.pdf`);
}


function resetApp() {
    parsedData = [];
    filteredData = [];
    imageFiles = [];
    imageFileUrls.forEach(url => URL.revokeObjectURL(url));
    imageFileUrls.clear();
    
    fileInput.value = '';
    imageInput.value = '';
    fileName.textContent = '';
    imageCount.textContent = '';
    tableBody.innerHTML = '';
    
    dataTable.classList.remove('show');
    stats.classList.remove('show');
    chartsSection.classList.remove('show');
    downloadSection.classList.remove('show');
    tableControls.classList.remove('show');
    paginationControls.classList.remove('show');
    searchInput.value = '';

    destroyCharts();
    hideError();
}

function showError(message) { errorMessage.textContent = message; errorMessage.style.display = 'block'; }
function hideError() { errorMessage.style.display = 'none'; }

function updateChartCarousel() {
    const offset = -currentChartIndex * 25;
    carouselTrack.style.transform = `translateX(${offset}%)`;
}

function createCharts(data) {
    destroyCharts();
    chartsSection.classList.add('show');
    currentChartIndex = 0;
    updateChartCarousel();

    createDistributionChart(data);
    createTopPersonsChart(data);
    createDelitosChart(data);
    createWeekdayChart(data);
}

function createDistributionChart(data) {
    const diasCounts = {};
    data.forEach(row => {
        const dias = parseInt(row.dias_distintos) || 0;
        diasCounts[dias] = (diasCounts[dias] || 0) + 1;
    });
    const labels = Object.keys(diasCounts).sort((a, b) => a - b);
    const values = labels.map(label => diasCounts[label]);
    const ctx = document.getElementById('distributionChart').getContext('2d');
    charts.distribution = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => l + ' días'),
            datasets: [{ label: 'Número de Personas', data: values, backgroundColor: 'rgba(102, 126, 234, 0.8)', borderColor: 'rgba(102, 126, 234, 1)', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function createTopPersonsChart(data) {
    const sorted = [...data].sort((a, b) => (parseInt(b.dias_distintos) || 0) - (parseInt(a.dias_distintos) || 0)).slice(0, 10);
    const ctx = document.getElementById('topPersonsChart').getContext('2d');
    charts.topPersons = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(row => row.persona.split(' ').slice(0, 2).join(' ')),
            datasets: [{ label: 'Días de Detención', data: sorted.map(row => parseInt(row.dias_distintos) || 0), backgroundColor: 'rgba(231, 76, 60, 0.8)', borderColor: 'rgba(231, 76, 60, 1)', borderWidth: 2 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}

function createDelitosChart(data) {
    const delitosCounts = {};
    data.forEach(row => {
        const delitos = (row.delitos || '').split(',');
        delitos.forEach(delito => {
            const d = delito.trim().toUpperCase();
            if (d) delitosCounts[d] = (delitosCounts[d] || 0) + 1;
        });
    });
    const labels = Object.keys(delitosCounts);
    const values = labels.map(label => delitosCounts[label]);
    const ctx = document.getElementById('delitosChart').getContext('2d');
    charts.delitos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: values, backgroundColor: ['rgba(142, 68, 173, 0.8)', 'rgba(52, 152, 219, 0.8)', 'rgba(46, 204, 113, 0.8)', 'rgba(241, 196, 15, 0.8)', 'rgba(230, 126, 34, 0.8)'], borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function createWeekdayChart(data) {
    const weekdayCounts = { 'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0, 'Dom': 0 };
    const weekdayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    data.forEach(row => {
        const fechas = (row.fechas_detectado || '').split(',');
        fechas.forEach(fecha => {
            const f = fecha.trim();
            if (f) {
                const dateParts = f.split(/[-/]/);
                if (dateParts.length === 3) {
                    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    if (!isNaN(date)) {
                        const dayName = weekdayNames[date.getDay()];
                        weekdayCounts[dayName]++;
                    }
                }
            }
        });
    });
    const ctx = document.getElementById('weekdayChart').getContext('2d');
    charts.weekday = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(weekdayCounts),
            datasets: [{ label: 'Detenciones', data: Object.values(weekdayCounts), backgroundColor: 'rgba(39, 174, 96, 0.2)', borderColor: 'rgba(39, 174, 96, 1)', borderWidth: 3, fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
}