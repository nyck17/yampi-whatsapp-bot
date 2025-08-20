// servidor.js - Automação COMPLETA Yampi + WhatsApp INTEGRADO
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Configurações
const config = {
    YAMPI_API: `https://api.dooki.com.br/v2/${process.env.YAMPI_STORE}`,
    YAMPI_TOKEN: process.env.YAMPI_TOKEN,
    PORT: process.env.PORT || 3000
};

// Variáveis globais
let produtosPendentes = {};
let whatsappConnected = false;
let qrCodeData = '';

// Logs
const logFile = path.join(__dirname, 'produtos.log');

function log(message) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    if (fs.existsSync(__dirname)) {
        fs.appendFileSync(logFile, logMessage);
    }
}

// Simulador de WhatsApp (para desenvolvimento)
let simulatedMessages = [];

// Webhook para receber mensagens (compatível com Evolution API)
app.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (data && data.message) {
            const phone = data.key.remoteJid;
            const message = data.message.conversation || 
                           data.message.extendedTextMessage?.text || '';
            
            log(`Mensagem de ${phone}: ${message.substring(0, 50)}...`);
            
            // Processar imagem
            if (data.message.imageMessage) {
                await processarImagem(data.message.imageMessage, phone);
                res.status(200).json({ success: true });
                return;
            }
            
            // Processar comandos
            if (message.toLowerCase().includes('/cadastrar') || 
                message.toLowerCase().includes('cadastrar')) {
                await processarProduto(message, phone);
            }
            else if (message.toLowerCase().includes('/ajuda') || 
                    message.toLowerCase().includes('ajuda')) {
                await enviarAjuda(phone);
            }
            else if (message.toLowerCase().includes('/exemplo')) {
                await enviarExemplo(phone);
            }
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        log(`Erro no webhook: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Processar imagem
async function processarImagem(imageMessage, phone) {
    try {
        if (!produtosPendentes[phone]) {
            produtosPendentes[phone] = {};
        }
        
        // Simular processamento de imagem
        produtosPendentes[phone].imagem = 'https://via.placeholder.com/300x300.png?text=Produto';
        
        const resposta = `📷 *Imagem recebida!*

Agora envie os dados do produto:

/cadastrar
Nome: Nome do produto
Preço: R$ 99,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Categoria

_A imagem será adicionada automaticamente!_`;

        await simularResposta(phone, resposta);
        log(`Imagem processada para ${phone}`);
        
    } catch (error) {
        log(`Erro ao processar imagem: ${error.message}`);
        await simularResposta(phone, '❌ Erro ao processar imagem. Tente enviar novamente.');
    }
}

// Processar produto
async function processarProduto(message, phone) {
    try {
        log(`Processando produto para ${phone}`);
        
        await simularResposta(phone, '⏳ Processando seu produto...\nAguarde um momento!');
        
        const dados = extrairDados(message);
        
        if (!dados.nome || !dados.preco) {
            const erroMsg = `❌ *Erro: Nome e Preço são obrigatórios!*

📋 *Formato correto:*
Nome: Produto
Preço: R$ 99,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Roupas

📷 *Dica:* Envie a foto ANTES dos dados!
💡 Digite /exemplo para ver exemplo completo.`;
            
            await simularResposta(phone, erroMsg);
            return;
        }
        
        // Verificar imagem pendente
        let imagemUrl = '';
        if (produtosPendentes[phone] && produtosPendentes[phone].imagem) {
            imagemUrl = produtosPendentes[phone].imagem;
            delete produtosPendentes[phone];
            log(`Usando imagem pendente: ${imagemUrl}`);
        }
        
        // Criar produto na Yampi
        const produto = await criarProdutoYampi(dados, imagemUrl);
        
        // Confirmar sucesso
        await enviarConfirmacao(phone, produto, dados, imagemUrl);
        
        log(`Produto criado: ${dados.nome} (ID: ${produto.id})`);
        
    } catch (error) {
        log(`Erro ao processar produto: ${error.message}`);
        
        const erroMsg = `❌ *Erro:* ${error.message}

🔧 *Possíveis soluções:*
• Verifique se Nome e Preço estão corretos
• Use formato: Nome: valor (com dois pontos)
• Preço: R$ 99,90 (com R$)

💡 Digite /exemplo para ver formato correto.`;

        await simularResposta(phone, erroMsg);
    }
}

// Extrair dados da mensagem (aceita formato em linha única também)
function extrairDados(message) {
    const dados = {
        nome: '',
        preco: 0,
        tamanhos: [],
        estoque: {},
        categoria: '',
        descricao: ''
    };
    
    // Tentar formato em múltiplas linhas primeiro
    const lines = message.split('\n');
    
    // Se só tem uma linha, tentar extrair tudo de uma vez
    if (lines.length === 1) {
        const texto = message.toLowerCase();
        
        // Extrair nome
        const nomeMatch = texto.match(/nome:\s*([^,\n]+)/);
        if (nomeMatch) dados.nome = nomeMatch[1].trim();
        
        // Extrair preço
        const precoMatch = texto.match(/preço:\s*r?\$?\s*([\d,\.]+)|preco:\s*r?\$?\s*([\d,\.]+)/);
        if (precoMatch) {
            const precoStr = precoMatch[1] || precoMatch[2];
            dados.preco = parseFloat(precoStr.replace(',', '.'));
        }
        
        // Extrair categoria
        const categoriaMatch = texto.match(/categoria:\s*([^,\n]+)/);
        if (categoriaMatch) dados.categoria = categoriaMatch[1].trim();
        
        // Extrair tamanhos
        const tamanhosMatch = texto.match(/tamanhos:\s*([^,\n]+)/);
        if (tamanhosMatch) {
            dados.tamanhos = tamanhosMatch[1].split(',').map(t => t.trim());
        }
        
        // Extrair estoque
        const estoqueMatch = texto.match(/estoque:\s*([^,\n]+)/);
        if (estoqueMatch) {
            const estoqueStr = estoqueMatch[1];
            const estoqueItems = estoqueStr.split(',');
            
            for (const item of estoqueItems) {
                if (item.includes('=')) {
                    const [tamanho, quantidade] = item.split('=');
                    dados.estoque[tamanho.trim()] = parseInt(quantidade.trim()) || 0;
                }
            }
        }
    } else {
        // Formato original de múltiplas linhas
        for (const line of lines) {
            const lower = line.toLowerCase().trim();
            
            if (lower.startsWith('nome:')) {
                dados.nome = line.split(':')[1].trim();
            }
            else if (lower.startsWith('preço:') || lower.startsWith('preco:')) {
                const precoStr = line.split(':')[1].trim();
                dados.preco = parseFloat(precoStr.replace('r

// Criar produto na Yampi
async function criarProdutoYampi(dados, imagemUrl = '') {
    const produtoData = {
        name: dados.nome,
        description: dados.descricao || dados.nome,
        price: dados.preco,
        sku: gerarSKU(dados.nome),
        status: 'active',
        type: 'physical',
        track_quantity: true,
        has_variations: dados.tamanhos.length > 1,
        variations: []
    };
    
    // Adicionar imagem se disponível
    if (imagemUrl) {
        produtoData.images = [{
            src: imagemUrl,
            alt: dados.nome
        }];
    }
    
    // Criar variações
    if (dados.tamanhos.length > 1) {
        for (const tamanho of dados.tamanhos) {
            const estoque = dados.estoque[tamanho] || 0;
            
            produtoData.variations.push({
                values: [{ name: 'Tamanho', value: tamanho }],
                sku: `${produtoData.sku}-${tamanho}`,
                price: dados.preco,
                quantity: estoque,
                track_quantity: true
            });
        }
    } else {
        produtoData.quantity = dados.estoque[dados.tamanhos[0]] || 10;
    }
    
    log(`Criando produto: ${JSON.stringify(produtoData, null, 2)}`);
    
    const response = await axios.post(
        `${config.YAMPI_API}/catalog/products`,
        produtoData,
        {
            headers: {
                'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
    
    return response.data.data;
}

function gerarSKU(nome) {
    const timestamp = Date.now().toString().slice(-6);
    const nomeClean = nome.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
    return `${nomeClean}${timestamp}`;
}

// Simular resposta do WhatsApp
async function simularResposta(phone, message) {
    const resposta = {
        timestamp: new Date().toLocaleString('pt-BR'),
        phone: phone,
        message: message,
        type: 'resposta'
    };
    
    simulatedMessages.push(resposta);
    
    // Manter apenas últimas 50 mensagens
    if (simulatedMessages.length > 50) {
        simulatedMessages = simulatedMessages.slice(-50);
    }
    
    log(`Resposta enviada para ${phone}: ${message.substring(0, 50)}...`);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 *AUTOMAÇÃO YAMPI*

📝 *Como usar:*

1️⃣ Envie uma foto do produto (opcional)
2️⃣ Envie os dados:

/cadastrar
Nome: Nome do produto
Preço: R$ 99,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Categoria

✅ *Campos obrigatórios:* Nome e Preço
🎯 *Em 30 segundos* seu produto estará na loja!

Digite /exemplo para ver um exemplo completo.`;

    await simularResposta(phone, ajuda);
}

// Enviar exemplo
async function enviarExemplo(phone) {
    const exemplo = `📋 *EXEMPLO COMPLETO:*

📷 [Envie foto do produto]

Depois envie:

/cadastrar
Nome: Camiseta Polo Azul
Preço: R$ 89,90
Tamanhos: P,M,G,GG
Estoque: P=5,M=10,G=8,GG=3
Categoria: Camisetas
Descrição: Camiseta polo 100% algodão

✅ *Resultado:* Produto com foto na sua loja Yampi!`;

    await simularResposta(phone, exemplo);
}

// Confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados, imagemUrl = '') {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + b, 0);
    
    const confirmacao = `✅ *Produto cadastrado com sucesso!*

📦 *${dados.nome}*
💰 *R$ ${dados.preco.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')}*
${imagemUrl ? '📷 *Com imagem anexada!*' : ''}

📊 *Detalhes:*
• ${dados.tamanhos.length} variação(ões)
• ${totalEstoque} unidades em estoque
• Categoria: ${dados.categoria || 'Não definida'}

🔗 *Produto ID:* ${produto.id}

*Tamanhos e estoque:*
${dados.tamanhos.map(t => `• ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

✨ *Seu produto já está disponível na loja!*

💡 Digite /ajuda para ver outros comandos.`;

    await simularResposta(phone, confirmacao);
}

// Página de teste do WhatsApp
app.get('/whatsapp', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>📱 WhatsApp Simulator - Yampi</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 400px;
                    margin: 20px auto;
                    padding: 20px;
                    background: #e5ddd5;
                }
                .chat-container {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .chat-header {
                    background: #075e54;
                    color: white;
                    padding: 15px;
                    text-align: center;
                    font-weight: bold;
                }
                .chat-messages {
                    height: 400px;
                    overflow-y: auto;
                    padding: 10px;
                    background: #ece5dd;
                }
                .message {
                    margin: 10px 0;
                    padding: 10px;
                    border-radius: 8px;
                    max-width: 80%;
                    word-wrap: break-word;
                }
                .message.sent {
                    background: #dcf8c6;
                    margin-left: auto;
                    text-align: right;
                }
                .message.received {
                    background: white;
                    margin-right: auto;
                }
                .chat-input {
                    display: flex;
                    padding: 10px;
                    background: #f0f0f0;
                }
                .chat-input textarea {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 15px;
                    margin-right: 10px;
                    font-family: Arial;
                    font-size: 14px;
                    resize: vertical;
                    min-height: 40px;
                }
                .chat-input button {
                    background: #075e54;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                }
                .example {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 5px;
                    font-size: 12px;
                }
                .timestamp {
                    font-size: 10px;
                    color: #999;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    🤖 Automação Yampi
                    <div style="font-size: 12px; opacity: 0.8;">
                        ${whatsappConnected ? '🟢 Online' : '🔴 Simulador'}
                    </div>
                </div>
                
                <div class="chat-messages" id="messages">
                    <div class="message received">
                        Olá! 👋 Sou sua automação Yampi!<br>
                        Digite /ajuda para ver os comandos.
                        <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                
                <div class="example">
                    <strong>📋 Exemplo rápido:</strong><br>
                    /cadastrar<br>
                    Nome: Camiseta Teste<br>
                    Preço: R$ 29,90<br>
                    Categoria: Roupas
                </div>
                
                <div class="chat-input">
                    <textarea id="messageInput" placeholder="Digite sua mensagem..." rows="3" style="resize: vertical; border-radius: 15px; padding: 10px; font-family: Arial; font-size: 14px;" onkeypress="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }"></textarea>
                    <button onclick="sendMessage()">▶</button>
                </div>
            </div>

            <script>
                const messagesDiv = document.getElementById('messages');
                const messageInput = document.getElementById('messageInput');
                
                // Carregar mensagens existentes
                loadMessages();
                
                async function sendMessage() {
                    const message = messageInput.value.trim();
                    if (!message) return;
                    
                    // Adicionar mensagem enviada
                    addMessage(message, 'sent');
                    messageInput.value = '';
                    
                    // Simular webhook
                    const webhookData = {
                        data: {
                            key: {
                                remoteJid: '5511999999999@s.whatsapp.net'
                            },
                            message: {
                                conversation: message
                            }
                        }
                    };
                    
                    try {
                        const response = await fetch('/webhook', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(webhookData)
                        });
                        
                        // Aguardar um pouco e carregar novas mensagens
                        setTimeout(loadMessages, 1000);
                        
                    } catch (error) {
                        addMessage('❌ Erro: ' + error.message, 'received');
                    }
                }
                
                function addMessage(text, type) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + type;
                    messageDiv.innerHTML = text.replace(/\\n/g, '<br>') + 
                        '<div class="timestamp">' + new Date().toLocaleTimeString() + '</div>';
                    messagesDiv.appendChild(messageDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
                
                async function loadMessages() {
                    try {
                        const response = await fetch('/messages');
                        const data = await response.json();
                        
                        // Limpar mensagens antigas e adicionar novas respostas
                        const existingMessages = messagesDiv.querySelectorAll('.message.received').length;
                        
                        if (data.messages && data.messages.length > existingMessages - 1) {
                            data.messages.slice(existingMessages - 1).forEach(msg => {
                                if (msg.type === 'resposta') {
                                    addMessage(msg.message, 'received');
                                }
                            });
                        }
                        
                    } catch (error) {
                        console.error('Erro ao carregar mensagens:', error);
                    }
                }
                
                // Carregar mensagens a cada 3 segundos
                setInterval(loadMessages, 3000);
            </script>
        </body>
        </html>
    `);
});

// API para retornar mensagens simuladas
app.get('/messages', (req, res) => {
    res.json({ messages: simulatedMessages });
});

// Rota de status
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        whatsapp_connected: whatsappConnected,
        timestamp: new Date().toISOString(),
        config: {
            yampi_configured: !!config.YAMPI_TOKEN,
            yampi_store: !!process.env.YAMPI_STORE
        },
        messages_count: simulatedMessages.length
    });
});

// Rota para logs
app.get('/logs', (req, res) => {
    try {
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8').split('\n').slice(-50);
            res.json({ logs: logs.filter(log => log.trim()) });
        } else {
            res.json({ logs: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>🤖 Automação Yampi + WhatsApp</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                h1 { color: #25D366; text-align: center; }
                .status {
                    text-align: center;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 10px;
                    background: ${whatsappConnected ? '#d4edda' : '#fff3cd'};
                    border: 1px solid ${whatsappConnected ? '#c3e6cb' : '#ffeaa7'};
                }
                .links {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 30px 0;
                }
                .link-card {
                    background: #25D366;
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-decoration: none;
                    text-align: center;
                    transition: transform 0.2s;
                }
                .link-card:hover {
                    transform: translateY(-2px);
                    text-decoration: none;
                    color: white;
                }
                .example {
                    background: #f8f9fa;
                    padding: 20px;
                    border-left: 4px solid #25D366;
                    margin: 20px 0;
                    border-radius: 0 10px 10px 0;
                }
                pre {
                    background: #e9ecef;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi + WhatsApp</h1>
                
                <div class="status">
                    <h3>${whatsappConnected ? '✅ WhatsApp Conectado!' : '📱 WhatsApp Simulator Ativo'}</h3>
                    <p>${whatsappConnected ? 
                        'Sua automação está funcionando! Envie mensagens no WhatsApp.' : 
                        'Use o simulador abaixo para testar a automação.'}</p>
                </div>
                
                <div class="links">
                    <a href="/whatsapp" class="link-card">
                        📱 Testar WhatsApp<br>
                        <small>Simulador integrado</small>
                    </a>
                    <a href="/status" class="link-card">
                        📊 Status da API<br>
                        <small>Verificar funcionamento</small>
                    </a>
                    <a href="/logs" class="link-card">
                        📝 Ver Logs<br>
                        <small>Atividade em tempo real</small>
                    </a>
                    <a href="https://painel.yampi.com.br" target="_blank" class="link-card">
                        🏪 Painel Yampi<br>
                        <small>Ver produtos criados</small>
                    </a>
                </div>
                
                <div class="example">
                    <h3>📋 Como usar:</h3>
                    <p><strong>1. Teste agora:</strong> Clique em "Testar WhatsApp" acima</p>
                    <p><strong>2. Formato da mensagem:</strong></p>
                    <pre>/cadastrar
Nome: Camiseta Polo Azul
Preço: R$ 89,90
Tamanhos: P,M,G,GG
Estoque: P=5,M=10,G=8,GG=3
Categoria: Camisetas</pre>
                    <p><strong>3. Resultado:</strong> Produto na sua loja Yampi em 30 segundos!</p>
                </div>
                
                <div class="example">
                    <h3>🔗 Para conectar WhatsApp real:</h3>
                    <p>Configure qualquer Evolution API para enviar webhook para:</p>
                    <code>${req.get('host')}/webhook</code>
                </div>
                
                <hr style="margin: 30px 0;">
                <p style="text-align: center; color: #666;">
                    ✨ Desenvolvido com ❤️ - 100% Gratuito - Railway.app
                </p>
            </div>
        </body>
        </html>
    `);
});

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    
    console.log(`
╔══════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║              TUDO INTEGRADO + TESTÁVEL           ║
╠══════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE                             ║
║  ✅ Yampi: ${config.YAMPI_TOKEN ? 'CONFIGURADO' : 'PENDENTE'}                   ║
║  ✅ WhatsApp: SIMULADOR ATIVO                    ║
║  ✅ Webhook: /webhook                            ║
╠══════════════════════════════════════════════════╣
║              COMO TESTAR:                        ║
║  1. Acesse: /whatsapp                            ║
║  2. Digite: /cadastrar                           ║
║  3. Preencha dados do produto                    ║
║  4. Produto criado na Yampi!                     ║
╚══════════════════════════════════════════════════╝
    `);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    log(`Erro não capturado: ${error.message}`);
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Promise rejeitada: ${reason}`);
    console.error('Promise rejeitada:', reason);
});, '').replace(',', '.').trim());
            }
            else if (lower.startsWith('tamanhos:')) {
                const tamanhosStr = line.split(':')[1].trim();
                dados.tamanhos = tamanhosStr.split(',').map(t => t.trim());
            }
            else if (lower.startsWith('estoque:')) {
                const estoqueStr = line.split(':')[1].trim();
                const estoqueItems = estoqueStr.split(',');
                
                for (const item of estoqueItems) {
                    if (item.includes('=')) {
                        const [tamanho, quantidade] = item.split('=');
                        dados.estoque[tamanho.trim()] = parseInt(quantidade.trim()) || 0;
                    }
                }
            }
            else if (lower.startsWith('categoria:')) {
                dados.categoria = line.split(':')[1].trim();
            }
            else if (lower.startsWith('descrição:') || lower.startsWith('descricao:')) {
                dados.descricao = line.split(':')[1].trim();
            }
        }
    }
    
    // Se não tiver tamanhos, usar padrão
    if (dados.tamanhos.length === 0) {
        dados.tamanhos = ['Único'];
        dados.estoque['Único'] = 10;
    }
    
    return dados;
}

// Criar produto na Yampi
async function criarProdutoYampi(dados, imagemUrl = '') {
    const produtoData = {
        name: dados.nome,
        description: dados.descricao || dados.nome,
        price: dados.preco,
        sku: gerarSKU(dados.nome),
        status: 'active',
        type: 'physical',
        track_quantity: true,
        has_variations: dados.tamanhos.length > 1,
        variations: []
    };
    
    // Adicionar imagem se disponível
    if (imagemUrl) {
        produtoData.images = [{
            src: imagemUrl,
            alt: dados.nome
        }];
    }
    
    // Criar variações
    if (dados.tamanhos.length > 1) {
        for (const tamanho of dados.tamanhos) {
            const estoque = dados.estoque[tamanho] || 0;
            
            produtoData.variations.push({
                values: [{ name: 'Tamanho', value: tamanho }],
                sku: `${produtoData.sku}-${tamanho}`,
                price: dados.preco,
                quantity: estoque,
                track_quantity: true
            });
        }
    } else {
        produtoData.quantity = dados.estoque[dados.tamanhos[0]] || 10;
    }
    
    log(`Criando produto: ${JSON.stringify(produtoData, null, 2)}`);
    
    const response = await axios.post(
        `${config.YAMPI_API}/catalog/products`,
        produtoData,
        {
            headers: {
                'Authorization': `Bearer ${config.YAMPI_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
    
    return response.data.data;
}

function gerarSKU(nome) {
    const timestamp = Date.now().toString().slice(-6);
    const nomeClean = nome.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
    return `${nomeClean}${timestamp}`;
}

// Simular resposta do WhatsApp
async function simularResposta(phone, message) {
    const resposta = {
        timestamp: new Date().toLocaleString('pt-BR'),
        phone: phone,
        message: message,
        type: 'resposta'
    };
    
    simulatedMessages.push(resposta);
    
    // Manter apenas últimas 50 mensagens
    if (simulatedMessages.length > 50) {
        simulatedMessages = simulatedMessages.slice(-50);
    }
    
    log(`Resposta enviada para ${phone}: ${message.substring(0, 50)}...`);
}

// Enviar ajuda
async function enviarAjuda(phone) {
    const ajuda = `🤖 *AUTOMAÇÃO YAMPI*

📝 *Como usar:*

1️⃣ Envie uma foto do produto (opcional)
2️⃣ Envie os dados:

/cadastrar
Nome: Nome do produto
Preço: R$ 99,90
Tamanhos: P,M,G
Estoque: P=5,M=10,G=8
Categoria: Categoria

✅ *Campos obrigatórios:* Nome e Preço
🎯 *Em 30 segundos* seu produto estará na loja!

Digite /exemplo para ver um exemplo completo.`;

    await simularResposta(phone, ajuda);
}

// Enviar exemplo
async function enviarExemplo(phone) {
    const exemplo = `📋 *EXEMPLO COMPLETO:*

📷 [Envie foto do produto]

Depois envie:

/cadastrar
Nome: Camiseta Polo Azul
Preço: R$ 89,90
Tamanhos: P,M,G,GG
Estoque: P=5,M=10,G=8,GG=3
Categoria: Camisetas
Descrição: Camiseta polo 100% algodão

✅ *Resultado:* Produto com foto na sua loja Yampi!`;

    await simularResposta(phone, exemplo);
}

// Confirmação de produto criado
async function enviarConfirmacao(phone, produto, dados, imagemUrl = '') {
    const totalEstoque = Object.values(dados.estoque).reduce((a, b) => a + b, 0);
    
    const confirmacao = `✅ *Produto cadastrado com sucesso!*

📦 *${dados.nome}*
💰 *R$ ${dados.preco.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')}*
${imagemUrl ? '📷 *Com imagem anexada!*' : ''}

📊 *Detalhes:*
• ${dados.tamanhos.length} variação(ões)
• ${totalEstoque} unidades em estoque
• Categoria: ${dados.categoria || 'Não definida'}

🔗 *Produto ID:* ${produto.id}

*Tamanhos e estoque:*
${dados.tamanhos.map(t => `• ${t}: ${dados.estoque[t] || 0} unidades`).join('\n')}

✨ *Seu produto já está disponível na loja!*

💡 Digite /ajuda para ver outros comandos.`;

    await simularResposta(phone, confirmacao);
}

// Página de teste do WhatsApp
app.get('/whatsapp', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>📱 WhatsApp Simulator - Yampi</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 400px;
                    margin: 20px auto;
                    padding: 20px;
                    background: #e5ddd5;
                }
                .chat-container {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .chat-header {
                    background: #075e54;
                    color: white;
                    padding: 15px;
                    text-align: center;
                    font-weight: bold;
                }
                .chat-messages {
                    height: 400px;
                    overflow-y: auto;
                    padding: 10px;
                    background: #ece5dd;
                }
                .message {
                    margin: 10px 0;
                    padding: 10px;
                    border-radius: 8px;
                    max-width: 80%;
                    word-wrap: break-word;
                }
                .message.sent {
                    background: #dcf8c6;
                    margin-left: auto;
                    text-align: right;
                }
                .message.received {
                    background: white;
                    margin-right: auto;
                }
                .chat-input {
                    display: flex;
                    padding: 10px;
                    background: #f0f0f0;
                }
                .chat-input textarea {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 15px;
                    margin-right: 10px;
                    font-family: Arial;
                    font-size: 14px;
                    resize: vertical;
                    min-height: 40px;
                }
                .chat-input button {
                    background: #075e54;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                }
                .example {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 5px;
                    font-size: 12px;
                }
                .timestamp {
                    font-size: 10px;
                    color: #999;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    🤖 Automação Yampi
                    <div style="font-size: 12px; opacity: 0.8;">
                        ${whatsappConnected ? '🟢 Online' : '🔴 Simulador'}
                    </div>
                </div>
                
                <div class="chat-messages" id="messages">
                    <div class="message received">
                        Olá! 👋 Sou sua automação Yampi!<br>
                        Digite /ajuda para ver os comandos.
                        <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                
                <div class="example">
                    <strong>📋 Exemplo rápido:</strong><br>
                    /cadastrar<br>
                    Nome: Camiseta Teste<br>
                    Preço: R$ 29,90<br>
                    Categoria: Roupas
                </div>
                
                <div class="chat-input">
                    <textarea id="messageInput" placeholder="Digite sua mensagem..." rows="3" style="resize: vertical; border-radius: 15px; padding: 10px; font-family: Arial; font-size: 14px;" onkeypress="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }"></textarea>
                    <button onclick="sendMessage()">▶</button>
                </div>
            </div>

            <script>
                const messagesDiv = document.getElementById('messages');
                const messageInput = document.getElementById('messageInput');
                
                // Carregar mensagens existentes
                loadMessages();
                
                async function sendMessage() {
                    const message = messageInput.value.trim();
                    if (!message) return;
                    
                    // Adicionar mensagem enviada
                    addMessage(message, 'sent');
                    messageInput.value = '';
                    
                    // Simular webhook
                    const webhookData = {
                        data: {
                            key: {
                                remoteJid: '5511999999999@s.whatsapp.net'
                            },
                            message: {
                                conversation: message
                            }
                        }
                    };
                    
                    try {
                        const response = await fetch('/webhook', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(webhookData)
                        });
                        
                        // Aguardar um pouco e carregar novas mensagens
                        setTimeout(loadMessages, 1000);
                        
                    } catch (error) {
                        addMessage('❌ Erro: ' + error.message, 'received');
                    }
                }
                
                function addMessage(text, type) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + type;
                    messageDiv.innerHTML = text.replace(/\\n/g, '<br>') + 
                        '<div class="timestamp">' + new Date().toLocaleTimeString() + '</div>';
                    messagesDiv.appendChild(messageDiv);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
                
                async function loadMessages() {
                    try {
                        const response = await fetch('/messages');
                        const data = await response.json();
                        
                        // Limpar mensagens antigas e adicionar novas respostas
                        const existingMessages = messagesDiv.querySelectorAll('.message.received').length;
                        
                        if (data.messages && data.messages.length > existingMessages - 1) {
                            data.messages.slice(existingMessages - 1).forEach(msg => {
                                if (msg.type === 'resposta') {
                                    addMessage(msg.message, 'received');
                                }
                            });
                        }
                        
                    } catch (error) {
                        console.error('Erro ao carregar mensagens:', error);
                    }
                }
                
                // Carregar mensagens a cada 3 segundos
                setInterval(loadMessages, 3000);
            </script>
        </body>
        </html>
    `);
});

// API para retornar mensagens simuladas
app.get('/messages', (req, res) => {
    res.json({ messages: simulatedMessages });
});

// Rota de status
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        whatsapp_connected: whatsappConnected,
        timestamp: new Date().toISOString(),
        config: {
            yampi_configured: !!config.YAMPI_TOKEN,
            yampi_store: !!process.env.YAMPI_STORE
        },
        messages_count: simulatedMessages.length
    });
});

// Rota para logs
app.get('/logs', (req, res) => {
    try {
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8').split('\n').slice(-50);
            res.json({ logs: logs.filter(log => log.trim()) });
        } else {
            res.json({ logs: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>🤖 Automação Yampi + WhatsApp</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                h1 { color: #25D366; text-align: center; }
                .status {
                    text-align: center;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 10px;
                    background: ${whatsappConnected ? '#d4edda' : '#fff3cd'};
                    border: 1px solid ${whatsappConnected ? '#c3e6cb' : '#ffeaa7'};
                }
                .links {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 30px 0;
                }
                .link-card {
                    background: #25D366;
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-decoration: none;
                    text-align: center;
                    transition: transform 0.2s;
                }
                .link-card:hover {
                    transform: translateY(-2px);
                    text-decoration: none;
                    color: white;
                }
                .example {
                    background: #f8f9fa;
                    padding: 20px;
                    border-left: 4px solid #25D366;
                    margin: 20px 0;
                    border-radius: 0 10px 10px 0;
                }
                pre {
                    background: #e9ecef;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Automação Yampi + WhatsApp</h1>
                
                <div class="status">
                    <h3>${whatsappConnected ? '✅ WhatsApp Conectado!' : '📱 WhatsApp Simulator Ativo'}</h3>
                    <p>${whatsappConnected ? 
                        'Sua automação está funcionando! Envie mensagens no WhatsApp.' : 
                        'Use o simulador abaixo para testar a automação.'}</p>
                </div>
                
                <div class="links">
                    <a href="/whatsapp" class="link-card">
                        📱 Testar WhatsApp<br>
                        <small>Simulador integrado</small>
                    </a>
                    <a href="/status" class="link-card">
                        📊 Status da API<br>
                        <small>Verificar funcionamento</small>
                    </a>
                    <a href="/logs" class="link-card">
                        📝 Ver Logs<br>
                        <small>Atividade em tempo real</small>
                    </a>
                    <a href="https://painel.yampi.com.br" target="_blank" class="link-card">
                        🏪 Painel Yampi<br>
                        <small>Ver produtos criados</small>
                    </a>
                </div>
                
                <div class="example">
                    <h3>📋 Como usar:</h3>
                    <p><strong>1. Teste agora:</strong> Clique em "Testar WhatsApp" acima</p>
                    <p><strong>2. Formato da mensagem:</strong></p>
                    <pre>/cadastrar
Nome: Camiseta Polo Azul
Preço: R$ 89,90
Tamanhos: P,M,G,GG
Estoque: P=5,M=10,G=8,GG=3
Categoria: Camisetas</pre>
                    <p><strong>3. Resultado:</strong> Produto na sua loja Yampi em 30 segundos!</p>
                </div>
                
                <div class="example">
                    <h3>🔗 Para conectar WhatsApp real:</h3>
                    <p>Configure qualquer Evolution API para enviar webhook para:</p>
                    <code>${req.get('host')}/webhook</code>
                </div>
                
                <hr style="margin: 30px 0;">
                <p style="text-align: center; color: #666;">
                    ✨ Desenvolvido com ❤️ - 100% Gratuito - Railway.app
                </p>
            </div>
        </body>
        </html>
    `);
});

// Iniciar servidor
app.listen(config.PORT, () => {
    log(`🚀 Servidor rodando na porta ${config.PORT}`);
    
    console.log(`
╔══════════════════════════════════════════════════╗
║        🤖 AUTOMAÇÃO YAMPI + WHATSAPP 🤖           ║
║              TUDO INTEGRADO + TESTÁVEL           ║
╠══════════════════════════════════════════════════╣
║  ✅ Servidor: ONLINE                             ║
║  ✅ Yampi: ${config.YAMPI_TOKEN ? 'CONFIGURADO' : 'PENDENTE'}                   ║
║  ✅ WhatsApp: SIMULADOR ATIVO                    ║
║  ✅ Webhook: /webhook                            ║
╠══════════════════════════════════════════════════╣
║              COMO TESTAR:                        ║
║  1. Acesse: /whatsapp                            ║
║  2. Digite: /cadastrar                           ║
║  3. Preencha dados do produto                    ║
║  4. Produto criado na Yampi!                     ║
╚══════════════════════════════════════════════════╝
    `);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    log(`Erro não capturado: ${error.message}`);
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Promise rejeitada: ${reason}`);
    console.error('Promise rejeitada:', reason);
});
