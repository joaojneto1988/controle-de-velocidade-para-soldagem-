// Constantes do Jogo (Novos Valores Ideais)
const IDEAL_AVANCO_MIN = 30; // mm/s 
const IDEAL_AVANCO_MAX = 35; // mm/s 
const IDEAL_OSCILACAO_MIN = 60; // Hz 
const IDEAL_OSCILACAO_MAX = 65; // Hz 

// Parâmetros de Simulação
const PIXEL_TO_MM = 0.5; // Fator de escala: 1 pixel = 0.5 mm
let lastX = 0;
let lastY = 0;
let lastTime = 0;
let totalTimeInIdealZone = 0;
let totalTimePlayed = 0;

// Variáveis para Cálculo da Oscilação
let yPeaks = [];
const PEAK_DETECTION_WINDOW = 200; // ms

// Elementos do Canvas
const canvas = document.getElementById('welding-canvas');
const ctx = canvas.getContext('2d');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Definir a posição inicial da 'tocha'
    lastX = canvas.width / 10;
    lastY = canvas.height / 2;
    lastTime = performance.now();
    
   // Desenhar as linhas guia (agora incluindo a oscilação)
drawGuideLines();
    
    // Iniciar a captura de movimento
    canvas.addEventListener('mousemove', handleMouseMove);
    
    // Loop principal de atualização
    requestAnimationFrame(gameLoop);
});
function handleMouseMove(e) {
    // Adição da verificação de estado do jogo
    if (!isGameRunning) {
        return; // Ignora o movimento do mouse se o jogo parou
    }

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Tempo em segundos
    if (deltaTime === 0) return;

    // 1. Cálculo da Velocidade de Avanço (Linear no eixo X)
    const deltaX_pixels = e.offsetX - lastX;
    const deltaX_mm = deltaX_pixels * PIXEL_TO_MM;
    const v_avanço = Math.abs(deltaX_mm / deltaTime); // mm/s

    // 2. Cálculo da Frequência de Oscilação (Baseado na variação Y)
    const deltaY = e.offsetY - lastY;

    // Lógica simples de detecção de pico (para simular a frequência)
    if (Math.abs(deltaY) > 5) { // Se houver movimento vertical significativo
        if ((deltaY > 0 && lastY <= lastY) || (deltaY < 0 && lastY >= lastY)) {
            // Se a direção Y mudou (atingiu um pico ou vale)
            yPeaks.push(currentTime);
            
            // Manter apenas os picos dentro da janela de detecção
            while (yPeaks.length > 0 && currentTime - yPeaks[0] > PEAK_DETECTION_WINDOW * 2) {
                yPeaks.shift();
            }
        }
    }
    
    let f_oscilacao = 0;
    if (yPeaks.length >= 2) {
        // Frequência = Número de ciclos / Tempo total
        const timeElapsed = (yPeaks[yPeaks.length - 1] - yPeaks[0]) / 1000; // Tempo em segundos
        const numCycles = yPeaks.length - 1;
        f_oscilacao = numCycles / timeElapsed; // Hz
    }


    // 3. Desenho do Cordão e Feedback
    const cordaoWidth = calculateCordaoWidth(v_avanço, f_oscilacao);
    drawWeldBead(lastX, lastY, e.offsetX, e.offsetY, cordaoWidth, v_avanço, f_oscilacao);
    updateHUD(v_avanço, f_oscilacao);

    // 4. Atualizar variáveis para o próximo frame
    lastX = e.offsetX;
    lastY = e.offsetY;
    lastTime = currentTime;
    totalTimePlayed += deltaTime;
    
    // Atualiza pontuação se estiver na zona ideal
    if (isIdeal(v_avanço, IDEAL_AVANCO_MIN, IDEAL_AVANCO_MAX) && 
        isIdeal(f_oscilacao, IDEAL_OSCILACAO_MIN, IDEAL_OSCILACAO_MAX)) {
        totalTimeInIdealZone += deltaTime;
    }
    updateScore();

    // 5. Lógica de Parada (Fim do Jogo)
    // O jogo para quando o centro da tocha (lastX) atinge 95% da largura do canvas
    const END_THRESHOLD = canvas.width * 0.95;
    if (lastX >= END_THRESHOLD) {
        isGameRunning = false;
        showFinalScore(); // Chama a nova função de pontuação
    }
}
// Função auxiliar para verificar a zona ideal
function isIdeal(value, min, max) {
    return value >= min && value <= max;
}
// Desenha a linha base (para guiar o usuário)
function drawGuideLines() {
    // Parâmetros do Guia de Oscilação
    const GUIDE_AMPLITUDE = 15; // Amplitude máxima da onda em pixels (largura do movimento)
    const GUIDE_FREQUENCY_X = 0.08; // Frequência da onda ao longo do eixo X (ajuste a repetição)
    const CENTER_Y = canvas.height / 2;
    
    // Desenhar a Linha-Base Simples (Fundo)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CENTER_Y);
    ctx.lineTo(canvas.width, CENTER_Y);
    ctx.stroke();

    // Desenhar a Onda Senoidal (Guia de Oscilação)
    ctx.strokeStyle = '#44A044'; // Cor verde para o guia de movimento ideal
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Linha tracejada para não confundir com o cordão de solda
    
    ctx.beginPath();
    // Começa no início do canvas
    ctx.moveTo(0, CENTER_Y);

    // Itera por toda a largura do canvas para desenhar a onda
    for (let x = 0; x < canvas.width; x++) {
        // Cálculo da posição Y usando a função seno (para criar a onda)
        // O valor 'x * GUIDE_FREQUENCY_X' controla quantos ciclos cabem no canvas
        const y = CENTER_Y + GUIDE_AMPLITUDE * Math.sin(x * GUIDE_FREQUENCY_X);
        ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    ctx.setLineDash([]); // Resetar o tracejado para que o cordão de solda seja sólido
}

function calculateCordaoWidth(v_avanço, f_oscilacao) {
    let baseWidth = 8; // Largura ideal em pixels
    
    // Regra 1: Velocidade de Avanço
    if (v_avanço > IDEAL_AVANCO_MAX * 1.5) {
        baseWidth = 4; // Fino demais (Avanço Rápido)
    } else if (v_avanço < IDEAL_AVANCO_MIN * 0.5) {
        baseWidth = 12; // Grosso demais (Avanço Lento)
    }
    
    // Regra 2: Frequência de Oscilação (Aplica-se apenas se o avanço estiver ok)
    if (isIdeal(v_avanço, IDEAL_AVANCO_MIN, IDEAL_AVANCO_MAX)) {
        if (f_oscilacao < IDEAL_OSCILACAO_MIN * 0.5) {
            baseWidth = 10; // Larga demais e irregular (Oscilação Lenta)
        } else if (f_oscilacao > IDEAL_OSCILACAO_MAX * 1.5) {
            baseWidth = 6; // Estreita demais (Oscilação Rápida/Pequena)
        }
    }
    
    // 
    
    return baseWidth;
}

function drawWeldBead(x1, y1, x2, y2, width, v_avanço, f_oscilacao) {
    // 1. Definição da Cor (Feedback Visual Imediato)
    let color = '#FFA500'; // Laranja padrão (solda em andamento)
    if (isIdeal(v_avanço, IDEAL_AVANCO_MIN, IDEAL_AVANCO_MAX) && 
        isIdeal(f_oscilacao, IDEAL_OSCILACAO_MIN, IDEAL_OSCILACAO_MAX)) {
        color = '#3CB371'; // Verde (Qualidade Ideal)
    } else if (v_avanço > IDEAL_AVANCO_MAX || v_avanço < IDEAL_AVANCO_MIN) {
        color = '#FF4500'; // Vermelho (Avanço Fora)
    } else if (f_oscilacao < IDEAL_OSCILACAO_MIN || f_oscilacao > IDEAL_OSCILACAO_MAX) {
        color = '#FFD700'; // Amarelo (Oscilação Fora)
    }

    // 2. Desenho do Cordão
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}
function updateHUD(v_avanço, f_oscilacao) {
    document.getElementById('avanço-value').textContent = v_avanço.toFixed(1);
    document.getElementById('oscilação-value').textContent = f_oscilacao.toFixed(1);
    
    // Lógica para colorir os medidores no HUD (semelhante ao que a imagem mostrou)
    const avancoValueElement = document.getElementById('avanço-value');
    avancoValueElement.className = isIdeal(v_avanço, IDEAL_AVANCO_MIN, IDEAL_AVANCO_MAX) ? 'ideal' : 
                                  (v_avanço > IDEAL_AVANCO_MAX ? 'too-fast' : 'too-slow');
    
    // (Implementação semelhante para a Oscilação e para os medidores visuais do HUD)
}

function updateScore() {
    // 1. Pontuação de Qualidade (Baseado no tempo na zona ideal)
    const qualityPercentage = (totalTimeInIdealZone / totalTimePlayed) * 100 || 0;
    document.getElementById('quality-score').textContent = `${Math.min(100, qualityPercentage).toFixed(0)}%`;
    
    // 2. Pontuação de Rastreamento (Necessitaria de cálculo adicional da distância média Y até a Linha Base)
    // Por simplicidade, vamos usar um valor placeholder por agora.
    document.getElementById('tracking-score').textContent = '90%'; 
}

// Função de loop (para manter o jogo vivo e responsivo)
function gameLoop() {
    // Lógica de atualização periódica (se houver)
    requestAnimationFrame(gameLoop);
}
function showFinalScore() {
    // Certifica-se de que o cálculo da pontuação está finalizado
    updateScore(); 
    
    const qualityPercentage = (totalTimeInIdealZone / totalTimePlayed) * 100 || 0;
    const finalQuality = Math.min(100, qualityPercentage).toFixed(1);
    
    // Exemplo de feedback visual para o usuário
    let message = '';
    if (finalQuality >= 90) {
        message = "Excelente! Manteve a consistência perfeita.";
    } else if (finalQuality >= 70) {
        message = "Bom trabalho! Pequenos ajustes e estará ideal.";
    } else {
        message = "Precisa de mais prática na coordenação de avanço e oscilação.";
    }

    // Exibe o resultado final de forma clara no canvas ou em um modal
    ctx.font = '30px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    // Limpa a área do canvas para a mensagem de fim de jogo
    ctx.fillRect(0, 0, canvas.width, canvas.height); 
    
    ctx.fillText("--- PERCURSO FINALIZADO ---", canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillText(`Pontuação Final de Qualidade: ${finalQuality}%`, canvas.width / 2, canvas.height / 2);
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 40);
}


